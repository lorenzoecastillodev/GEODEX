// ===== Configuración =====
const CENTRO_CARIBE = [18.5, -72];
const ZOOM_INICIAL = 6;

// Dónde están los GeoJSON
const RUTA_GEO = '../datos/geo/';
// regiones: null = ese país solo se ve completo
const PAISES = [
  { iso: 'CUB', archivo: 'geoBoundaries-CUB-ADM0_simplified.geojson', regiones: 'geoBoundaries-CUB-ADM1_simplified.geojson' },
  { iso: 'HTI', archivo: 'geoBoundaries-HTI-ADM0_simplified.geojson', regiones: 'geoBoundaries-HTI-ADM1_simplified.geojson' },
  { iso: 'DOM', archivo: 'geoBoundaries-DOM-ADM0_simplified.geojson', regiones: 'DOM-regiones.geojson' },
  { iso: 'JAM', archivo: 'geoBoundaries-JAM-ADM0_simplified.geojson', regiones: null },
  { iso: 'BHS', archivo: 'geoBoundaries-BHS-ADM0_simplified.geojson', regiones: 'geoBoundaries-BHS-ADM1_simplified.geojson' },
  { iso: 'PRI', archivo: 'pr.json', regiones: null }
];

// Nombres en español para mostrar (la llave sigue siendo el shapeName original)
const NOMBRES_ES = {
  'Cuba': 'Cuba',
  'Haiti': 'Haití',
  'Dominican Republic': 'República Dominicana',
  'Jamaica': 'Jamaica',
  'Commonwealth of The Bahamas': 'Bahamas',
  'Puerto Rico': 'Puerto Rico'
};
const nombreBonito = nombre => NOMBRES_ES[nombre] || nombre;

// Estilos de las zonas
const ESTILO_NORMAL  = { color: '#1fb6a6', weight: 1, fillColor: '#1fb6a6', fillOpacity: 0.12, dashArray: null };
const ESTILO_HOVER   = { fillOpacity: 0.4 };
const ESTILO_ELEGIDA = { color: '#1fb6a6', weight: 3, fillColor: '#1fb6a6', fillOpacity: 0.65 };
const estiloBase = capa => capa.estiloBase || ESTILO_NORMAL;

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
let paisActual = null;      // ISO del país elegido, ej: 'DOM'
const capasRegiones = {};   // ISO -> grupo con las regiones de ese país
const capaPaisPorIso = {};  // ISO -> capa del país

// ===== Elegir y limpiar zona =====
function elegirZona(nombre, capa) {
  if (capaElegida) capaElegida.setStyle(estiloBase(capaElegida));

  zonaElegida = nombre;
  capaElegida = capa;
  capa.setStyle(capa.estiloBase ? { ...capa.estiloBase, color: '#fff', weight: 3, dashArray: null } : ESTILO_ELEGIDA);

  const texto = document.getElementById('zona-elegida');
  texto.textContent = nombreBonito(nombre);
  texto.classList.remove('vacia');

  document.getElementById('aviso').hidden = true;
  document.getElementById('analizar').disabled = false;

  paisActual = capa.iso;
  actualizarBotonRegiones();
}

function limpiarSeleccion() {
  if (capaElegida) capaElegida.setStyle(estiloBase(capaElegida));
  zonaElegida = null;
  capaElegida = null;

  const texto = document.getElementById('zona-elegida');
  texto.textContent = 'Ninguna todavía';
  texto.classList.add('vacia');

  document.getElementById('aviso-texto').textContent =
    modo === 'pais' ? 'Haz clic en un país para empezar' : 'Haz clic en una región';
  document.getElementById('aviso').hidden = false;
  document.getElementById('analizar').disabled = true;
  document.getElementById('resultados').hidden = true;
}

