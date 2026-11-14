import json
from pathlib import Path

from flask import Flask, jsonify, request
from analizar import analizar


app = Flask(__name__)
VARIABLES_DISPONIBLES = ("PRECIPITACION", "TEMP_AIRE", "SST")
MENSAJE_VARIABLES = "La variable debe ser PRECIPITACION, TEMP_AIRE o SST."
ruta_datos = Path(__file__).with_name("series.json")

# Leer las series al iniciar el servidor.

with open(ruta_datos, "r", encoding="utf-8") as archivo:
    series = json.load(archivo)


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
    variable = request.args.get("variable", "PRECIPITACION").upper()
    desde = request.args.get("desde", "2001")
    hasta = request.args.get("hasta", "2024")

    if not zona:
        return jsonify({"error": "Falta indicar la zona."}), 400
    if variable not in VARIABLES_DISPONIBLES:
        return jsonify({"error": MENSAJE_VARIABLES}), 400
    if zona not in series:
        return jsonify({"error": f"No hay datos para la zona {zona}."}), 404

    serie = series[zona].get(variable, [])
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
    variable = request.args.get("variable", "PRECIPITACION").upper()
    desde = request.args.get("desde", "2001")
    hasta = request.args.get("hasta", "2024")

    if variable not in VARIABLES_DISPONIBLES:
        return jsonify({"error": MENSAJE_VARIABLES}), 400

    resultados = {}
    for zona, variables in series.items():
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