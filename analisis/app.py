import json
from pathlib import Path

from flask import Flask, jsonify, request
from analizar import analizar
from diagnostico import contexto, diagnostico_local, explicar_ia, mensaje_error_ia


app = Flask(__name__)
VARIABLES_DISPONIBLES = ("T2M", "T2M_MAX", "PRECTOTCORR", "GWETROOT", "CAUDAL", "NDVI")
MENSAJE_VARIABLES = "La variable debe ser una de las siguientes: T2M, T2M_MAX, PRECTOTCORR, GWETROOT, CAUDAL, NDVI."
ruta_datos = Path(__file__).parent.parent / "datos" / "series.json"
ruta_zonas = Path(__file__).parent.parent / "datos" / "zonas.json"

# Leer las series al iniciar el servidor.

with open(ruta_datos, "r", encoding="utf-8") as archivo:
    series = json.load(archivo)

ruta_caudal = Path(__file__).parent.parent / "datos" / "caudal.json"
if ruta_caudal.exists():
    with open(ruta_caudal, "r", encoding="utf-8") as archivo:
        datos_caudal = json.load(archivo)

    for zona, variables_caudal in datos_caudal.get("series", {}).items():
        caudal = variables_caudal.get("CAUDAL", [])

        if zona in series and any(float(dato.get("valor", 0)) > 0 for dato in caudal):
            series[zona]["CAUDAL"] = caudal

ruta_vegetacion = Path(__file__).parent.parent / "datos" / "vegetacion.json"            

with open(ruta_vegetacion, "r", encoding="utf-8") as archivo:
    datos_vegetacion = json.load(archivo)   
for zona, variables_vegetacion in datos_vegetacion.get("series", {}).items():
    ndvi = variables_vegetacion.get("NDVI", [])

    if zona in series: 
        series[zona]["NDVI"] = ndvi

with open(ruta_zonas, "r", encoding="utf-8") as archivo:
    zonas = json.load(archivo)

# Permitir que la web consulte este servidor durante la demo local.
@app.after_request
def agregar_cors(respuesta):
    respuesta.headers["Access-Control-Allow-Origin"] = "*"
    respuesta.headers["Access-Control-Allow-Headers"] = "Content-Type"
    respuesta.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return respuesta


@app.get("/api/analisis")
def api_analisis():
    zona = request.args.get("zona")
    variable = request.args.get("variable", "T2M").upper()
    desde = request.args.get("desde", "2001")
    hasta = request.args.get("hasta", "2025")

    if not zona:
        return jsonify({"error": "Falta indicar la zona."}), 400
    if variable not in VARIABLES_DISPONIBLES:
        return jsonify({"error": MENSAJE_VARIABLES}), 400
    if zona not in series:
        return jsonify({"error": f"No hay datos para la zona {zona}."}), 404

    serie = series[zona].get(variable, [])
    if not serie:
        return jsonify ({"error": f"No hay datos de {variable.lower()} para {zona}."}), 404
    
    try:
        resultado = analizar(
            serie,
            desde,
            hasta,
            zona=zona,
            variable=variable,
        )
    except (ValueError, TypeError, KeyError) as error:
        return jsonify({"error": str(error)}), 400

    return jsonify(resultado)


@app.get("/api/mapa")
def api_mapa():
    pais = request.args.get("pais", "").upper()
    variable = request.args.get("variable", "T2M").upper()
    desde = request.args.get("desde", "2001")
    hasta = request.args.get("hasta", "2025")

    if not pais:
        return jsonify({"error": "Falta indicar el país."}), 400
    if variable not in VARIABLES_DISPONIBLES:
        return jsonify({"error": MENSAJE_VARIABLES}), 400

    resultados = {}
    for zona, variables in series.items():
        info_zona = zonas.get(zona, {})

        if info_zona.get("pais") != pais or info_zona.get("nivel") != "region":
             continue

        serie = variables.get(variable, [])
        try:
            analisis_zona = analizar(
                serie,
                desde,
                hasta,
                zona=zona,
                variable=variable,
            )
        except (ValueError, TypeError, KeyError):
            # Omitir zonas que no tienen una serie suficiente para analizar.
            continue

        resultados[zona] = {
            "pendiente_decada": analisis_zona["pendiente_decada"],
            "significativo": analisis_zona["significativo"],
        }

    return jsonify(resultados)


@app.post('/api/diagnostico')
def api_diagnostico():
    datos = request.get_json(silent=True)
    if not isinstance(datos, dict):
        return jsonify(error='Se requiere un objeto JSON.'), 400
    zona, variable = datos.get('zona'), datos.get('variable')
    accion = datos.get('accion', 'diagnostico')
    if not isinstance(zona, str) or zona not in series:
        return jsonify(error='Zona desconocida.'), 400
    if not isinstance(variable, str) or variable not in VARIABLES_DISPONIBLES:
        return jsonify(error=MENSAJE_VARIABLES), 400
    if accion not in ('diagnostico', 'explicar', 'comparar', 'impacto', 'preguntar'):
        return jsonify(error='Acción no válida.'), 400
    pregunta = datos.get('pregunta', '')
    historial = datos.get('historial', [])
    if not isinstance(pregunta, str) or len(pregunta) > 1500:
        return jsonify(error='La pregunta admite hasta 1500 caracteres.'), 400
    if not isinstance(historial, list) or len(historial) > 8 or any(
        not isinstance(m, dict) or m.get('role') not in ('user', 'assistant') or
        not isinstance(m.get('content'), str) or len(m['content']) > 6000 for m in historial
    ):
        return jsonify(error='Historial no válido.'), 400
    try:
        desde, hasta = int(datos.get('desde', 2001)), int(datos.get('hasta', 2025))
        if not 2001 <= desde < hasta <= 2025 or hasta-desde < 5:
            raise ValueError('Elige al menos cinco años entre 2001 y 2025.')
        c = contexto(series, zonas, zona, variable, desde, hasta)
    except (ValueError, TypeError) as e:
        return jsonify(error=str(e)), 400
    secciones = diagnostico_local(c, accion)
    preguntas = {'diagnostico': 'Genera un diagnóstico breve con tres apartados: qué pasa, posibles causas y posibles implicaciones. Vincula las hipótesis con los datos de las variables disponibles.',
                 'explicar': 'Explica el resultado de la variable principal.',
                 'comparar': 'Compara la variable principal con las demás.',
                 'impacto': 'Explica posibles causas y sus posibles implicaciones para la zona y período seleccionados, considerando la variable principal y las demás disponibles. Distingue lo observado de los efectos posibles; no afirmes daños, causas ni impactos locales que los datos no demuestran.'}
    texto = None
    try:
        texto = explicar_ia(c, pregunta if accion == 'preguntar' else preguntas[accion], historial)
    except Exception as error:
        # Nunca exponer claves ni detalles internos del proveedor.
        aviso = mensaje_error_ia(error)
    else:
        aviso = ('Interpretación con Gemini basada en los datos del sistema.' if texto else
                 'Falta la clave de Gemini. Arranca LUNYDE con iniciar_lunyde.py para cargarla.')
    if not texto and accion != 'preguntar':
        aviso += ' Se muestra el diagnóstico calculado con datos.'
    return jsonify(contexto=c, secciones=secciones, texto=texto,
                   modo='ia' if texto else 'calculado', aviso=aviso)


if __name__ == "__main__":
    app.run(debug=True)
