// Estado aislado por combinación de filtros. Las respuestas viejas se descartan.
(() => {
  const panel = document.getElementById('diagnostico');
  const abrir = document.getElementById('abrir-diagnostico');
  const mensajes = document.getElementById('diag-mensajes');
  const estado = document.getElementById('diag-estado');
  const pregunta = document.getElementById('diag-pregunta');
  let filtros = null, controlador = null, version = 0, historial = [], cargado = false;
  const redimensionar = () => requestAnimationFrame(() => {
    const grafica = document.getElementById('grafica');
    if (grafica.data && !document.getElementById('resultados').hidden) Plotly.Plots.resize(grafica);
  });
  function mostrar(abierto) {
    panel.hidden = !abierto;
    document.getElementById('resultados').classList.toggle('con-diagnostico', abierto);
    abrir.setAttribute('aria-expanded', String(abierto));
    redimensionar();
  }
  // Mientras carga, solo se bloquea "Enviar". Los botones rápidos siguen activos:
  // si se pulsa otro, se cancela la consulta anterior y se hace la nueva.
  function ocupado(valor) {
    panel.setAttribute('aria-busy', String(valor));
    panel.querySelectorAll('#diag-form button').forEach(b => b.disabled = valor);
  }
  const MENSAJES_ESPERA = {
    diagnostico: 'Analizando las 6 variables y buscando eventos de esos años…',
    explicar: 'Preparando la explicación con los números del análisis…',
    comparar: 'Comparando con las demás variables…',
    impacto: 'Analizando cómo afecta a esta zona…',
    causas: 'Buscando posibles causas en los datos y en internet (huracanes, El Niño…)…',
    futuro: 'Calculando cómo podría cambiar hasta 2030…',
    preguntar: 'Pensando la respuesta con los datos…'
  };
  window.reiniciarDiagnostico = () => {
    version++;
    controlador?.abort();
    filtros = null; historial = []; cargado = false;
    mensajes.replaceChildren(); pregunta.value = ''; estado.textContent = '';
    ocupado(false); mostrar(false);
  };
  window.prepararDiagnostico = d => {
    const abierto = !panel.hidden;
    window.reiniciarDiagnostico();
    filtros = { ...leerParametros(), zona: d.zona, variable: d.variable };
    document.getElementById('diag-contexto').textContent =
      `${nombreBonito(d.zona)} · ${nombreVariable(d.variable)} · ${filtros.desde}–${filtros.hasta}`;
    if (abierto) { mostrar(true); consultar('diagnostico'); }
  };
  function agregar(titulo, texto, clase = '') {
    const bloque = document.createElement('section');
    bloque.className = `diag-bloque ${clase}`;
    const h = document.createElement('h4'); h.textContent = titulo;
    const p = document.createElement('p'); p.textContent = texto;
    bloque.append(h, p); mensajes.append(bloque);
    return bloque;
  }
  // Lleva la vista al bloque nuevo para que siempre se vea la última respuesta
  const mostrarBloque = bloque => requestAnimationFrame(() =>
    mensajes.scrollTo({ top: bloque.offsetTop - mensajes.offsetTop - 8, behavior: 'smooth' }));
  const nombreAccion = accion =>
    panel.querySelector(`[data-diag="${accion}"]`)?.textContent.trim() || 'Diagnóstico';
  async function consultar(accion, texto = '') {
    if (!filtros) return;
    controlador?.abort(); controlador = new AbortController();
    const actual = ++version;
    ocupado(true); estado.textContent = MENSAJES_ESPERA[accion] || 'Analizando…';
    panel.querySelectorAll('[data-diag]').forEach(b => b.classList.toggle('activo', b.dataset.diag === accion));
    // Las respuestas se van ACUMULANDO (como un chat): nada se borra al pulsar otro botón
    mensajes.querySelectorAll('.diag-cargando').forEach(b => b.remove());
    if (texto) mostrarBloque(agregar('Tu pregunta', texto, 'diag-usuario'));
    else if (accion !== 'diagnostico') mostrarBloque(agregar('Tu pregunta', nombreAccion(accion), 'diag-usuario'));
    const cargando = agregar('…', MENSAJES_ESPERA[accion] || 'Analizando…', 'diag-cargando');
    mostrarBloque(cargando);
    const temporizador = setTimeout(() => controlador?.abort(), 100000);   // la búsqueda en internet puede tardar
    try {
      const r = await fetch(`${API}/api/diagnostico`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...filtros, accion, pregunta: texto, historial: historial.slice(-8) }),
        signal: controlador.signal
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo generar el diagnóstico.');
      if (actual !== version) return;
      cargando.remove();
      estado.textContent = d.aviso;
      const titulo = accion === 'preguntar' ? 'Respuesta' : accion === 'diagnostico' ? 'Diagnóstico' : nombreAccion(accion);
      const primero = d.texto ? agregar(titulo, d.texto)
        : d.secciones.map(s => agregar(s.titulo, s.texto))[0];
      if (primero) mostrarBloque(primero);
      if (!d.texto && !d.secciones.length) return;
      const respuesta = d.texto || d.secciones.map(s => `${s.titulo}: ${s.texto}`).join('\n');
      historial.push({ role: 'user', content: texto || accion },
        { role: 'assistant', content: respuesta.slice(0, 6000) });
      historial = historial.slice(-8); cargado = true;
      if (texto) pregunta.value = '';
    } catch (e) {
      if (actual === version) {
        cargando.remove();
        estado.textContent = e.name === 'AbortError' ? 'La consulta tardó demasiado. Puedes reintentar con un botón.'
          : `No se pudo completar: ${e.message}. Comprueba que el servidor esté actualizado.`;
      }
    } finally {
      clearTimeout(temporizador);
      if (actual === version) {
        ocupado(false);
        panel.querySelectorAll('[data-diag]').forEach(b => b.classList.remove('activo'));
      }
    }
  }
  abrir.onclick = () => {
    if (!filtros) return;
    mostrar(panel.hidden);
    if (!panel.hidden && !cargado) consultar('diagnostico');
  };
  document.getElementById('cerrar-diagnostico').onclick = () => { mostrar(false); abrir.focus(); };
  panel.querySelectorAll('[data-diag]').forEach(b => b.onclick = () => consultar(b.dataset.diag));
  document.getElementById('diag-form').onsubmit = e => {
    e.preventDefault();
    if (panel.getAttribute('aria-busy') !== 'true' && pregunta.value.trim()) consultar('preguntar', pregunta.value.trim());
  };
})();
