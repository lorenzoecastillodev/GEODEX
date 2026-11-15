"""Pruebas del contexto real y de la degradación sin proveedor externo."""
import os
import io
import json
from urllib.error import HTTPError
import unittest
from unittest.mock import patch
from app import app
from diagnostico import correlacion


class DiagnosticoTest(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.params = dict(zona='Cibao Noroeste', variable='NDVI', desde=2001, hasta=2025)

    def consultar(self, **extras):
        with patch.dict(os.environ, {'GEMINI_API_KEY': '', 'GOOGLE_API_KEY': ''}):
            return self.client.post('/api/diagnostico', json={**self.params, **extras})

    def test_pregunta_via_gemini(self):
        respuesta = {'candidates': [{'content': {'parts': [
            {'thought': True, 'text': 'Texto interno'}, {'text': 'Respuesta Gemini'}
        ]}}]}
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'clave-ficticia-para-pruebas', 'GEMINI_MODEL': '',
                                     'GOOGLE_API_KEY': 'otra-clave'}), \
             patch('diagnostico.urlopen', return_value=io.BytesIO(json.dumps(respuesta).encode())) as abrir:
            r = self.client.post('/api/diagnostico', json={**self.params,
                'accion': 'preguntar', 'pregunta': '¿Por qué cambia?'}).get_json()
        self.assertEqual(r['texto'], 'Respuesta Gemini')
        self.assertEqual(r['secciones'], [])
        req = abrir.call_args.args[0]
        self.assertEqual(req.full_url,
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent')
        self.assertEqual(req.get_header('X-goog-api-key'), 'clave-ficticia-para-pruebas')
        entrada = json.loads(json.loads(req.data)['contents'][0]['parts'][0]['text'])
        self.assertEqual(entrada['contexto']['zona'], self.params['zona'])
        self.assertEqual(entrada['pregunta'], '¿Por qué cambia?')

    def test_clave_google_y_modelo_configurado(self):
        respuesta = {'candidates': [{'content': {'parts': [{'text': 'Respuesta Gemini'}]}}]}
        with patch.dict(os.environ, {'GEMINI_API_KEY': '', 'GOOGLE_API_KEY': 'clave-ficticia-para-pruebas',
                                     'GEMINI_MODEL': 'models/gemini-3.5-flash-lite'}), \
             patch('diagnostico.urlopen', return_value=io.BytesIO(json.dumps(respuesta).encode())) as abrir:
            r = self.client.post('/api/diagnostico', json=self.params)
        self.assertEqual(r.get_json()['modo'], 'ia')
        req = abrir.call_args.args[0]
        self.assertTrue(req.full_url.endswith('/gemini-3.5-flash-lite:generateContent'))
        self.assertEqual(req.get_header('X-goog-api-key'), 'clave-ficticia-para-pruebas')

    def test_seis_variables_y_periodo(self):
        for variable in ('NDVI', 'T2M', 'T2M_MAX', 'PRECTOTCORR', 'GWETROOT', 'CAUDAL'):
            with self.subTest(variable=variable):
                r = self.consultar(variable=variable, desde=2010, hasta=2020)
                self.assertEqual(r.status_code, 200)
                d = r.get_json()
                self.assertEqual(d['modo'], 'calculado')
                self.assertEqual(len(d['contexto']['resultados']), 6)
                self.assertEqual(d['contexto']['resultados'][variable]['meses'], 132)
                self.assertEqual(d['contexto']['resultados'][variable]['desde'], '2010-01')

    def test_faltantes_explicitos(self):
        d = self.consultar(zona='Biminis', variable='T2M').get_json()
        self.assertIn('GWETROOT', d['contexto']['faltantes'])
        self.assertNotIn('GWETROOT', d['contexto']['relaciones'])

    def test_filtros_invalidos(self):
        for cambios in ({'zona': []}, {'variable': []}, {'desde': 2025},
                        {'hasta': 3000}, {'accion': 'inventar'}, {'historial': [{}]},
                        {'pregunta': 'a'*1501}):
            self.assertEqual(self.consultar(**cambios).status_code, 400)

    def test_acciones_y_preguntas_sin_ia(self):
        for accion in ('explicar', 'comparar', 'impacto'):
            d = self.consultar(accion=accion, pregunta='¿Por qué?').get_json()
            self.assertTrue(d['secciones'])
            self.assertIsNone(d['texto'])
        d = self.consultar(accion='preguntar', pregunta='¿Por qué cambia la temperatura?').get_json()
        self.assertEqual(d['secciones'], [])
        self.assertIsNone(d['texto'])
        self.assertIn('iniciar_lunyde.py', d['aviso'])

    def test_causas_y_pregunta_directa(self):
        d = self.consultar(variable='T2M').get_json()
        self.assertEqual([s['titulo'] for s in d['secciones']],
                         ['Qué está pasando', 'Posibles causas', 'Qué podría implicar'])
        self.assertIn('nubosidad', d['secciones'][1]['texto'])
        with patch('app.explicar_ia', return_value='Respuesta puntual') as ia:
            d = self.client.post('/api/diagnostico', json={**self.params,
                'accion': 'preguntar', 'pregunta': '¿Por qué cambia?'}).get_json()
            self.assertEqual(ia.call_args.args[1], '¿Por qué cambia?')
            self.assertEqual(d['secciones'], [])
            self.assertEqual(d['texto'], 'Respuesta puntual')
        with patch('app.explicar_ia', side_effect=TimeoutError):
            d = self.client.post('/api/diagnostico', json={**self.params,
                'accion': 'preguntar', 'pregunta': '¿Por qué cambia?'}).get_json()
            self.assertEqual(d['secciones'], [])
            self.assertIn('Intenta de nuevo', d['aviso'])

    def test_fallo_y_respuesta_proveedor(self):
        with patch('app.explicar_ia', side_effect=TimeoutError):
            d = self.client.post('/api/diagnostico', json=self.params).get_json()
            self.assertEqual(d['modo'], 'calculado')
            self.assertIn('No se pudo', d['aviso'])
        with patch('app.explicar_ia', return_value='Respuesta de prueba'):
            d = self.client.post('/api/diagnostico', json=self.params).get_json()
            self.assertEqual(d['modo'], 'ia')

    def test_correlacion_alinea_fechas_y_constantes(self):
        a = {f'{y}-{m:02}': (y-2000)*2+m for y in range(2001, 2005) for m in range(1, 13)}
        b = {k: v*3 for k, v in reversed(list(a.items())) if not k.startswith('2001')}
        r = correlacion(a, b)
        self.assertEqual(r['meses'], 36)
        self.assertEqual(r['r'], 1)
        self.assertIsNone(correlacion(a, {k: 1 for k in a}))

    def test_errores_de_api_sin_exponer_secretos(self):
        for estado, esperado in ((400, '400'), (401, '401'), (429, 'cuota'),
                                 (404, 'modelo'), (403, 'permisos'), (503, 'temporal')):
            cuerpo = b'{"error":{"message":"SECRETO_NO_MOSTRAR"}}'
            url = 'https://generativelanguage.googleapis.com/v1beta/models/prueba:generateContent'
            error = HTTPError(url, estado, 'error', {}, io.BytesIO(cuerpo))
            with patch.dict(os.environ, {'GEMINI_API_KEY': 'clave-ficticia-para-pruebas'}), \
                 patch('diagnostico.urlopen', side_effect=error):
                d = self.client.post('/api/diagnostico', json={**self.params,
                    'accion': 'preguntar', 'pregunta': '¿Por qué?'}).get_json()
                self.assertIn(esperado, d['aviso'])
                self.assertNotIn('SECRETO_NO_MOSTRAR', str(d))
                self.assertEqual(d['secciones'], [])


if __name__ == '__main__':
    unittest.main()
