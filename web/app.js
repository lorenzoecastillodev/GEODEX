// ===== Configuración =====
// Centro para ver el Caribe y Centroamérica juntos
const CENTRO_CARIBE = [16, -78];
const ZOOM_INICIAL = 5;

// Dónde están los GeoJSON
const RUTA_GEO = '../datos/geo/';
// regiones: null = ese país solo se ve completo
const PAISES = [
  { iso: 'CUB', archivo: 'geoBoundaries-CUB-ADM0_simplified.geojson', regiones: 'geoBoundaries-CUB-ADM1_simplified.geojson' },
  { iso: 'HTI', archivo: 'geoBoundaries-HTI-ADM0_simplified.geojson', regiones: 'geoBoundaries-HTI-ADM1_simplified.geojson' },
  { iso: 'DOM', archivo: 'geoBoundaries-DOM-ADM0_simplified.geojson', regiones: 'DOM-regiones.geojson' },
  { iso: 'JAM', archivo: 'geoBoundaries-JAM-ADM0_simplified.geojson', regiones: null },
  { iso: 'BHS', archivo: 'geoBoundaries-BHS-ADM0_simplified.geojson', regiones: 'geoBoundaries-BHS-ADM1_simplified.geojson' },
  { iso: 'PRI', archivo: 'pr.json', regiones: null },
  // Centroamérica
  { iso: 'GTM', archivo: 'geoBoundaries-GTM-ADM0_simplified.geojson', regiones: 'geoBoundaries-GTM-ADM1_simplified.geojson' },
  { iso: 'BLZ', archivo: 'geoBoundaries-BLZ-ADM0_simplified.geojson', regiones: 'geoBoundaries-BLZ-ADM1_simplified.geojson' },
  { iso: 'HND', archivo: 'geoBoundaries-HND-ADM0_simplified.geojson', regiones: 'geoBoundaries-HND-ADM1_simplified.geojson' },
  { iso: 'SLV', archivo: 'geoBoundaries-SLV-ADM0_simplified.geojson', regiones: null },   // muy pequeño: sus departamentos tienen casi los mismos datos
  { iso: 'NIC', archivo: 'geoBoundaries-NIC-ADM0_simplified.geojson', regiones: 'geoBoundaries-NIC-ADM1_simplified.geojson' },
  { iso: 'CRI', archivo: 'geoBoundaries-CRI-ADM0_simplified.geojson', regiones: 'geoBoundaries-CRI-ADM1_simplified.geojson' },
  { iso: 'PAN', archivo: 'geoBoundaries-PAN-ADM0_simplified.geojson', regiones: 'geoBoundaries-PAN-ADM1_simplified.geojson' }
];

// Nombres en español para mostrar (la llave sigue siendo el shapeName original)
const NOMBRES_ES = {
  'Cuba': 'Cuba',
  'Haiti': 'Haití',
  'Dominican Republic': 'República Dominicana',
  'Jamaica': 'Jamaica',
  'Commonwealth of The Bahamas': 'Bahamas',
  'Puerto Rico': 'Puerto Rico',
  'Belize': 'Belice',
  'Panama': 'Panamá',
  'The Republic of Panama': 'Panamá',
  // Regiones de Centroamérica que vienen en inglés o con nombres raros
  'Belize (Belice)': 'Belize (distrito)',
  'Guatemala (Guatemala)': 'Guatemala (departamento)',
  'Bay Islands': 'Islas de la Bahía',
  'Leon': 'León',
  'Rio San Juan': 'Río San Juan',
  'Matagalpa (Departemento)': 'Matagalpa',
  'Jinotega (Departamento)': 'Jinotega',
  'North Carribean Coast Autonomous Region': 'Costa Caribe Norte',
  'South Atlantic Autonomous Region': 'Costa Caribe Sur',
  'Colón Province': 'Colón'
};
// Quita prefijos largos: "Provincia de Coclé" -> "Coclé", "Departamento de La Paz" -> "La Paz"
const PREFIJOS = /^(Provincia de |Provincia |Departamento de )/;
const nombreBonito = nombre => NOMBRES_ES[nombre] || nombre.replace(PREFIJOS, '');

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
  window.reiniciarDiagnostico?.();
  document.getElementById("resultados").hidden = true;
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
  window.reiniciarDiagnostico?.();
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

