const CENTRO_CARIBE = [18.5, -72];
const ZOOM_INICIAL = 6;

// Cuando estén los GeoJSON oficiales, cambiar a '../datos/geo/'
const RUTA_GEO = 'geo_prueba/';
const ARCHIVOS_PAISES = [
  'geoBoundaries-CUB-ADM0_simplified.geojson',
  'geoBoundaries-HTI-ADM0_simplified.geojson',
  'geoBoundaries-DOM-ADM0_simplified.geojson',
  'geoBoundaries-JAM-ADM0_simplified.geojson',
  'geoBoundaries-BHS-ADM0_simplified.geojson',
  'pr.json'
];

const ESTILO_NORMAL  = { color: '#1fb6a6', weight: 1, fillColor: '#1fb6a6', fillOpacity: 0.12 };
const ESTILO_HOVER   = { fillOpacity: 0.4 };
const ESTILO_ELEGIDA = { color: '#1fb6a6', weight: 3, fillColor: '#1fb6a6', fillOpacity: 0.65 };
const mapa = L.map('mapa', {
  zoomControl: false,
  minZoom: 3,
  worldCopyJump: true
}).setView(CENTRO_CARIBE, ZOOM_INICIAL);

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
  attribution: '© Esri'
}).addTo(mapa);

document.getElementById('zoom-mas').onclick = () => mapa.zoomIn();
document.getElementById('zoom-menos').onclick = () => mapa.zoomOut();
document.getElementById('centrar').onclick = () => mapa.setView(CENTRO_CARIBE, ZOOM_INICIAL);

let zonaElegida = null;     // shapeName de la zona elegida
let capaElegida = null;
const capasPorNombre = {};  // shapeName -> capa (lo usará el buscador)

function elegirZona(nombre, capa) {
  if (capaElegida) capaElegida.setStyle(ESTILO_NORMAL);

  zonaElegida = nombre;
  capaElegida = capa;
  capa.setStyle(ESTILO_ELEGIDA);

  const texto = document.getElementById('zona-elegida');
  texto.textContent = nombreBonito(nombre);
  texto.classList.remove('vacia');

  document.getElementById('aviso').hidden = true;
}

function crearCapa(geojson) {
  return L.geoJSON(geojson, {
    style: ESTILO_NORMAL,
    onEachFeature: (feature, capa) => {
      const nombre = feature.properties.shapeName;
      capasPorNombre[nombre] = capa;

      capa.bindTooltip(nombreBonito(nombre), {
        sticky: true, direction: 'top', offset: [0, -12], className: 'etiqueta'
      });

      capa.on('mouseover', () => { if (capa !== capaElegida) capa.setStyle(ESTILO_HOVER); });
      capa.on('mouseout',  () => { if (capa !== capaElegida) capa.setStyle(ESTILO_NORMAL); });
      capa.on('click',     () => elegirZona(nombre, capa));
    }
  });
}

async function iniciar() {
  for (const archivo of ARCHIVOS_PAISES) {
    try {
      const respuesta = await fetch(RUTA_GEO + archivo);
      const geojson = await respuesta.json();
      crearCapa(geojson).addTo(mapa);
    } catch (error) {
      console.warn('No se pudo cargar', archivo, error);
    }
  }
}

// Nombres en español para mostrar; la llave sigue siendo el shapeName original
const NOMBRES_ES = {
  'Cuba': 'Cuba',
  'Haiti': 'Haití',
  'Dominican Republic': 'República Dominicana',
  'Jamaica': 'Jamaica',
  'Commonwealth of the Bahamas': 'Bahamas',
  'Puerto Rico': 'Puerto Rico'
};
const nombreBonito = nombre => NOMBRES_ES[nombre] || nombre;

iniciar();
