"""
Junta las provincias de RD en sus 3 macrorregiones (MEPyD) y crea
geo/DOM-macrorregiones.geojson.
"""
import json
from pathlib import Path
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

MACRORREGIONES = {
    "Norte o Cibao": [
        "Santiago", "Puerto Plata", "Espaillat", "La Vega", "Monse\u00f1or Nouel",
        "S\u00e1nchez Ram\u00edrez", "Duarte", "Mar\u00eda Trinidad S\u00e1nchez", "Hermanas",
        "Saman\u00e1", "Valverde", "Monte Cristi", "Dajab\u00f3n", "Santiago Rodr\u00edguez",
    ],
    "Suroeste": [
        "Azua", "Peravia", "San Crist\u00f3bal", "San Jos\u00e9 de Ocoa", "San Juan",
        "La Estrelleta", "Barahona", "Bahoruco", "Independencia", "Pedernales",
    ],
    "Sureste": [
        "Distrito Nacional", "Santo Domingo", "San Pedro de Macor\u00eds", "Hato Mayor",
        "Monte Plata", "La Altagracia", "La Romana", "El Seybo",
    ],
}
ENTRADA = Path("geo/geoBoundaries-DOM-ADM1_simplified.geojson")
SALIDA = Path("geo/DOM-macrorregiones.geojson")

provincias = {
    f["properties"]["shapeName"]: shape(f["geometry"])
    for f in json.loads(ENTRADA.read_text(encoding="utf-8"))["features"]
}

features, usadas = [], set()
for nombre, lista in MACRORREGIONES.items():
    faltan = [p for p in lista if p not in provincias]
    if faltan:
        raise SystemExit(f"No encontre estas provincias en el GeoJSON: {faltan}")
    usadas.update(lista)
    geom = unary_union([provincias[p] for p in lista]).buffer(0)
    features.append({
        "type": "Feature",
        "properties": {"shapeName": nombre, "provincias": lista},
        "geometry": mapping(geom),
    })
    print(f"{nombre}: {len(lista)} provincias")

sobran = set(provincias) - usadas
if sobran:
    print(f"AVISO: provincias sin macrorregion: {sobran}")

SALIDA.write_text(json.dumps({"type": "FeatureCollection", "features": features},
                             ensure_ascii=False), encoding="utf-8")
print(f"Listo: {SALIDA}")