// Nombre corto del país para las sugerencias de regiones: "Rep. Dom. - Yuma"
const PAIS_CORTO = {
  DOM: 'Rep. Dom.', HTI: 'Haití', CUB: 'Cuba', BHS: 'Bahamas', JAM: 'Jamaica', PRI: 'Puerto Rico',
  GTM: 'Guatemala', BLZ: 'Belice', HND: 'Honduras', SLV: 'El Salvador', NIC: 'Nicaragua',
  CRI: 'Costa Rica', PAN: 'Panamá'
};

// ¿Qué se busca? 'pais' o 'provincias' (lo elige el selector al lado del buscador)
const tipoBusqueda = () => document.getElementById('tipo-busqueda').value;

// Texto que se ve en la sugerencia
function etiquetaBusqueda(nombre) {
  const capa = capasPorNombre[nombre];
  return capa.tipo === 'pais'
    ? nombreBonito(nombre)
    : `${PAIS_CORTO[capa.iso] || capa.iso} - ${nombreBonito(nombre)}`;
}

// Zonas que se pueden buscar según el tipo elegido
// (regiones solo de países que tienen regiones con datos)
function zonasBuscables() {
  const tipo = tipoBusqueda();
  return Object.keys(capasPorNombre)
    .filter(n => capasPorNombre[n].tipo === tipo)
    .filter(n => tipo === 'pais' || capasRegiones[capasPorNombre[n].iso])
    .sort((a, b) => etiquetaBusqueda(a).localeCompare(etiquetaBusqueda(b), 'es'));
}

// Llena las sugerencias (países o "País - Región")
function llenarBuscador() {
  document.getElementById('zonas').innerHTML = zonasBuscables()
    .map(nombre => `<option value="${etiquetaBusqueda(nombre)}">`)
    .join('');
  document.getElementById('buscador').placeholder =
    tipoBusqueda() === 'pais' ? 'Busca un país...' : 'Busca una región... ej: Yuma';
}

// Busca la zona, cambia de modo si hace falta, hace zoom y la elige
function buscar() {
  const input = document.getElementById('buscador');
  const texto = normalizar(input.value);
  if (!texto) return;

  const zonas = zonasBuscables();
  // primero coincidencia exacta con la sugerencia, luego que contenga el texto
  const nombre =
    zonas.find(n => normalizar(etiquetaBusqueda(n)) === texto) ||
    zonas.find(n => normalizar(etiquetaBusqueda(n)).includes(texto) ||
                    normalizar(nombreBonito(n)).includes(texto) || normalizar(n).includes(texto));

  if (!nombre) {
    input.parentElement.classList.add('error');
    setTimeout(() => input.parentElement.classList.remove('error'), 800);
    return;
  }

  const capa = capasPorNombre[nombre];
  if (capa.tipo === 'provincias') {
    // si se estaban viendo las regiones de OTRO país, primero se vuelve a países
    if (modo === 'provincias' && paisActual !== capa.iso) cambiarModo('pais');
    paisActual = capa.iso;
  }
  cambiarModo(capa.tipo);
  mapa.fitBounds(capa.getBounds(), MARGEN_ZOOM);
  elegirZona(nombre, capa);
  input.value = etiquetaBusqueda(nombre);
}

