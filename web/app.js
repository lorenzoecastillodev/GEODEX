// ===== Configuración =====
const CENTRO_CARIBE = [18.5, -72];
const ZOOM_INICIAL = 6;

// Dónde están los GeoJSON (cuando la Persona 1 suba los oficiales: '../datos/geo/')
const RUTA_GEO = 'geo_prueba/';
const ARCHIVOS_PAISES = [
  'geoBoundaries-CUB-ADM0_simplified.geojson',
  'geoBoundaries-HTI-ADM0_simplified.geojson',
  'geoBoundaries-DOM-ADM0_simplified.geojson',
  'geoBoundaries-JAM-ADM0_simplified.geojson',
  'geoBoundaries-BHS-ADM0_simplified.geojson',
  'pr.json'
];
const ARCHIVO_PROVINCIAS = 'geoBoundaries-DOM-ADM1_simplified.geojson';

// Nombres en español para mostrar (la llave sigue siendo el shapeName original)
const NOMBRES_ES = {
  'Cuba': 'Cuba',
  'Haiti': 'Haití',
  'Dominican Republic': 'República Dominicana',
  'Jamaica': 'Jamaica',
  'Commonwealth of the Bahamas': 'Bahamas',
  'Puerto Rico': 'Puerto Rico'
};
const nombreBonito = nombre => NOMBRES_ES[nombre] || nombre;

// Estilos de las zonas
const ESTILO_NORMAL  = { color: '#1fb6a6', weight: 1, fillColor: '#1fb6a6', fillOpacity: 0.12 };
const ESTILO_HOVER   = { fillOpacity: 0.4 };
const ESTILO_ELEGIDA = { color: '#1fb6a6', weight: 3, fillColor: '#1fb6a6', fillOpacity: 0.65 };

// Espacio para que el zoom no quede tapado por el panel y la barra
const MARGEN_ZOOM = { paddingTopLeft: [400, 120], paddingBottomRight: [80, 80] };

// ===== Mapa =====
const mapa = L.map('mapa', {
  zoomControl: false,   // usamos nuestros botones
  minZoom: 3,
  worldCopyJump: true
}).setView(CENTRO_CARIBE, ZOOM_INICIAL);

// Mapa base gris oscuro de Esri (el mundo entero)
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
  attribution: '© Esri'
}).addTo(mapa);

// Botones de zoom propios
document.getElementById('zoom-mas').onclick = () => mapa.zoomIn();
document.getElementById('zoom-menos').onclick = () => mapa.zoomOut();
document.getElementById('centrar').onclick = () => mapa.setView(CENTRO_CARIBE, ZOOM_INICIAL);

// ===== Estado =====
let modo = 'pais';                              // 'pais' o 'provincias'
let zonaElegida = null;                         // shapeName de la zona elegida
let capaElegida = null;                         // la capa de Leaflet de esa zona
const capasPorNombre = {};                      // shapeName -> capa (para el buscador)
const capaPaises = L.featureGroup().addTo(mapa);   // todos los países juntos
const capaProvincias = L.featureGroup();           // provincias de RD (ocultas al inicio)

// ===== Elegir y limpiar zona =====
function elegirZona(nombre, capa) {
  if (capaElegida) capaElegida.setStyle(ESTILO_NORMAL);  // quitar la anterior

  zonaElegida = nombre;
  capaElegida = capa;
  capa.setStyle(ESTILO_ELEGIDA);

  const texto = document.getElementById('zona-elegida');
  texto.textContent = nombreBonito(nombre);
  texto.classList.remove('vacia');

  document.getElementById('aviso').hidden = true;
  document.getElementById('analizar').disabled = false;
}

function limpiarSeleccion() {
  if (capaElegida) capaElegida.setStyle(ESTILO_NORMAL);
  zonaElegida = null;
  capaElegida = null;

  const texto = document.getElementById('zona-elegida');
  texto.textContent = 'Ninguna todavía';
  texto.classList.add('vacia');

  document.getElementById('aviso-texto').textContent =
    modo === 'pais' ? 'Haz clic en un país para empezar' : 'Haz clic en una region';
  document.getElementById('aviso').hidden = false;
    document.getElementById('analizar').disabled = true;
      document.getElementById('resultados').hidden = true;
}

