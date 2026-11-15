"""
Baja de geoBoundaries los GeoJSON simplificados de países (ADM0) y regiones (ADM1).

Uso:  pip install requests
      python bajar_geo.py

Si una región de Centroamérica se llama igual que otra zona (ej: "Colón" en Honduras
y en Panamá, o el distrito "Belize" y el país Belize), se le agrega el país entre
paréntesis: "Colón (Honduras)". Así ningún nombre se repite en series.json.
"""
import json
from collections import Counter
from pathlib import Path

import requests

CARIBE = ["CUB", "DOM", "HTI", "JAM", "BHS"]
CENTROAMERICA = ["GTM", "BLZ", "HND", "SLV", "NIC", "CRI", "PAN"]
PAISES = CARIBE + CENTROAMERICA
NIVELES = ["ADM0", "ADM1"]
CARPETA = Path("geo")
API = "https://www.geoboundaries.org/api/current/gbOpen/{iso}/{nivel}/"

NOMBRE_PAIS = {"GTM": "Guatemala", "BLZ": "Belice", "HND": "Honduras", "SLV": "El Salvador",
               "NIC": "Nicaragua", "CRI": "Costa Rica", "PAN": "Panamá"}


def bajar(iso, nivel):
    destino = CARPETA / f"geoBoundaries-{iso}-{nivel}_simplified.geojson"
    if destino.exists():
        print(f"  {destino.name}: ya existe, se salta")
        return

    info = requests.get(API.format(iso=iso, nivel=nivel), timeout=60)
    info.raise_for_status()
    url = info.json()["simplifiedGeometryGeoJSON"]

    geo = requests.get(url, timeout=120)
    geo.raise_for_status()
    destino.write_bytes(geo.content)
    print(f"  {destino.name}: {len(geo.json()['features'])} zona(s)")


def leer(ruta):
    return json.loads(ruta.read_text(encoding="utf-8"))


def renombrar_repetidos():
    """Agrega el país a las regiones de Centroamérica cuyo nombre ya usa otra zona."""
    archivos = sorted(CARPETA.glob("*.geojson")) + sorted(CARPETA.glob("*.json"))
    conteo = Counter(f["properties"]["shapeName"] for a in archivos for f in leer(a)["features"])

    for iso in CENTROAMERICA:
        ruta = CARPETA / f"geoBoundaries-{iso}-ADM1_simplified.geojson"
        if not ruta.exists():
            continue
        datos = leer(ruta)
        cambios = 0
        for f in datos["features"]:
            nombre = f["properties"]["shapeName"]
            if conteo[nombre] > 1:
                f["properties"]["shapeName"] = f"{nombre} ({NOMBRE_PAIS[iso]})"
                print(f"  {iso}: '{nombre}' -> '{f['properties']['shapeName']}'")
                cambios += 1
        if cambios:
            ruta.write_text(json.dumps(datos, ensure_ascii=False), encoding="utf-8")


def main():
    CARPETA.mkdir(exist_ok=True)
    for iso in PAISES:
        print(iso)
        for nivel in NIVELES:
            try:
                bajar(iso, nivel)
            except Exception as error:
                print(f"  {nivel}: ERROR -> {error}")
    print("Revisando nombres repetidos...")
    renombrar_repetidos()
    print("Listo.")


if __name__ == "__main__":
    main()