// Al cambiar entre Países / Regiones se actualizan las sugerencias
document.getElementById('tipo-busqueda').addEventListener('change', () => {
  document.getElementById('buscador').value = '';
  llenarBuscador();
  document.getElementById('buscador').focus();
});

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
const ANIO_MAX = 2025;

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
  { id: 'T2M', nombre: 'Temperatura media del aire', unidad: '°C', niveles: ['pais', 'provincias'],
    descripcion: 'Temperatura del aire a 2 metros del suelo, como la que sentimos al salir.' },
  { id: 'T2M_MAX', nombre: 'Temperatura máxima', unidad: '°C', niveles: ['pais', 'provincias'],
    descripcion: 'La temperatura más alta de cada día, promediada por mes. Ayuda a ver si hace más calor extremo.' },
  { id: 'PRECTOTCORR', nombre: 'Precipitación', unidad: 'mm', niveles: ['pais', 'provincias'],
    descripcion: 'Cuánta lluvia cae cada mes.' },
  { id: 'GWETROOT', nombre: 'Humedad del suelo', unidad: '%', niveles: ['pais', 'provincias'],
    descripcion: 'Qué tan mojado está el suelo donde crecen las raíces (hasta ~1 metro). Clave para cultivos y sequías.' },
  { id: 'CAUDAL', nombre: 'Caudal de ríos', unidad: 'm³/s', niveles: ['pais', 'provincias'],
    descripcion: 'Cuánta agua lleva el río principal de la zona cada segundo (modelo GEOGLOWS).' },
  { id: 'NDVI', nombre: 'Vegetación (NDVI)', unidad: 'NDVI', niveles: ['pais', 'provincias'],
    descripcion: 'Qué tan verde y viva está la vegetación (de 0 a 1: cerca de 0.8 es bosque denso, cerca de 0.2 casi sin plantas). Satélite MODIS de la NASA.' }
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
  },
  CAUDAL: {
    sube: 'Ríos con más agua ayudan a presas y riego, pero aumentan el riesgo de crecidas e inundaciones.',
    baja: 'Ríos con menos agua significan menos agua para tomar, regar y generar electricidad, y más contaminación concentrada.',
    porque: 'de los ríos dependen el agua potable, el riego y las hidroeléctricas'
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

const USAR_SERVIDOR = true;   // false = volver a los datos falsos
// En tu PC (iniciar_lunyde.py / Live Server) el servidor está en el puerto 5000.
// En internet, la página y el servidor están en la misma dirección, así que se usa la ruta relativa.
const API = ['127.0.0.1', 'localhost'].includes(location.hostname) && location.port !== '5000'
  ? 'http://127.0.0.1:5000'
  : '';

const zonaParaApi = nombre => nombre;

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
    datos.zona = params.zona;
  datos.resumen = datos.resumen.replace(params.zona, nombreBonito(params.zona));
  return datos;
}
const nombreVariable = id => infoVariable(id)?.nombre ?? id;
const conSigno = (n, dec) => `${n >= 0 ? '+' : ''}${n.toFixed(dec)}`;

function explicarP(p) {
  if (p < 0.01) return 'casi seguro que es un cambio real';
  if (p < 0.05) return 'probablemente es un cambio real';
  return 'podría ser casualidad';
}

// Si el servidor no manda proyección, se calcula aquí:
// línea de tendencia alargada hasta 2030 + el patrón promedio de cada mes
// patrón de cada mes: cuánto se aleja, en promedio, de la tendencia
function patronMensual(d) {
  const suma = Array(12).fill(0), cuenta = Array(12).fill(0);
  d.fechas.forEach((fecha, i) => {
    const mes = Number(fecha.slice(5, 7)) - 1;
    suma[mes] += d.valores[i] - d.tendencia[i];
    cuenta[mes]++;
  });
  return suma.map((s, m) => cuenta[m] ? s / cuenta[m] : 0);
}

// Variables que no pueden ser negativas (ni pasar de 100 %)
function limitarValor(variable, v) {
  if (variable === 'PRECTOTCORR') return Math.max(0, v);
  if (variable === 'GWETROOT') return Math.min(100, Math.max(0, v));
  if (variable === 'CAUDAL') return Math.max(0, v);
  if (variable === 'NDVI') return Math.min(1, Math.max(-1, v));
  return v;
}

// Lo que "espera" el modelo cada mes: tendencia + patrón del mes.
// Sirve para comparar 2025 y 2030 con la misma regla (y al mismo nivel que los datos reales).
function valoresModelo(d) {
  const patron = patronMensual(d);
  return d.fechas.map((fecha, i) =>
    limitarValor(d.variable, d.tendencia[i] + patron[Number(fecha.slice(5, 7)) - 1]));
}

function calcularProyeccion(d) {
  if (d.proyeccion?.valores?.length) return d.proyeccion;
  const n = d.valores?.length;
  if (!n || !d.tendencia?.length) return null;

  const patron = patronMensual(d);

  const pasoMensual = typeof d.pendiente_anual === 'number'
    ? d.pendiente_anual / 12
    : (d.tendencia[n - 1] - d.tendencia[0]) / (n - 1);

  const limitar = v => limitarValor(d.variable, v);

  let [anio, mes] = d.fechas[n - 1].split('-').map(Number);
  let i = n - 1;
  const proyeccion = { fechas: [], valores: [] };
  while (true) {
    mes++;
    if (mes > 12) { mes = 1; anio++; }
    if (anio > ANIO_PROYECCION) break;
    i++;
    proyeccion.fechas.push(`${anio}-${String(mes).padStart(2, '0')}`);
    proyeccion.valores.push(+limitar(d.tendencia[0] + pasoMensual * i + patron[mes - 1]).toFixed(3));
  }
  return proyeccion;
}