// ===== Dibujar un GeoJSON =====
// tipo = 'pais' o 'provincias' (para saber a qué modo pertenece cada zona)
function crearCapa(geojson, tipo) {
  return L.geoJSON(geojson, {
    style: ESTILO_NORMAL,
    onEachFeature: (feature, capa) => {
      const nombre = feature.properties.shapeName;
      capa.tipo = tipo;
      capasPorNombre[nombre] = capa;

      // nombre en español, solo al pasar el mouse
      capa.bindTooltip(nombreBonito(nombre), {
        sticky: true, direction: 'top', offset: [0, -12], className: 'etiqueta'
      });

      // efectos del mouse
      capa.on('mouseover', () => { if (capa !== capaElegida) capa.setStyle(ESTILO_HOVER); });
      capa.on('mouseout',  () => { if (capa !== capaElegida) capa.setStyle(ESTILO_NORMAL); });
      capa.on('click',     () => elegirZona(nombre, capa));
    }
  });
}

// ===== Cambiar entre País completo y Por provincias =====
function cambiarModo(nuevoModo) {
  if (nuevoModo === modo) return;
  modo = nuevoModo;

  // botón activo
  document.querySelectorAll('.opcion').forEach(boton =>
    boton.classList.toggle('activa', boton.dataset.modo === modo)
  );

  // mostrar una capa y esconder la otra
  if (modo === 'provincias') {
    mapa.removeLayer(capaPaises);
    capaProvincias.addTo(mapa);
    mapa.fitBounds(capaProvincias.getBounds(), MARGEN_ZOOM);
  } else {
    mapa.removeLayer(capaProvincias);
    capaPaises.addTo(mapa);
    mapa.setView(CENTRO_CARIBE, ZOOM_INICIAL);
  }
  llenarVariables()
  limpiarSeleccion();
}

document.querySelectorAll('.opcion').forEach(boton =>
  boton.addEventListener('click', () => cambiarModo(boton.dataset.modo))
);

// ===== Buscador =====

// Quita tildes y mayúsculas para comparar ("Haití" = "haiti")
const normalizar = texto =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Llena las sugerencias con países y provincias
function llenarBuscador() {
  document.getElementById('zonas').innerHTML = Object.keys(capasPorNombre)
    .map(nombre => `<option value="${nombreBonito(nombre)}">`)
    .join('');
}

// Busca la zona, cambia de modo si hace falta, hace zoom y la elige
function buscar() {
  const input = document.getElementById('buscador');
  const texto = normalizar(input.value);
  if (!texto) return;

  const nombre = Object.keys(capasPorNombre).find(n =>
    normalizar(nombreBonito(n)).includes(texto) || normalizar(n).includes(texto)
  );

  if (!nombre) {
    input.parentElement.classList.add('error');
    setTimeout(() => input.parentElement.classList.remove('error'), 800);
    return;
  }

  const capa = capasPorNombre[nombre];
  cambiarModo(capa.tipo);   // si buscas una provincia estando en "País", cambia solo
  mapa.fitBounds(capa.getBounds(), MARGEN_ZOOM);
  elegirZona(nombre, capa);
  input.value = nombreBonito(nombre);
}

document.getElementById('btn-buscar').onclick = buscar;
document.getElementById('buscador').addEventListener('keydown', e => { if (e.key === 'Enter') buscar(); });
document.getElementById('buscador').addEventListener('change', buscar);

// ===== Cargar todo al iniciar =====
async function cargarGeo(archivo) {
  const respuesta = await fetch(RUTA_GEO + archivo);
  return respuesta.json();
}

async function iniciar() {
  // países
  for (const archivo of ARCHIVOS_PAISES) {
    try {
      crearCapa(await cargarGeo(archivo), 'pais').addTo(capaPaises);
    } catch (error) {
      console.warn('No se pudo cargar', archivo, error);
    }
  }

  // provincias de RD
  try {
    crearCapa(await cargarGeo(ARCHIVO_PROVINCIAS), 'provincias').addTo(capaProvincias);
  } catch (error) {
    console.warn('No se pudieron cargar las provincias', error);
  }

  llenarBuscador();
}

// ===== Variable, años y Analizar =====
const ANIO_MIN = 2001;
const ANIO_MAX = 2024;