// ===== Dibujar un GeoJSON =====
// tipo = 'pais' o 'provincias' (para saber a qué modo pertenece cada zona)
function crearCapa(geojson, tipo, iso) {
  return L.geoJSON(geojson, {
    style: ESTILO_NORMAL,
    onEachFeature: (feature, capa) => {
      const nombre = feature.properties.shapeName;
      capa.tipo = tipo;
      capa.iso = iso;
      if (tipo === 'pais') capaPaisPorIso[iso] = capa;
      capasPorNombre[nombre] = capa;

      // nombre en español, solo al pasar el mouse
      capa.bindTooltip(nombreBonito(nombre), {
        sticky: true, direction: 'top', offset: [0, -12], className: 'etiqueta'
      });

      // efectos del mouse
      capa.on('mouseover', () => { if (capa !== capaElegida) capa.setStyle(ESTILO_HOVER); });
      capa.on('mouseout',  () => { if (capa !== capaElegida) capa.setStyle(estiloBase(capa)); });
      capa.on('click',     () => elegirZona(nombre, capa));
    }
  });
}

// ===== Cambiar entre País completo y Por regiones =====
function cambiarModo(nuevoModo) {
  if (nuevoModo === modo) return;
  if (nuevoModo === 'provincias' && !capasRegiones[paisActual]) return;
  modo = nuevoModo;

  document.querySelectorAll('.opcion').forEach(boton =>
    boton.classList.toggle('activa', boton.dataset.modo === modo)
  );

  const regiones = capasRegiones[paisActual];
  if (modo === 'provincias') {
    mapa.removeLayer(capaPaises);
    regiones.addTo(mapa);
    mapa.fitBounds(regiones.getBounds(), MARGEN_ZOOM);
  } else {
    if (regiones) mapa.removeLayer(regiones);
    capaPaises.addTo(mapa);
  }

  limpiarColores();
  llenarVariables();
  limpiarSeleccion();

  // al volver a "País completo", se vuelve a elegir el país que se estaba viendo
  if (modo === 'pais' && paisActual) {
    const capa = capaPaisPorIso[paisActual];
    mapa.fitBounds(capa.getBounds(), MARGEN_ZOOM);
    elegirZona(capa.feature.properties.shapeName, capa);
  }

  actualizarBotonRegiones();
  actualizarMapa();
}

function actualizarBotonRegiones() {
  const boton = document.querySelector('.opcion[data-modo="provincias"]');
  const tieneRegiones = Boolean(paisActual && capasRegiones[paisActual]);
  boton.disabled = modo === 'pais' && !tieneRegiones;

  const nombre = paisActual
    ? nombreBonito(capaPaisPorIso[paisActual].feature.properties.shapeName)
    : '';
  document.getElementById('nota-regiones').textContent =
    !paisActual ? 'Elige un país para ver sus regiones'
    : tieneRegiones ? `Puedes ver las regiones de ${nombre}`
    : `${nombre} no tiene regiones con datos`;
}

document.querySelectorAll('.opcion').forEach(boton =>
  boton.addEventListener('click', () => cambiarModo(boton.dataset.modo))
);

// ===== Buscador =====

// Quita tildes y mayúsculas para comparar ("Haití" = "haiti")
const normalizar = texto =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Llena las sugerencias con los países
function llenarBuscador() {
  document.getElementById('zonas').innerHTML = Object.keys(capasPorNombre)
    .filter(nombre => capasPorNombre[nombre].tipo === 'pais')
    .map(nombre => `<option value="${nombreBonito(nombre)}">`)
    .join('');
}

