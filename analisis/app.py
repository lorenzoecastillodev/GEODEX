import json
from pathlib import Path

from flask import Flask, jsonify, request
from analizar import analizar


app = Flask(__name__)
VARIABLES_DISPONIBLES = ("T2M", "T2M_MAX", "PRECTOTCORR", "GWETROOT", "CAUDAL")
MENSAJE_VARIABLES = "La variable debe ser una de las siguientes: T2M, T2M_MAX, PRECTOTCORR, GWETROOT, CAUDAL."
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

with open(ruta_zonas, "r", encoding="utf-8") as archivo:
    zonas = json.load(archivo)

# Permitir que la web consulte este servidor durante la demo local.
@app.after_request
def agregar_cors(respuesta):
    respuesta.headers["Access-Control-Allow-Origin"] = "*"
    respuesta.headers["Access-Control-Allow-Headers"] = "Content-Type"
    respuesta.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
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


if __name__ == "__main__":
    app.run(debug=True)