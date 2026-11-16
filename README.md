<h1 align="center">🛰️ GEODEX</h1>

<p align="center"><b>Earth System Trend Detective · Caribbean, Central America &amp; Mexico</b><br>
NASA Space Apps Challenge 2026 · Team LUNYDE</p>

<p align="center">🏆 <b>Winner · Best Global Connection</b> · NASA Space Apps Challenge 2026<br>
🏆 <b>Ganador · Mejor Conexión Global</b> · NASA Space Apps Challenge 2026</p>

<p align="center">
  <a href="https://www.youtube.com/watch?v=WfwC6cY5MAk">
    <img src="https://img.youtube.com/vi/WfwC6cY5MAk/maxresdefault.jpg" alt="GEODEX demo video" width="100%">
  </a>
  <br>
  <sub>▶️ Click the image to watch the demo on YouTube · Haz clic en la imagen para ver el video</sub>
</p>

---

## 🇺🇸 About

GEODEX is a web application that turns NASA Earth observation data into clear and easy to understand climate trends for 14 countries and 183 regions across the Caribbean, Central America and Mexico. Users search for their country or region on an interactive map and explore monthly data from 2001 to 2025 for temperature, precipitation, soil moisture (NASA POWER), vegetation health (NASA MODIS NDVI via Google Earth Engine) and river discharge (GEOGLOWS).

To act as a true "trend detective," GEODEX applies the seasonal Mann-Kendall test and Sen's slope to determine whether each change is statistically significant and how fast it is happening, then projects it to 2030 with a probable range. An AI assistant explains the results in plain Spanish, links peaks to real events such as El Niño, and cites its sources.

This matters because our region is among the most vulnerable to climate change, yet the data that proves it is technical, in English and hard to access. GEODEX makes it usable for students, teachers, farmers and local governments, helping communities understand their changing environment and make informed decisions.

## 🇩🇴 Acerca del proyecto

GEODEX es una aplicación web que convierte los datos de observación de la Tierra de la NASA en tendencias climáticas claras y fáciles de entender para 14 países y 183 regiones del Caribe, Centroamérica y México. Los usuarios buscan su país o región en un mapa interactivo y exploran datos mensuales de 2001 a 2025 de temperatura, lluvia, humedad del suelo (NASA POWER), salud de la vegetación (NDVI de NASA MODIS mediante Google Earth Engine) y caudal de los ríos (GEOGLOWS).

Para actuar como un verdadero "detective de tendencias", GEODEX aplica la prueba estacional de Mann-Kendall y la pendiente de Sen para determinar si cada cambio es estadísticamente significativo y qué tan rápido ocurre, y luego lo proyecta a 2030 con un rango probable. Un asistente con inteligencia artificial explica los resultados en español sencillo, relaciona los picos con eventos reales como El Niño y cita sus fuentes.

Esto es importante porque nuestra región es una de las más vulnerables al cambio climático, pero los datos que lo demuestran son técnicos, están en inglés y son difíciles de usar. GEODEX los hace accesibles para estudiantes, maestros, agricultores y gobiernos locales, y ayuda a las comunidades a entender cómo está cambiando su entorno y a tomar decisiones informadas.

---

## 📡 Data sources · Fuentes de datos

| Source · Fuente | Variables |
|---|---|
| [NASA POWER](https://power.larc.nasa.gov/) | Temperature, maximum temperature, precipitation, soil moisture · Temperatura, temperatura máxima, lluvia, humedad del suelo |
| [NASA MODIS MOD13A3](https://lpdaac.usgs.gov/products/mod13a3v061/) via [Google Earth Engine](https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD13A3) | Vegetation health (NDVI) · Salud de la vegetación (NDVI) |
| [GEOGLOWS](https://geoglows.ecmwf.int/) | River discharge · Caudal de los ríos |
| [geoBoundaries](https://www.geoboundaries.org/) | Country and region boundaries · Límites de países y regiones |

## 🛠️ Tech stack · Tecnologías

- **Backend:** Python, Flask, pymannkendall, NumPy, SciPy, Gunicorn
- **Frontend:** HTML, CSS, JavaScript, Leaflet, Plotly
- **AI · IA:** Google Gemini API with Google Search grounding
- **Deploy:** Render

---

## 💻 Cómo ejecutarlo · How to run

```powershell
pip install -r requirements.txt
python iniciar_lunyde.py
```

Abre [http://127.0.0.1:8000/web/](http://127.0.0.1:8000/web/) cuando arranque Flask.

### Asistente con IA (opcional)

Sin credenciales funciona el diagnóstico estadístico, identificado como
**calculado con datos**. Para activar las interpretaciones y preguntas libres con IA,
crea una clave en [Google AI Studio](https://aistudio.google.com/apikey). Si Flask
está abierto, páralo con **Ctrl+C** y ejecuta `python iniciar_lunyde.py` desde la
raíz del repositorio.

Cuando aparezca el aviso en Windows, copia la clave en Google AI Studio, vuelve
a la terminal y pulsa **Enter**. Usa `python iniciar_lunyde.py --nueva-clave` si
quieres cambiar una clave cargada. El programa conserva la clave en memoria durante
la ejecución; **nunca se guarda en el código**.

Al usar la IA se envían al proveedor los resúmenes de las seis variables, los
filtros y las últimas preguntas de esa sesión. Si la IA falla, se conserva el
diagnóstico calculado y se muestra el aviso correspondiente. El servidor usa
[Gemini](https://ai.google.dev/api/generate-content); también acepta
`GOOGLE_API_KEY` si `GEMINI_API_KEY` está vacía. El modelo predeterminado es
`gemini-3.1-flash-lite` y se puede cambiar con `GEMINI_MODEL`.

Las asociaciones entre variables son exploratorias, no causales; se calculan sobre
meses comunes después de quitar el promedio de cada mes calendario. La proyección
a 2030 es condicional: supone que la tendencia actual continúa.

### Pruebas · Tests

```powershell
python -m unittest discover -s analisis -p "test_*.py"
```

---

## © License · Licencia

**Copyright © 2026 Team LUNYDE. All rights reserved.**

This project is the property of Team LUNYDE. The code is public only so it can be viewed and evaluated. You may not copy, modify, distribute, publish or use it, in whole or in part, without written permission from the team. See [LICENSE](LICENSE).

**Copyright © 2026 Equipo LUNYDE. Todos los derechos reservados.**

Este proyecto es propiedad del equipo LUNYDE. El código es público solo para que pueda verse y evaluarse. No se permite copiarlo, modificarlo, distribuirlo, publicarlo ni usarlo, total o parcialmente, sin permiso escrito del equipo. Ver [LICENSE](LICENSE).

The data from NASA POWER, NASA MODIS, GEOGLOWS and geoBoundaries belongs to their respective owners and keeps its own terms of use. · Los datos de NASA POWER, NASA MODIS, GEOGLOWS y geoBoundaries pertenecen a sus respectivos dueños y mantienen sus propias condiciones de uso.

---

<p align="center">Made with 💙 by <b>Team LUNYDE</b> · NASA Space Apps Challenge 2026</p>