function llenarAnios() {
  const desde = document.getElementById('desde');
  const hasta = document.getElementById('hasta');
  for (let a = ANIO_MIN; a <= ANIO_MAX; a++) {
    desde.add(new Option(a, a));
    hasta.add(new Option(a, a));
  }
  desde.value = ANIO_MIN;
  hasta.value = ANIO_MAX;
}
llenarAnios();

// Todas van por país; 'provincias' solo en las que tienen datos por provincia.
// Los id y niveles son DE PRUEBA: confirmar con Persona 1 y 2 y ponerlos en CONTRATO.md
const VARIABLES = [
  { id: 'NDVI',          nombre: 'Vegetación',                unidad: '',     niveles: ['pais', 'provincias'] },
  { id: 'AREA_QUEMADA',  nombre: 'Áreas quemadas',            unidad: 'km²',  niveles: ['pais'] },
  { id: 'SST',           nombre: 'Temperatura del océano',    unidad: '°C',   niveles: ['pais'] },
  { id: 'PRECIPITACION', nombre: 'Precipitación',             unidad: 'mm',   niveles: ['pais', 'provincias'] },
  { id: 'TEMP_AIRE',     nombre: 'Temperatura media del aire', unidad: '°C',  niveles: ['pais', 'provincias'] },
  { id: 'HUMEDAD_SUELO', nombre: 'Humedad de la superficie',  unidad: '%',    niveles: ['pais'] }
];

function llenarVariables() {
  const select = document.getElementById('variable');
  const actual = select.value;
  const disponibles = VARIABLES.filter(v => v.niveles.includes(modo));

  select.innerHTML = '';
  disponibles.forEach(v => select.add(new Option(v.nombre, v.id)));

  // si la que estaba elegida sigue disponible, se queda
  if (disponibles.some(v => v.id === actual)) select.value = actual;
}
llenarVariables();

function leerParametros() {
  return {
    zona: zonaElegida,
    variable: document.getElementById('variable').value,
    desde: +document.getElementById('desde').value,
    hasta: +document.getElementById('hasta').value
  };
}

// Mann-Kendall estacional necesita varios años para ser confiable
function validar({ desde, hasta }) {
  if (hasta - desde < 5) return 'Elige un rango de al menos 5 años';
  return null;
}

// ===== Resultados =====

// DATOS FALSOS con el formato de GET /api/analisis del contrato
const ANIO_PROYECCION = 2030;

// DATOS FALSOS con el formato de GET /api/analisis del contrato
function analisisFalso({ zona, variable, desde, hasta }) {
  const fechas = [], valores = [], tendencia = [];
  const base = 10 + Math.random() * 20;
  const pendienteMes = (Math.random() - 0.4) * 0.02;
  const estacion = i => 2 * Math.sin(i / 12 * 2 * Math.PI);
  const fecha = (a, m) => `${a}-${String(m).padStart(2, '0')}`;

  let i = 0;
  for (let a = desde; a <= hasta; a++) {
    for (let m = 1; m <= 12; m++, i++) {
      const t = base + pendienteMes * i;
      fechas.push(fecha(a, m));
      tendencia.push(+t.toFixed(3));
      valores.push(+(t + estacion(i) + (Math.random() - 0.5)).toFixed(3));
    }
  }

  const proyeccion = { fechas: [], valores: [] };
  for (let a = hasta + 1; a <= ANIO_PROYECCION; a++) {
    for (let m = 1; m <= 12; m++, i++) {
      proyeccion.fechas.push(fecha(a, m));
      proyeccion.valores.push(+(base + pendienteMes * i + estacion(i)).toFixed(3));
    }
  }

  const cambio_total = tendencia.at(-1) - tendencia[0];
  const cambio_pct = cambio_total / tendencia[0] * 100;
  const significativo = Math.abs(cambio_pct) > 3;

  return {
    zona, variable, fechas, valores, tendencia, proyeccion, significativo,
    p: significativo ? 0.003 : 0.31,
    pendiente_anual: pendienteMes * 12,
    pendiente_decada: pendienteMes * 120,
    cambio_total,
    cambio_pct,
    resumen: `(DATO FALSO) ${nombreVariable(variable)} en ${nombreBonito(zona)}: ` +
             `${conSigno(cambio_pct, 1)} % entre ${desde} y ${hasta}.`
  };
}

