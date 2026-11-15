"""Descarga caudal diario de GEOGLOWS y genera series mensuales por zona."""

import argparse
import csv
import hashlib
import json
import math
import tempfile
import time
from collections import defaultdict
from datetime import date
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen


CARPETA = Path(__file__).resolve().parent
GEO = CARPETA / "geo"
CACHE = CARPETA / "cache_geoglows"
DESDE, HASTA = date(2001, 1, 1), date(2025, 12, 31)
RED = (
    "https://livefeeds3.arcgis.com/arcgis/rest/services/GEOGLOWS/"
    "GlobalWaterModel_Medium/MapServer/0/query"
)
HISTORICO = "https://geoglows.ecmwf.int/api/v2/retrospectivedaily"


def leer_zonas():
    for archivo in sorted(GEO.glob("geoBoundaries-*-ADM[01]_simplified.geojson")):
        _, pais, nivel = archivo.stem.removesuffix("_simplified").split("-")
        if nivel == "ADM0":
            yield from leer_limites(archivo, pais, "pais")
        else:
            nivel = "provincia" if pais == "DOM" else "region"
            yield from leer_limites(archivo, pais, nivel)

    yield from leer_limites(GEO / "DOM-regiones.geojson", "DOM", "region")
    yield from leer_limites(GEO / "pr.json", "PRI", "pais")


def leer_limites(archivo, pais, nivel):
    geojson = json.loads(archivo.read_text(encoding="utf-8"))
    for lugar in geojson["features"]:
        yield lugar["properties"]["shapeName"], pais, nivel, lugar["geometry"]


def descargar(url):
    for intento in range(3):
        try:
            with urlopen(url, timeout=60) as respuesta:
                return respuesta.read().decode("utf-8-sig")
        except HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or intento == 2:
                raise RuntimeError(f"HTTP {error.code} al consultar {url.split('?')[0]}") from error
        except (URLError, TimeoutError) as error:
            if intento == 2:
                raise RuntimeError(f"No se pudo conectar con {url.split('?')[0]}: {error}") from error
        time.sleep(2 ** intento)


def guardar(archivo, contenido):
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", dir=archivo.parent, delete=False
    ) as temporal:
        ruta_temporal = Path(temporal.name)
        temporal.write(contenido)
    try:
        ruta_temporal.replace(archivo)
    finally:
        ruta_temporal.unlink(missing_ok=True)


def dentro_del_anillo(x, y, anillo):
    dentro = False
    x1, y1 = anillo[-1][:2]
    for punto in anillo:
        x2, y2 = punto[:2]
        if (y1 > y) != (y2 > y):
            cruce = x1 + (x2 - x1) * (y - y1) / (y2 - y1)
            if x < cruce:
                dentro = not dentro
        x1, y1 = x2, y2
    return dentro


def dentro_de_zona(punto, poligonos):
    return any(
        dentro_del_anillo(*punto, exterior)
        and not any(dentro_del_anillo(*punto, hueco) for hueco in huecos)
        for exterior, *huecos in poligonos
    )


def poligonos_de(geometria):
    coordenadas = geometria["coordinates"]
    return [coordenadas] if geometria["type"] == "Polygon" else coordenadas


def punto_medio(caminos):
    # Usa el punto medio del tramo por longitud, incluso si tiene varias partes.
    segmentos = [
        (a, b, math.dist(a[:2], b[:2]))
        for camino in caminos
        for a, b in zip(camino, camino[1:])
        if a[:2] != b[:2]
    ]
    restante = sum(largo for _, _, largo in segmentos) / 2
    for a, b, largo in segmentos:
        if restante <= largo:
            fraccion = restante / largo
            return tuple(a[i] + (b[i] - a[i]) * fraccion for i in (0, 1))
        restante -= largo
    return None


def archivo_zona(geometria):
    clave = hashlib.sha256(json.dumps(geometria).encode("utf-8")).hexdigest()
    return CACHE / f"zona_{clave}.json"


def buscar_tramo(geometria):
    archivo = archivo_zona(geometria)
    if archivo.exists():
        return json.loads(archivo.read_text(encoding="utf-8"))

    poligonos = poligonos_de(geometria)
    xs, ys = zip(*(punto[:2] for exterior, *_ in poligonos for punto in exterior))
    parametros = {
        "f": "json",
        "where": "comid > 0 AND upstreamarea > 0",
        "geometry": f"{min(xs)},{min(ys)},{max(xs)},{max(ys)}",
        "geometryType": "esriGeometryEnvelope",
        "spatialRel": "esriSpatialRelIntersects",
        "inSR": 4326,
        "outSR": 4326,
        "outFields": "comid,upstreamarea",
        "returnGeometry": "true",
        "orderByFields": "upstreamarea DESC, comid ASC, objectid ASC",
        "resultRecordCount": 100,
        "resultOffset": 0,
    }
    # El rectángulo limita la consulta. El GeoJSON decide si el tramo cae en la zona.
    while True:
        pagina = json.loads(descargar(f"{RED}?{urlencode(parametros)}"))
        if "features" not in pagina:
            raise RuntimeError(f"La consulta de tramos falló: {pagina.get('error', pagina)}")
        for tramo in pagina["features"]:
            punto = punto_medio(tramo.get("geometry", {}).get("paths", []))
            if punto is not None and dentro_de_zona(punto, poligonos):
                atributos = tramo["attributes"]
                elegido = {
                    "river_id": atributos["comid"],
                    "area_drenaje_m2": atributos["upstreamarea"],
                    "punto_del_tramo": punto,
                }
                guardar(archivo, json.dumps(elegido))
                return elegido
        if not pagina.get("exceededTransferLimit"):
            guardar(archivo, "null")
            return None
        parametros["resultOffset"] += parametros["resultRecordCount"]


