# lunyde

## Diagnóstico personalizado

En el panel de resultados, pulsa **✦ Diagnóstico**. Consulta las seis variables
disponibles para la misma zona y período. Incluye explicación, posibles causas e implicaciones y comparación de
anomalías mensuales. Cambiar los filtros reinicia el contexto.

Sin credenciales funciona el diagnóstico estadístico, identificado como
**calculado con datos**. Para activar las interpretaciones y preguntas libres con IA,
crea una clave en [Google AI Studio](https://aistudio.google.com/apikey). Si Flask
está abierto, páralo con **Ctrl+C**. Desde la raíz del repositorio, ejecuta el
arranque en la terminal.

```powershell
python iniciar_lunyde.py
```

Cuando aparezca el aviso en Windows, copia la clave en Google AI Studio, vuelve
a la terminal y pulsa **Enter**. Abre [LUNYDE](http://127.0.0.1:8000/web/) cuando
arranque Flask. Usa `python iniciar_lunyde.py --nueva-clave` si quieres cambiar
una clave cargada. El programa conserva la clave en memoria durante la ejecución.
Al abrir el diagnóstico con IA configurada se envían al proveedor los resúmenes de
las seis variables, los filtros y las últimas preguntas de esa sesión. Si la IA
falla, se conserva el diagnóstico calculado y se muestra el aviso correspondiente.
Las preguntas libres reciben una respuesta directa. Si la IA no está disponible,
se muestra un aviso sin sustituir la respuesta por un diagnóstico completo. Las
fuentes se conservan en el contexto interno y no se enumeran en cada respuesta.
El servidor usa [Gemini](https://ai.google.dev/api/generate-content). También acepta
`GOOGLE_API_KEY` si `GEMINI_API_KEY` está vacía. El modelo predeterminado es
`gemini-3.1-flash-lite` y se puede cambiar con `GEMINI_MODEL`.

Las asociaciones son exploratorias, no causales; se calculan sobre meses comunes
después de quitar el promedio de cada mes calendario. No se elimina la tendencia
ni la autocorrelación. La proyección existente del gráfico es condicional.

Pruebas: `python -m unittest discover -s analisis -p "test_*.py"`.