const promedio = lista => lista.reduce((a, b) => a + b, 0) / lista.length;

function mostrarResultados(d) {
  window.prepararDiagnostico?.(d);
  const unidad = infoVariable(d.variable)?.unidad ?? '';
  // verde si el cambio es bueno para la gente, rojo si es malo (depende de la variable)
  const efecto = efectoCambio(d.variable, d.significativo, d.cambio_total);
  const clase = { bueno: 'sube', malo: 'baja', neutro: 'neutro' }[efecto];

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

  mostrarNivelVegetacion(d);

   const proyeccion = d.significativo ? calcularProyeccion(d) : null;
  const hayProyeccion = Boolean(proyeccion?.valores.length);


  let texto = d.resumen;
  if (!d.significativo) texto += ' Aunque no es significativo, con más años de datos podría llegar a serlo.';
  const u = unidad ? ' ' + unidad : '';
  if (hayProyeccion) {
    // Los dos números salen del MISMO modelo (tendencia + patrón de cada mes),
    // así la comparación 2025 → 2030 siempre va en la misma dirección que el % de cambio.
    const actual = promedio(valoresModelo(d).slice(-12));
    const futuro = promedio(proyeccion.valores.slice(-12));
    texto += ` Si la tendencia sigue igual, el promedio esperado pasaría de ${actual.toFixed(2)}${u} ` +
             `(${d.fechas.at(-1).slice(0, 4)}) a ${futuro.toFixed(2)}${u} en ${ANIO_PROYECCION}.`;
  } else if (!d.significativo) {
    texto += ' No se proyecta a futuro porque no hay una tendencia clara.';
  }
  document.getElementById('resumen').textContent = texto;

  const impacto = textoImpacto(d);
  document.getElementById('impacto').hidden = !impacto;
  document.getElementById('impacto-texto').textContent = impacto ?? '';

  // se muestra antes de dibujar para que la gráfica tome el tamaño real
  document.getElementById('resultados').hidden = false;

  if (d.variable === 'CAUDAL') {
    graficaBarrasAnuales(d, proyeccion, hayProyeccion, unidad);
    return;
  }

  const lineas = [
    { x: d.fechas, y: d.valores, name: nombreVariable(d.variable),
      mode: 'lines', line: { color: '#6fa8dc', width: 1.5 } },
    { x: d.fechas, y: d.tendencia, name: 'Tendencia',
      mode: 'lines', line: { color: '#1fb6a6', width: 3, dash: 'dot' } }
  ];
  if (hayProyeccion) {
        lineas.push({ x: proyeccion.fechas, y: proyeccion.valores, name: `Proyección a ${ANIO_PROYECCION}`,
      mode: 'lines', line: { color: '#f5b041', width: 2, dash: 'dash' } });
  }

  Plotly.newPlot('grafica', lineas, {
    autosize: true,
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#fff', size: 13 },
    margin: { t: 10, r: 10, b: 80, l: 55 },   // espacio abajo para la leyenda
    xaxis: { gridcolor: 'rgba(255,255,255,0.08)' },
    yaxis: { gridcolor: 'rgba(255,255,255,0.08)', title: unidad },
    legend: { orientation: 'h', x: 0, y: -0.15, yanchor: 'top' },   // leyenda debajo: así no tapa la gráfica
    shapes: hayProyeccion ? [{
      type: 'line', xref: 'x', yref: 'paper',
      x0: d.fechas.at(-1), x1: d.fechas.at(-1), y0: 0, y1: 1,
      line: { color: 'rgba(255,255,255,0.4)', width: 1, dash: 'dot' }
    }] : []
  }, { responsive: true, displayModeBar: false });
}

// ===== Tarjeta "Nivel de vegetación" (solo NDVI) =====
// Muestra CUÁNTO verde hay (no solo si cambió), para comparar zonas. Ej: Haití 0.64 vs RD 0.71.

function nivelNDVI(v) {
  if (v < 0.3) return { texto: 'Muy baja', color: '#e74c3c' };
  if (v < 0.5) return { texto: 'Baja', color: '#f39c12' };
  if (v < 0.7) return { texto: 'Moderada', color: '#a3d977' };
  return { texto: 'Alta', color: '#2ecc71' };
}