// Busca la zona, cambia de modo si hace falta, hace zoom y la elige
function buscar() {
  const input = document.getElementById('buscador');
  const texto = normalizar(input.value);
  if (!texto) return;

  const nombre = Object.keys(capasPorNombre).find(n =>
    capasPorNombre[n].tipo === 'pais' &&
    (normalizar(nombreBonito(n)).includes(texto) || normalizar(n).includes(texto))
  );

  if (!nombre) {
    input.parentElement.classList.add('error');
    setTimeout(() => input.parentElement.classList.remove('error'), 800);
    return;
  }

  const capa = capasPorNombre[nombre];
  cambiarModo(capa.tipo);
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
  for (const { iso, archivo, regiones } of PAISES) {
    try {
      crearCapa(await cargarGeo(archivo), 'pais', iso).addTo(capaPaises);
      if (regiones) {
        const grupo = L.featureGroup();
        crearCapa(await cargarGeo(regiones), 'provincias', iso).addTo(grupo);
        capasRegiones[iso] = grupo;
      }
    } catch (error) {
      console.warn('No se pudo cargar', iso, error);
    }
  }
  llenarBuscador();
  actualizarBotonRegiones();
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
  { id: 'NDVI', nombre: 'Vegetación', unidad: '', niveles: ['pais', 'provincias'],
    descripcion: 'Qué tan verde y sana está la vegetación vista desde satélite. Va de -1 a 1: más alto, más plantas.' },
  { id: 'AREA_QUEMADA', nombre: 'Áreas quemadas', unidad: 'km²', niveles: ['pais'],
    descripcion: 'Superficie que los satélites detectaron quemada por incendios cada mes.' },
  { id: 'SST', nombre: 'Temperatura del océano', unidad: '°C', niveles: ['pais'],
    descripcion: 'Temperatura del agua en la superficie del mar. Influye en huracanes, corales y pesca.' },
  { id: 'PRECIPITACION', nombre: 'Precipitación', unidad: 'mm', niveles: ['pais', 'provincias'],
    descripcion: 'Cuánta lluvia cae cada mes.' },
  { id: 'TEMP_AIRE', nombre: 'Temperatura media del aire', unidad: '°C', niveles: ['pais', 'provincias'],
    descripcion: 'Temperatura del aire a 2 metros del suelo, como la que sentimos al salir.' },
  { id: 'HUMEDAD_SUELO', nombre: 'Humedad de la superficie', unidad: '%', niveles: ['pais'],
    descripcion: 'Qué tan mojada está la capa de arriba del suelo. Importa para los cultivos y las sequías.' }
];


// Qué significa para la gente cada cambio
const IMPACTOS = {
  NDVI: {
    sube: 'Más vegetación protege el suelo de la erosión, ayuda a guardar agua y absorbe CO₂. Puede deberse a reforestación o a más lluvia.',
    baja: 'Menos vegetación puede indicar deforestación, sequía o crecimiento de las ciudades. El suelo se erosiona más y aumentan los deslizamientos.',
    porque: 'los bosques y cultivos protegen el agua, el suelo y la comida del país'
  },
  AREA_QUEMADA: {
    sube: 'Más incendios significa pérdida de bosques y cultivos, humo que afecta la salud y suelos desprotegidos cuando llegan las lluvias.',
    baja: 'Menos área quemada es buena señal: se pierden menos bosques y hay menos humo en el aire.',
    porque: 'los incendios pueden crecer rápido en temporadas secas'
  },
  SST: {
    sube: 'Un mar más caliente blanquea los corales, afecta la pesca y le da más energía a los huracanes.',
    baja: 'Un mar más frío puede cambiar dónde están los peces y le da menos energía a los huracanes.',
    porque: 'la temperatura del mar influye en los huracanes, los corales y la pesca'
  },
  PRECIPITACION: {
    sube: 'Más lluvia puede llenar presas y acuíferos, pero también aumenta el riesgo de inundaciones y deslizamientos.',
    baja: 'Menos lluvia es riesgo de sequía: menos agua para tomar, para la agricultura y para las hidroeléctricas.',
    porque: 'de la lluvia dependen el agua potable, la agricultura y la electricidad'
  },
  TEMP_AIRE: {
    sube: 'Más calor aumenta los golpes de calor, el uso de aire acondicionado (y la factura de luz) y el estrés en cultivos y animales. También puede favorecer al mosquito del dengue.',
    baja: 'Temperaturas más bajas reducen el estrés por calor, aunque los cambios bruscos también afectan a los cultivos.',
    porque: 'la temperatura afecta la salud, la energía y la agricultura'
  },
  T2M_MAX: {
    sube: 'Días más calurosos aumentan el riesgo de golpes de calor, sobre todo en niños y adultos mayores, y hacen más difícil trabajar al aire libre.',
    baja: 'Máximas más bajas significan menos días de calor extremo.',
    porque: 'los días de calor extremo son peligrosos para la salud'
  },
  HUMEDAD_SUELO: {
    sube: 'Un suelo más húmedo favorece los cultivos, pero si se satura aumenta el riesgo de inundaciones y deslizamientos.',
    baja: 'Un suelo más seco es señal de sequía: las plantas sufren, bajan las cosechas y aumenta el riesgo de incendios.',
    porque: 'la humedad del suelo decide si los cultivos tienen agua'
  }
};
// los códigos de POWER usan los mismos textos
IMPACTOS.T2M = IMPACTOS.TEMP_AIRE;
IMPACTOS.PRECTOTCORR = IMPACTOS.PRECIPITACION;
IMPACTOS.GWETROOT = IMPACTOS.HUMEDAD_SUELO;

