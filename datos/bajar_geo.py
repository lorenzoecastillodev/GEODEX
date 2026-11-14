"""
Baja de geoBoundaries los GeoJSON simplificados de países (ADM0) y regiones (ADM1).

Uso:  pip install requests
      python bajar_geo.py
"""
from pathlib import Path
import requests

PAISES = ["CUB", "DOM", "HTI", "JAM", "BHS"]
NIVELES = ["ADM0", "ADM1"]
CARPETA = Path("geo")
API = "https://www.geoboundaries.org/api/current/gbOpen/{iso}/{nivel}/"


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


def main():
    CARPETA.mkdir(exist_ok=True)
    for iso in PAISES:
        print(iso)
        for nivel in NIVELES:
            try:
                bajar(iso, nivel)
            except Exception as error:
                print(f"  {nivel}: ERROR -> {error}")


if __name__ == "__main__":
    main()