"""
Descarga de NASA POWER las variables de todos los países y regiones,
y genera series.json (formato del contrato) y zonas.json (país y nivel de cada zona).

Uso:  pip install requests shapely
      python descargar_power.py
"""
import json
import math
import time
import calendar
from pathlib import Path

import requests
from shapely.geometry import shape, Point

VARIABLES = ["T2M", "T2M_MAX", "PRECTOTCORR", "GWETROOT"]
DESDE, HASTA = 2001, 2025
PASO_LAT, PASO_LON = 0.5, 0.625   # cuadrícula de POWER (MERRA-2)
MIN_REGIONES_DISTINTAS = 0.6      # menos de 60 % de regiones distintas = no se usan

PAISES = ["CUB", "DOM", "HTI", "JAM", "BHS",            # Caribe
          "GTM", "BLZ", "HND", "SLV", "NIC", "CRI", "PAN",   # Centroamérica
          "MEX"]                                             # México
SOLO_PAIS = {"pr.json": "PRI"}
REGIONES_ESPECIALES = {"DOM": "DOM-regiones.geojson"}

CARPETA_GEO = Path("geo")
CACHE = Path("cache_power")
URL = "https://power.larc.nasa.gov/api/temporal/monthly/point"


def leer(archivo):
    return json.loads((CARPETA_GEO / archivo).read_text(encoding="utf-8"))["features"]


def celda(lon, lat):
    return (round(round(lon / PASO_LON) * PASO_LON, 4),
            round(round(lat / PASO_LAT) * PASO_LAT, 4))


def celdas_dentro(geom):
    minx, miny, maxx, maxy = geom.bounds
    celdas = set()
    lat = math.floor(miny / PASO_LAT) * PASO_LAT
    while lat <= maxy + PASO_LAT:
        lon = math.floor(minx / PASO_LON) * PASO_LON
        while lon <= maxx + PASO_LON:
            if geom.contains(Point(lon, lat)):
                celdas.add(celda(lon, lat))
            lon += PASO_LON
        lat += PASO_LAT
    if not celdas:  # zona más pequeña que una celda: la celda donde cae
        p = geom.representative_point()
        celdas.add(celda(p.x, p.y))
    return frozenset(celdas)


def pedir_celda(lon, lat):
    archivo = CACHE / f"{lat}_{lon}.json"
    if archivo.exists():
        return json.loads(archivo.read_text())

    params = {
        "parameters": ",".join(VARIABLES), "community": "AG",
        "latitude": lat, "longitude": lon,
        "start": DESDE, "end": HASTA, "format": "JSON",
    }
    for intento in range(3):
        try:
            r = requests.get(URL, params=params, timeout=120)
            r.raise_for_status()
            datos = r.json()["properties"]["parameter"]
            archivo.write_text(json.dumps(datos))
            time.sleep(1)
            return datos
        except requests.RequestException as e:
            print(f"    reintento {intento + 1} ({lat}, {lon}): {e}")
            time.sleep(5)
    raise RuntimeError(f"No se pudo descargar la celda ({lat}, {lon})")


def convertir(variable, anio, mes, valor):
    if variable == "PRECTOTCORR":  # mm/día -> mm/mes
        return valor * calendar.monthrange(anio, mes)[1]
    if variable == "GWETROOT":     # 0-1 -> %
        return valor * 100
    return valor


def serie(celdas):
    datos = [pedir_celda(lon, lat) for lon, lat in celdas]
    resultado = {}
    for variable in VARIABLES:
        puntos = []
        for anio in range(DESDE, HASTA + 1):
            for mes in range(1, 13):  # el mes 13 es el promedio anual: se ignora
                clave = f"{anio}{mes:02d}"
                valores = [d[variable][clave] for d in datos
                           if d[variable].get(clave, -999) != -999]
                if valores:
                    promedio = sum(valores) / len(valores)
                    puntos.append({"fecha": f"{anio}-{mes:02d}",
                                   "valor": round(convertir(variable, anio, mes, promedio), 4)})
        resultado[variable] = puntos
    return resultado


def main():
    CACHE.mkdir(exist_ok=True)
    zonas = {}  # nombre -> {"pais", "nivel", "celdas"}

    def agregar(nombre, iso, nivel, celdas):
        if nombre in zonas:
            print(f"  ⚠️ nombre repetido: '{nombre}' ({iso}) ya existe en {zonas[nombre]['pais']}")
            return
        zonas[nombre] = {"pais": iso, "nivel": nivel, "celdas": celdas}

    print("== Revisando zonas ==")
    for iso in PAISES:
        for f in leer(f"geoBoundaries-{iso}-ADM0_simplified.geojson"):
            agregar(f["properties"]["shapeName"], iso, "pais", celdas_dentro(shape(f["geometry"])))

        regiones = [(f["properties"]["shapeName"], celdas_dentro(shape(f["geometry"])))
                    for f in leer(REGIONES_ESPECIALES.get(iso, f"geoBoundaries-{iso}-ADM1_simplified.geojson"))]
        distintas = len({c for _, c in regiones})
        proporcion = distintas / len(regiones)

        if proporcion >= MIN_REGIONES_DISTINTAS:
            print(f"{iso}: regiones SÍ ({distintas} de {len(regiones)} con datos distintos)")
            for nombre, celdas in regiones:
                agregar(nombre, iso, "region", celdas)
            grupos = {}
            for nombre, celdas in regiones:
                grupos.setdefault(celdas, []).append(nombre)
            for nombres in grupos.values():
                if len(nombres) > 1:
                    print(f"    mismos datos: {', '.join(nombres)}")
        else:
            print(f"{iso}: regiones NO ({distintas} de {len(regiones)} distintas, muy pocas)")

    for archivo, iso in SOLO_PAIS.items():
        for f in leer(archivo):
            agregar(f["properties"]["shapeName"], iso, "pais", celdas_dentro(shape(f["geometry"])))
        print(f"{iso}: solo país")

    todas = sorted(set().union(*(z["celdas"] for z in zonas.values())))
    faltan = [c for c in todas if not (CACHE / f"{c[1]}_{c[0]}.json").exists()]
    print(f"\n== Descargando {len(faltan)} de {len(todas)} celdas "
          f"(~{len(faltan) * 4 // 60 + 1} min) ==")
    for i, (lon, lat) in enumerate(faltan, 1):
        print(f"  {i}/{len(faltan)}  ({lat}, {lon})")
        pedir_celda(lon, lat)

    print("\n== Armando series.json ==")
    series = {nombre: serie(z["celdas"]) for nombre, z in zonas.items()}
    info = {nombre: {"pais": z["pais"], "nivel": z["nivel"]} for nombre, z in zonas.items()}

    Path("series.json").write_text(json.dumps(series, ensure_ascii=False), encoding="utf-8")
    Path("zonas.json").write_text(json.dumps(info, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Listo: {len(series)} zonas · {len(VARIABLES)} variables · series.json y zonas.json")


if __name__ == "__main__":
    main()