// Crea la 4.ª tarjeta una sola vez (así no hay que tocar index.html)
function tarjetaNivel() {
  let tarjeta = document.getElementById('t-nivel-tarjeta');
  if (tarjeta) return tarjeta;
  tarjeta = document.createElement('div');
  tarjeta.className = 'tarjeta';
  tarjeta.id = 't-nivel-tarjeta';
  tarjeta.innerHTML = `
    <span>Nivel de vegetación
      <button class="btn-ayuda" data-ayuda="Cuánto verde hay en promedio en los últimos años (NDVI de 0 a 1). Menos de 0.3: muy baja · 0.3–0.5: baja · 0.5–0.7: moderada · más de 0.7: alta. Sirve para comparar zonas aunque las dos estén subiendo.">?</button>
    </span>
    <b id="t-nivel"></b>
    <div style="height:8px;border-radius:999px;background:rgba(255,255,255,0.12);margin:6px 0 4px;overflow:hidden">
      <div id="t-nivel-barra" style="height:100%;width:0;border-radius:999px;transition:width .4s"></div>
    </div>
    <small id="t-nivel-periodo"></small>`;
  document.querySelector('#resultados .tarjetas').appendChild(tarjeta);
  return tarjeta;
}

function mostrarNivelVegetacion(d) {
  const tarjeta = tarjetaNivel();
  if (d.variable !== 'NDVI' || !d.valores?.length) {
    tarjeta.style.display = 'none';
    return;
  }
  // promedio de los últimos 5 años del rango elegido (o menos si el rango es corto)
  const ultimos = d.valores.slice(-60);
  const fechas = d.fechas.slice(-60);
  const valor = promedio(ultimos);
  const nivel = nivelNDVI(valor);

  const b = document.getElementById('t-nivel');
  b.textContent = `${valor.toFixed(2)} · ${nivel.texto}`;
  b.style.color = nivel.color;
  const barra = document.getElementById('t-nivel-barra');
  barra.style.width = `${Math.max(0, Math.min(1, valor)) * 100}%`;
  barra.style.background = nivel.color;
  document.getElementById('t-nivel-periodo').textContent =
    `Promedio ${fechas[0].slice(0, 4)}–${fechas.at(-1).slice(0, 4)}`;
  tarjeta.style.display = '';
}

// ===== Gráfica de barras por año (caudal) =====

// Agrupa una serie mensual en promedios por año: { anios: [2001, ...], valores: [...] }
function promediosPorAnio(fechas, valores) {
  const grupos = new Map();
  fechas.forEach((fecha, i) => {
    const anio = Number(fecha.slice(0, 4));
    if (!grupos.has(anio)) grupos.set(anio, []);
    grupos.get(anio).push(valores[i]);
  });
  const anios = [...grupos.keys()];
  return { anios, valores: anios.map(a => promedio(grupos.get(a))) };
}