// Cuando el servidor de la Persona 2 esté listo, solo se cambia esta función
async function obtenerAnalisis(params) {
  return analisisFalso(params);
}

const infoVariable = id => VARIABLES.find(v => v.id === id);
const nombreVariable = id => infoVariable(id)?.nombre ?? id;
const conSigno = (n, dec) => `${n >= 0 ? '+' : ''}${n.toFixed(dec)}`;

function mostrarResultados(d) {
  const unidad = infoVariable(d.variable)?.unidad ?? '';
  const clase = !d.significativo ? 'neutro' : d.cambio_total >= 0 ? 'sube' : 'baja';

  document.getElementById('res-titulo').textContent =
    `${nombreVariable(d.variable)} · ${nombreBonito(d.zona)}`;

  const sig = document.getElementById('t-sig');
  sig.textContent = d.significativo ? 'Sí' : 'No';
  sig.className = clase;
  document.getElementById('t-p').textContent = `p = ${d.p.toFixed(3)}`;

  const decada = document.getElementById('t-decada');
  decada.textContent = `${conSigno(d.pendiente_decada, 3)} ${unidad}`;
  decada.className = clase;

  const pct = document.getElementById('t-pct');
  pct.textContent = `${d.cambio_total >= 0 ? '↑' : '↓'} ${conSigno(d.cambio_pct, 1)} %`;
  pct.className = clase;

  const hayProyeccion = d.proyeccion?.valores?.length > 0;
  let texto = d.resumen;
  if (hayProyeccion) {
    const ultimoAnio = d.proyeccion.valores.slice(-12);
    const promedio = ultimoAnio.reduce((a, b) => a + b, 0) / ultimoAnio.length;
    texto += ` Si la tendencia sigue igual, en ${ANIO_PROYECCION} el promedio sería de ${promedio.toFixed(2)} ${unidad}.`;
  }
  document.getElementById('resumen').textContent = texto;

  // se muestra antes de dibujar para que la gráfica tome el tamaño real
  document.getElementById('resultados').hidden = false;

  const lineas = [
    { x: d.fechas, y: d.valores, name: nombreVariable(d.variable),
      mode: 'lines', line: { color: '#6fa8dc', width: 1.5 } },
    { x: d.fechas, y: d.tendencia, name: 'Tendencia',
      mode: 'lines', line: { color: '#1fb6a6', width: 3, dash: 'dot' } }
  ];
  if (hayProyeccion) {
    lineas.push({ x: d.proyeccion.fechas, y: d.proyeccion.valores, name: `Proyección a ${ANIO_PROYECCION}`,
      mode: 'lines', line: { color: '#f5b041', width: 2, dash: 'dash' } });
  }

  Plotly.newPlot('grafica', lineas, {
    height: Math.max(220, document.getElementById('grafica').clientHeight),
    autosize: true,
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#fff', size: 13 },
    margin: { t: 10, r: 10, b: 40, l: 55 },
    xaxis: { gridcolor: 'rgba(255,255,255,0.08)' },
    yaxis: { gridcolor: 'rgba(255,255,255,0.08)', title: unidad },
    legend: { orientation: 'h', y: 1.12 },
    shapes: hayProyeccion ? [{
      type: 'line', xref: 'x', yref: 'paper',
      x0: d.fechas.at(-1), x1: d.fechas.at(-1), y0: 0, y1: 1,
      line: { color: 'rgba(255,255,255,0.4)', width: 1, dash: 'dot' }
    }] : []
  }, { responsive: true, displayModeBar: false });
}

document.getElementById('analizar').addEventListener('click', async () => {
  const params = leerParametros();
  const error = validar(params);
  if (error) return alert(error);

  const boton = document.getElementById('analizar');
  boton.disabled = true;
  boton.textContent = 'Analizando...';
  try {
    mostrarResultados(await obtenerAnalisis(params));
  } catch (e) {
    console.error(e);
    alert('No se pudo obtener el análisis. ¿Está corriendo el servidor?');
  } finally {
    boton.disabled = false;
    boton.textContent = 'Analizar';
  }
});

document.getElementById('cerrar-resultados').onclick = () =>
  document.getElementById('resultados').hidden = true;


iniciar();