function textoImpacto(d) {
  const impacto = IMPACTOS[d.variable];
  if (!impacto) return null;
  if (!d.significativo) {
    return `Por ahora no hay un cambio claro, pero vale la pena seguir vigilándola porque ${impacto.porque}.`;
  }
  return d.cambio_total >= 0 ? impacto.sube : impacto.baja;
}

const infoVariable = id => VARIABLES.find(v => v.id === id);

function mostrarDescripcion() {
  const id = document.getElementById('variable').value;
  document.getElementById('desc-variable').textContent = infoVariable(id)?.descripcion ?? '';
}
document.getElementById('variable').addEventListener('change', mostrarDescripcion);

function llenarVariables() {
  const select = document.getElementById('variable');
  const actual = select.value;
  const disponibles = VARIABLES.filter(v => v.niveles.includes(modo));

  select.innerHTML = '';
  disponibles.forEach(v => select.add(new Option(v.nombre, v.id)));

  // si la que estaba elegida sigue disponible, se queda
  if (disponibles.some(v => v.id === actual)) select.value = actual;
  mostrarDescripcion();
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

const ANIO_PROYECCION = 2030;

const USAR_SERVIDOR = false;   // false = volver a los datos falsos
const API = 'http://127.0.0.1:5000';

// TEMPORAL: hasta que el equipo acuerde los nombres de zona en series.json
const ZONA_API = { 'Dominican Republic': 'Republica Dominicana' };
const zonaParaApi = nombre => ZONA_API[nombre] || nombre;

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
  if (!USAR_SERVIDOR) return analisisFalso(params);

  const url = `${API}/api/analisis?` +
    new URLSearchParams({ ...params, zona: zonaParaApi(params.zona) });
  const respuesta = await fetch(url);
  const datos = await respuesta.json();

  if (!respuesta.ok) throw new Error(datos.error || 'Error del servidor');
  datos.zona = params.zona;   // para mostrar el nombre en español
  return datos;
}
const nombreVariable = id => infoVariable(id)?.nombre ?? id;
const conSigno = (n, dec) => `${n >= 0 ? '+' : ''}${n.toFixed(dec)}`;

function explicarP(p) {
  if (p < 0.01) return 'casi seguro que es un cambio real';
  if (p < 0.05) return 'probablemente es un cambio real';
  return 'podría ser casualidad';
}

function mostrarResultados(d) {
  const unidad = infoVariable(d.variable)?.unidad ?? '';
  const clase = !d.significativo ? 'neutro' : d.cambio_total >= 0 ? 'sube' : 'baja';

  document.getElementById('res-titulo').textContent =
    `${nombreVariable(d.variable)} · ${nombreBonito(d.zona)}`;

  const sig = document.getElementById('t-sig');
  sig.textContent = d.significativo ? 'Sí' : 'No';
  sig.className = clase;
  document.getElementById('t-p').textContent = `p = ${d.p.toFixed(3)} · ${explicarP(d.p)}`;

  const decada = document.getElementById('t-decada');
  decada.textContent = `${conSigno(d.pendiente_decada, 3)} ${unidad}`;
  decada.className = clase;

  const pct = document.getElementById('t-pct');
  pct.textContent = d.cambio_pct == null
    ? '—'
    : `${d.cambio_total >= 0 ? '↑' : '↓'} ${conSigno(d.cambio_pct, 1)} %`;
  pct.className = clase;

  const hayProyeccion = d.proyeccion?.valores?.length > 0;
  let texto = d.resumen;
  if (!d.significativo) texto += ' Aunque no es significativo, con más años de datos podría llegar a serlo.';
  if (hayProyeccion) {
    const ultimoAnio = d.proyeccion.valores.slice(-12);
    const promedio = ultimoAnio.reduce((a, b) => a + b, 0) / ultimoAnio.length;
    texto += ` Si la tendencia sigue igual, en ${ANIO_PROYECCION} el promedio sería de ${promedio.toFixed(2)}${unidad ? ' ' + unidad : ''}.`;
  }
  document.getElementById('resumen').textContent = texto;

  const impacto = textoImpacto(d);
  document.getElementById('impacto').hidden = !impacto;
  document.getElementById('impacto-texto').textContent = impacto ?? '';

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
    height: 240,
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

// ===== Mapa de colores por región =====

function mapaFalso() {
  const resultado = {};
  Object.values(capasPorNombre)
    .filter(capa => capa.tipo === 'provincias' && capa.iso === paisActual)
    .forEach(capa => {
      resultado[capa.feature.properties.shapeName] = {
        pendiente_decada: (Math.random() - 0.5) * 0.05,
        significativo: Math.random() > 0.4
      };
    });
  return resultado;
}

async function obtenerMapa({ variable, desde, hasta }) {
  if (!USAR_SERVIDOR) return mapaFalso();

  const respuesta = await fetch(`${API}/api/mapa?` + new URLSearchParams({ variable, desde, hasta, pais: paisActual }));
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error || 'Error del servidor');
  return datos;
}