def serie_mensual(contenido):
    filas = csv.DictReader(contenido.splitlines())
    columnas = filas.fieldnames or []
    fecha = next((c for c in columnas if c.strip().lower() in {"datetime", "date", "time"}), None)
    caudal = next(
        (c for c in columnas if c.strip().lower() in {"streamflow", "flow", "discharge", "qout"}),
        None,
    )
    if fecha and caudal is None and len(columnas) == 2:
        caudal = next(c for c in columnas if c != fecha)
    if fecha is None or caudal is None:
        raise ValueError(f"No se reconocieron las columnas del histórico: {columnas}")

    dias = {}
    for fila in filas:
        dia = date.fromisoformat(fila[fecha][:10])
        if DESDE <= dia <= HASTA:
            valor = float(fila[caudal])
            if dia in dias or not math.isfinite(valor) or valor < 0:
                raise ValueError(f"Caudal inválido o repetido para {dia}")
            dias[dia] = valor

    esperados = (HASTA - DESDE).days + 1
    if len(dias) != esperados:
        raise ValueError(f"histórico incompleto ({len(dias)} de {esperados} días)")

    meses = defaultdict(list)
    for dia, valor in sorted(dias.items()):
        meses[dia.isoformat()[:7]].append(valor)
    return [
        {"fecha": mes, "valor": round(math.fsum(valores) / len(valores), 4)}
        for mes, valores in meses.items()
    ]


def archivo_serie(river_id):
    return CACHE / f"{river_id}_{DESDE.year}_{HASTA.year}.csv"


def pedir_serie(river_id):
    archivo = archivo_serie(river_id)
    if archivo.exists():
        return serie_mensual(archivo.read_text(encoding="utf-8"))

    contenido = descargar(f"{HISTORICO}/{river_id}?format=csv")
    serie = serie_mensual(contenido)
    guardar(archivo, contenido)
    return serie


def tramos_descargados():
    tramos = {}
    for archivo in CACHE.glob("zona_*.json"):
        tramo = json.loads(archivo.read_text(encoding="utf-8"))
        if tramo and archivo_serie(tramo["river_id"]).is_file():
            tramos[tramo["river_id"]] = tramo
    return sorted(tramos.values(), key=lambda tramo: (-tramo["area_drenaje_m2"], tramo["river_id"]))


def buscar_tramo_descargado(geometria, tramos):
    archivo = archivo_zona(geometria)
    if archivo.is_file():
        tramo = json.loads(archivo.read_text(encoding="utf-8"))
        if tramo is None or archivo_serie(tramo["river_id"]).is_file():
            return tramo

    # Una provincia ya descargada puede aportar un tramo a su región de planificación.
    poligonos = poligonos_de(geometria)
    return next(
        (tramo for tramo in tramos if dentro_de_zona(tramo["punto_del_tramo"], poligonos)),
        None,
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pais", type=str.upper, help="Código de país, por ejemplo DOM")
    parser.add_argument("--zona", help="Nombre en los GeoJSON, por ejemplo El Valle o San Juan")
    parser.add_argument("--solo-cache", action="store_true", help="Armar el JSON con las descargas locales")
    args = parser.parse_args()
    seleccion = [
        zona for zona in leer_zonas()
        if (not args.pais or zona[1] == args.pais)
        and (not args.zona or zona[0].casefold() == args.zona.casefold())
    ]
    if not seleccion:
        parser.error("Ninguna zona de los GeoJSON coincide con los filtros.")

    CACHE.mkdir(exist_ok=True)
    salida = CARPETA / "caudal.json"
    datos = {"series": {}, "zonas": {}}
    if salida.exists():
        datos = json.loads(salida.read_text(encoding="utf-8"))
    series_por_tramo = {}
    tramos = tramos_descargados() if args.solo_cache else []
    nuevas = 0
    errores = 0

    for nombre, pais, nivel, geometria in seleccion:
        try:
            tramo = (
                buscar_tramo_descargado(geometria, tramos)
                if args.solo_cache else buscar_tramo(geometria)
            )
            if tramo is None:
                motivo = "sin serie en la caché" if args.solo_cache else "sin tramo en la red consultada"
                print(f"{nombre} ({pais}): {motivo}.")
                continue
            river_id = tramo["river_id"]
            if river_id not in series_por_tramo:
                series_por_tramo[river_id] = pedir_serie(river_id)
        except RuntimeError as error:
            errores += 1
            print(f"{nombre} ({pais}): {error}")
            # Publicar lo descargado antes de una caída de red.
            break
        except ValueError as error:
            errores += 1
            print(f"{nombre} ({pais}): {error}")
            continue
        serie = series_por_tramo[river_id]
        datos["series"][nombre] = {"CAUDAL": serie}
        datos["zonas"][nombre] = {"pais": pais, "nivel": nivel, **tramo}
        nuevas += 1
        print(f"{nombre} ({pais}): tramo {river_id}, {len(serie)} meses.")

    if nuevas:
        guardar(salida, json.dumps(datos, ensure_ascii=False))
        print(f"Listo: {nuevas} zonas actualizadas en {salida.name}.")
    return 1 if errores or not nuevas else 0


if __name__ == "__main__":
    raise SystemExit(main())
