"""
Descarga la VEGETACIÓN (NDVI de MODIS, MOD13A3 v6.1, mensual a 1 km) con Google Earth Engine
y genera vegetacion.json con el mismo formato que caudal.json:

    {"series": {zona: {"NDVI": [{"fecha": "2001-01", "valor": 0.7123}, ...]}}}

Usa las MISMAS zonas que series.json (países y regiones de los GeoJSON de la carpeta geo/).
Earth Engine calcula el promedio de NDVI dentro de cada zona en sus servidores:
no se descargan imágenes, solo los números (tarda unos minutos).

Uso:
    pip install earthengine-api shapely
    earthengine authenticate          (solo la primera vez, abre el navegador)
    python descargar_vegetacion.py --proyecto ID_DE_TU_PROYECTO
"""
import argparse
import json
import time
from pathlib import Path

import ee
from shapely.geometry import shape, mapping

CARPETA = Path(__file__).resolve().parent
GEO = CARPETA / "geo"
SALIDA = CARPETA / "vegetacion.json"

DESDE, HASTA = 2001, 2025
PAISES = ["CUB", "DOM", "HTI", "JAM", "BHS",            # Caribe
          "GTM", "BLZ", "HND", "SLV", "NIC", "CRI", "PAN",   # Centroamérica
          "MEX"]                                             # México
REGIONES_ESPECIALES = {"DOM": "DOM-regiones.geojson"}   # igual que descargar_power.py
SOLO_PAIS = {"pr.json": "PRI"}
SIMPLIFICAR = 0.005   # grados (~500 m): achica los polígonos para que la petición no sea enorme


def leer(archivo):
    return json.loads((GEO / archivo).read_text(encoding="utf-8"))["features"]


def zonas_de_la_app():
    """Devuelve {nombre: geometría GeoJSON} solo para las zonas que existen en zonas.json."""
    en_app = set(json.loads((CARPETA / "zonas.json").read_text(encoding="utf-8")))
    zonas = {}

    def agregar(feature):
        nombre = feature["properties"]["shapeName"]
        if nombre in en_app and nombre not in zonas:
            geom = shape(feature["geometry"]).simplify(SIMPLIFICAR, preserve_topology=True)
            zonas[nombre] = json.loads(json.dumps(mapping(geom)))  # tuplas -> listas

    for iso in PAISES:
        for f in leer(f"geoBoundaries-{iso}-ADM0_simplified.geojson"):
            agregar(f)
        for f in leer(REGIONES_ESPECIALES.get(iso, f"geoBoundaries-{iso}-ADM1_simplified.geojson")):
            agregar(f)
    for archivo in SOLO_PAIS:
        for f in leer(archivo):
            agregar(f)

    faltan = en_app - set(zonas)
    if faltan:
        print(f"⚠️ Zonas de la app sin polígono (se saltan): {sorted(faltan)}")
    return zonas


def coleccion_zonas(zonas):
    return ee.FeatureCollection([
        ee.Feature(ee.Geometry(geom, None, False), {"zona": nombre})
        for nombre, geom in zonas.items()
    ])


def ndvi_de_un_anio(anio, fc):
    """Promedio de NDVI por zona para los 12 meses de un año -> {(zona, 'AAAA-MM'): valor}."""
    imagenes = (ee.ImageCollection("MODIS/061/MOD13A3")
                .filterDate(f"{anio}-01-01", f"{anio + 1}-01-01")
                .select("NDVI"))

    def por_imagen(img):
        fecha = img.date().format("YYYY-MM")
        return img.reduceRegions(
            collection=fc, reducer=ee.Reducer.mean(), scale=1000, tileScale=4
        ).map(lambda f: f.set("fecha", fecha))

    tabla = imagenes.map(por_imagen).flatten()
    filas = tabla.select(["zona", "fecha", "mean"], retainGeometry=False).getInfo()["features"]

    resultado = {}
    for fila in filas:
        p = fila["properties"]
        if p.get("mean") is not None:
            resultado[(p["zona"], p["fecha"])] = round(p["mean"] * 0.0001, 4)   # escala de MODIS
    return resultado


def rellenar_huecos(fechas, valores):
    """Si falta algún mes (nubes), lo rellena interpolando entre los meses vecinos."""
    conocidos = [i for i, v in enumerate(valores) if v is not None]
    if not conocidos:
        return None
    for i, v in enumerate(valores):
        if v is None:
            antes = max((k for k in conocidos if k < i), default=None)
            despues = min((k for k in conocidos if k > i), default=None)
            if antes is None:
                valores[i] = valores[despues]
            elif despues is None:
                valores[i] = valores[antes]
            else:
                peso = (i - antes) / (despues - antes)
                valores[i] = round(valores[antes] + (valores[despues] - valores[antes]) * peso, 4)
    return valores


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--proyecto", required=True, help="ID del proyecto de Google Cloud registrado en Earth Engine")
    args = parser.parse_args()

    ee.Initialize(project=args.proyecto)
    zonas = zonas_de_la_app()
    fc = coleccion_zonas(zonas)
    print(f"{len(zonas)} zonas · NDVI mensual {DESDE}–{HASTA}")

    datos = {}
    for anio in range(DESDE, HASTA + 1):
        for intento in range(3):
            try:
                datos.update(ndvi_de_un_anio(anio, fc))
                print(f"  {anio} listo")
                break
            except ee.EEException as error:
                print(f"  {anio}: reintento {intento + 1} ({error})")
                time.sleep(5)
        else:
            raise SystemExit(f"No se pudo descargar {anio}. Vuelve a correr el script.")

    fechas = [f"{a}-{m:02d}" for a in range(DESDE, HASTA + 1) for m in range(1, 13)]
    series = {}
    for nombre in zonas:
        valores = [datos.get((nombre, f)) for f in fechas]
        faltan = sum(v is None for v in valores)
        if faltan > len(fechas) * 0.1:   # más de 10 % sin dato = zona demasiado pequeña o nublada
            print(f"  {nombre}: {faltan} meses sin dato, se omite")
            continue
        if faltan:
            print(f"  {nombre}: {faltan} meses rellenados por interpolación")
        valores = rellenar_huecos(fechas, valores)
        series[nombre] = {"NDVI": [{"fecha": f, "valor": v} for f, v in zip(fechas, valores)]}

    SALIDA.write_text(json.dumps({"series": series}, ensure_ascii=False), encoding="utf-8")
    print(f"Listo: {len(series)} zonas en {SALIDA.name}")


if __name__ == "__main__":
    main()