function pintarMapa(datos, { variable, desde, hasta }) {
  const unidad = infoVariable(variable)?.unidad ?? '';
  document.getElementById('leyenda-titulo').textContent =
    `${nombreVariable(variable)} · ${desde}–${hasta}`;
  const regiones = Object.values(capasPorNombre)
    .filter(capa => capa.tipo === 'provincias' && capa.iso === paisActual);

  // el cambio más fuerte define el color más intenso
  const maximo = Math.max(...Object.values(datos).map(d => Math.abs(d.pendiente_decada)), 1e-9);

  regiones.forEach(capa => {
    const nombre = capa.feature.properties.shapeName;
    const dato = datos[zonaParaApi(nombre)];

    if (!dato) {
      capa.estiloBase = { color: '#fff', weight: 1, dashArray: '4', fillOpacity: 0 };
      capa.setTooltipContent(`${nombreBonito(nombre)} · sin datos`);
    } else {
      const intensidad = Math.abs(dato.pendiente_decada) / maximo;
      const color = !dato.significativo ? '#8a9bb5' : dato.pendiente_decada >= 0 ? '#2ecc71' : '#e74c3c';
      capa.estiloBase = {
        color: '#0b1d3a', weight: 1, dashArray: null, fillColor: color,
        fillOpacity: dato.significativo ? 0.3 + 0.55 * intensidad : 0.3
      };
      capa.setTooltipContent(
        `${nombreBonito(nombre)} · ${conSigno(dato.pendiente_decada, 3)} ${unidad}/década`
      );
    }
    capa.setStyle(capa === capaElegida
      ? { ...capa.estiloBase, color: '#fff', weight: 3, dashArray: null }
      : capa.estiloBase);
  });

  document.getElementById('leyenda').hidden = false;
}

function limpiarColores() {
  Object.values(capasPorNombre).forEach(capa => {
    if (!capa.estiloBase) return;
    capa.estiloBase = null;
    capa.setStyle(ESTILO_NORMAL);
    capa.setTooltipContent(nombreBonito(capa.feature.properties.shapeName));
  });
  document.getElementById('leyenda').hidden = true;
}

async function actualizarMapa() {
  if (modo !== 'provincias') return;
  const params = leerParametros();
  if (validar(params)) return;

  try {
    pintarMapa(await obtenerMapa(params), params);
  } catch (e) {
    console.warn('No se pudo pintar el mapa', e);
  }
}

// al cambiar variable o años: repintar y cerrar resultados viejos
['variable', 'desde', 'hasta'].forEach(id =>
  document.getElementById(id).addEventListener('change', () => {
    document.getElementById('resultados').hidden = true;
    actualizarMapa();
  })
);

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
    alert(e instanceof TypeError
      ? 'No se pudo conectar con el servidor. ¿Está corriendo app.py?'
      : e.message);
  } finally {
    boton.disabled = false;
    boton.textContent = 'Analizar';
  }
});

document.getElementById('cerrar-resultados').onclick = () =>
  document.getElementById('resultados').hidden = true;


iniciar();