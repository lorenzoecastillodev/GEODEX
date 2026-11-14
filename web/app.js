// ===== Paso 1: mapa de fondo =====
const CENTRO_CARIBE = [18.5, -72];
const ZOOM_INICIAL = 6;

// Creamos el mapa sin los botones de zoom de Leaflet (usamos los nuestros)
const mapa = L.map('mapa', { zoomControl: false }).setView(CENTRO_CARIBE, ZOOM_INICIAL);

// TEMPORAL: mapa gris oscuro de Esri (se quita cuando carguemos el GeoJSON)
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
  attribution: '© Esri'
}).addTo(mapa);

// Botones de zoom propios
document.getElementById('zoom-mas').onclick = () => mapa.zoomIn();
document.getElementById('zoom-menos').onclick = () => mapa.zoomOut();
document.getElementById('centrar').onclick = () => mapa.setView(CENTRO_CARIBE, ZOOM_INICIAL);