function graficaBarrasAnuales(d, proyeccion, hayProyeccion, unidad) {
  const real = promediosPorAnio(d.fechas, d.valores);
  const modelo = promediosPorAnio(d.fechas, valoresModelo(d));
  const media = promedio(real.valores);
  const u = unidad ? ' ' + unidad : '';

  // Años con más agua que el promedio (azul) y con menos agua (café)
  const humedos = { x: [], y: [] }, secos = { x: [], y: [] };
  real.anios.forEach((anio, i) => {
    const grupo = real.valores[i] >= media ? humedos : secos;
    grupo.x.push(anio);
    grupo.y.push(real.valores[i]);
  });

  const formato = `%{x}: %{y:.1f}${u}<extra></extra>`;
  const trazos = [
    { type: 'bar', x: humedos.x, y: humedos.y, name: 'Más agua que el promedio',
      marker: { color: '#4a90d9' }, hovertemplate: formato },
    { type: 'bar', x: secos.x, y: secos.y, name: 'Menos agua (año seco)',
      marker: { color: '#b5835a' }, hovertemplate: formato }
  ];

  // Línea de tendencia: mismo modelo que el resumen, promediado por año
  const tendencia = { x: [...modelo.anios], y: [...modelo.valores] };

  if (hayProyeccion) {
    const futuro = promediosPorAnio(proyeccion.fechas, proyeccion.valores);
    trazos.push({ type: 'bar', x: futuro.anios, y: futuro.valores, name: `Proyección a ${ANIO_PROYECCION}`,
      marker: { color: 'rgba(245,176,65,0.45)', line: { color: '#f5b041', width: 1.5 } },
      hovertemplate: `%{x} (proyección): %{y:.1f}${u}<extra></extra>` });
    tendencia.x.push(...futuro.anios);
    tendencia.y.push(...futuro.valores);
  }

  trazos.push({ type: 'scatter', mode: 'lines', x: tendencia.x, y: tendencia.y, name: 'Tendencia',
    line: { color: '#1fb6a6', width: 3, dash: 'dot' }, hoverinfo: 'skip' });

  const ultimoAnio = real.anios.at(-1);
  Plotly.newPlot('grafica', trazos, {
    autosize: true,
    barmode: 'overlay',
    bargap: 0.15,
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#fff', size: 13 },
    margin: { t: 10, r: 10, b: 80, l: 55 },   // espacio abajo para la leyenda
    xaxis: { gridcolor: 'rgba(255,255,255,0.08)', tickformat: 'd', dtick: 5 },
    yaxis: { gridcolor: 'rgba(255,255,255,0.08)', title: unidad, rangemode: 'tozero' },
    legend: { orientation: 'h', x: 0, y: -0.15, yanchor: 'top' },   // leyenda debajo: así no tapa la gráfica
    shapes: [
      // promedio de todo el periodo
      { type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: media, y1: media,
        line: { color: 'rgba(255,255,255,0.45)', width: 1, dash: 'dash' } },
      // separación entre datos reales y proyección
      ...(hayProyeccion ? [{ type: 'line', xref: 'x', yref: 'paper',
        x0: ultimoAnio + 0.5, x1: ultimoAnio + 0.5, y0: 0, y1: 1,
        line: { color: 'rgba(255,255,255,0.4)', width: 1, dash: 'dot' } }] : [])
    ],
    annotations: [{ xref: 'paper', yref: 'y', x: 0, y: media, xanchor: 'left', yanchor: 'bottom',
      text: `promedio ${media.toFixed(1)}${u}`, showarrow: false,
      font: { size: 11, color: 'rgba(255,255,255,0.7)' } }]
  }, { responsive: true, displayModeBar: false });
}

// ===== Mapa de colores por región =====

// ¿Que esta variable SUBA es malo para la gente?
//   true  -> subir = rojo (malo), bajar = verde (bueno)   ej: temperatura
//   false -> subir = verde (bueno), bajar = rojo (malo)   ej: lluvia, humedad, caudal (menos agua = sequía)
const SUBIR_ES_MALO = {
  T2M: true,
  T2M_MAX: true,
  PRECTOTCORR: false,
  GWETROOT: false,
  CAUDAL: false,
  NDVI: false      // perder vegetación es malo
};

// 'malo', 'bueno' o 'neutro' según la variable y hacia dónde cambió
function efectoCambio(variable, significativo, cambio) {
  if (!significativo || cambio === 0) return 'neutro';
  const subio = cambio > 0;
  return subio === Boolean(SUBIR_ES_MALO[variable]) ? 'malo' : 'bueno';
}

const COLOR_EFECTO = { malo: '#e74c3c', bueno: '#2ecc71', neutro: '#8a9bb5' };

// La leyenda dice qué significa cada color para ESTA variable
function actualizarLeyenda(variable) {
  const filas = document.querySelectorAll('#leyenda div');
  if (filas.length < 2) return;
  const subirMalo = Boolean(SUBIR_ES_MALO[variable]);
  filas[0].innerHTML = `<span class="muestra" style="background:${COLOR_EFECTO.malo}"></span>` +
    (subirMalo ? 'Aumentó (malo)' : 'Disminuyó (malo)');
  filas[1].innerHTML = `<span class="muestra" style="background:${COLOR_EFECTO.bueno}"></span>` +
    (subirMalo ? 'Disminuyó (bueno)' : 'Aumentó (bueno)');
}

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
  actualizarLeyenda(variable);
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
      const color = COLOR_EFECTO[efectoCambio(variable, dato.significativo, dato.pendiente_decada)];
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
    window.reiniciarDiagnostico?.();
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
    const datos = await obtenerAnalisis(params);
    if (JSON.stringify(params) === JSON.stringify(leerParametros())) mostrarResultados(datos);
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