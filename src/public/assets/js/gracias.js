(function () {
  'use strict';

  const metaBox = document.getElementById('meta-box');
  const folioElem = document.getElementById('folio-val');
  const dateElem = document.getElementById('date-val');

  try {
    const raw = sessionStorage.getItem('encuesta_completada');
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.id && folioElem) {
        folioElem.textContent = '#' + data.id;
      }
      if (data && data.timestamp && dateElem) {
        const d = new Date(data.timestamp);
        dateElem.textContent = d.toLocaleString('es-MX', {
          dateStyle: 'medium',
          timeStyle: 'short'
        });
      }
      if (metaBox) {
        metaBox.classList.remove('is-hidden');
      }
    }
  } catch (e) {
    console.error('Error leyendo sesión de confirmación:', e);
  }
})();
