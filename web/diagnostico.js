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
  function ocupado(valor) {
    panel.setAttribute('aria-busy', String(valor));
    panel.querySelectorAll('.diag-acciones button, #diag-form button').forEach(b => b.disabled = valor);
  }
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
  }
  async function consultar(accion, texto = '') {
    if (!filtros) return;
    controlador?.abort(); controlador = new AbortController();
    const actual = ++version;
    ocupado(true); estado.textContent = 'Analizando las variables disponibles…';
    if (texto) agregar('Tu pregunta', texto, 'diag-usuario');
    const temporizador = setTimeout(() => controlador?.abort(), 60000);
    try {
      const r = await fetch(`${API}/api/diagnostico`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...filtros, accion, pregunta: texto, historial: historial.slice(-8) }),
        signal: controlador.signal
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo generar el diagnóstico.');
      if (actual !== version) return;
      if (accion !== 'preguntar') mensajes.replaceChildren();
      estado.textContent = d.aviso;
      if (d.texto) agregar(accion === 'preguntar' ? 'Respuesta' : 'Interpretación con IA', d.texto);
      else d.secciones.forEach(s => agregar(s.titulo, s.texto));
      if (!d.texto && !d.secciones.length) return;
      const respuesta = d.texto || d.secciones.map(s => `${s.titulo}: ${s.texto}`).join('\n');
      historial.push({ role: 'user', content: texto || accion },
        { role: 'assistant', content: respuesta.slice(0, 6000) });
      historial = historial.slice(-8); cargado = true;
      if (texto) pregunta.value = '';
    } catch (e) {
      if (actual === version) {
        estado.textContent = e.name === 'AbortError' ? 'La consulta tardó demasiado. Puedes reintentar con una acción.'
          : `No se pudo completar: ${e.message}. Comprueba que el servidor esté actualizado.`;
      }
    } finally {
      clearTimeout(temporizador);
      if (actual === version) ocupado(false);
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
