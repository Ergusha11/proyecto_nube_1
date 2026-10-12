/**
 * Formulario en la nube - Lógica de cliente (Vanilla JS)
 * Estrictamente compatible con CSP (sin eval, sin inline handlers)
 */

(function () {
  'use strict';

  let csrfToken = '';
  const TOTAL_PREGUNTAS = 16;

  const form = document.getElementById('cuestionario');
  const btnSubmit = document.getElementById('btn-submit');
  const errorSummaryBox = document.getElementById('error-summary');
  const generalStatusMsg = document.getElementById('general-status');
  const progressText = document.getElementById('progress-text');
  const progressBarFill = document.getElementById('progress-bar-fill');

  /**
   * Obtiene el token CSRF desde la API y lo almacena en memoria
   */
  async function fetchCsrfToken() {
    try {
      const response = await fetch('/api/csrf.php', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('Error al inicializar sesión de seguridad');
      }

      const data = await response.json();
      if (data && data.token) {
        csrfToken = data.token;
      }
    } catch (err) {
      console.error('Error al obtener token CSRF:', err);
      showGeneralMessage('Error de conexión con el servidor. Por favor, recarga la página.', 'error');
    }
  }

  /**
   * Actualiza el indicador de progreso en base a las preguntas respondidas
   */
  function updateProgress() {
    let answered = 0;
    for (let i = 1; i <= TOTAL_PREGUNTAS; i++) {
      const checked = form.querySelector(`input[name="p${i}"]:checked`);
      if (checked) {
        answered++;
      }
    }

    if (progressText && progressBarFill) {
      progressText.textContent = `${answered} de ${TOTAL_PREGUNTAS} respondidas`;
      const percent = Math.round((answered / TOTAL_PREGUNTAS) * 100);
      progressBarFill.style.width = `${percent}%`;
    }
  }

  /**
   * Limpia los errores visuales de la interfaz
   */
  function clearErrors() {
    if (errorSummaryBox) {
      errorSummaryBox.textContent = '';
    }

    if (generalStatusMsg) {
      generalStatusMsg.textContent = '';
      generalStatusMsg.className = 'general-status-msg';
    }

    for (let i = 1; i <= TOTAL_PREGUNTAS; i++) {
      const fieldset = document.getElementById(`q-p${i}`);
      const errElem = document.getElementById(`err-p${i}`);
      if (fieldset) {
        fieldset.classList.remove('has-error');
      }
      if (errElem) {
        errElem.textContent = '';
      }
    }
  }

  /**
   * Pinta un error en una pregunta específica
   */
  function showFieldError(questionKey, message) {
    const fieldset = document.getElementById(`q-${questionKey}`);
    const errElem = document.getElementById(`err-${questionKey}`);

    if (fieldset) {
      fieldset.classList.add('has-error');
    }
    if (errElem) {
      errElem.textContent = message;
    }
  }

  /**
   * Construye el cuadro resumen de errores arriba del botón de envío
   */
  function renderErrorSummary(errors) {
    if (!errorSummaryBox) return;

    errorSummaryBox.textContent = '';
    const title = document.createElement('h3');
    title.className = 'error-summary-title';
    title.textContent = 'Por favor responde todas las preguntas requeridas:';
    errorSummaryBox.appendChild(title);

    const list = document.createElement('ul');
    list.className = 'error-summary-list';

    let firstKey = null;

    Object.keys(errors).forEach((key) => {
      if (!firstKey) firstKey = key;
      const li = document.createElement('li');
      const link = document.createElement('span');
      link.className = 'error-summary-link';

      const qNum = key.replace('p', '');
      link.textContent = `Pregunta ${qNum}: ${errors[key]}`;
      link.addEventListener('click', () => {
        const target = document.getElementById(`q-${key}`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const firstRadio = target.querySelector('input[type="radio"]');
          if (firstRadio) firstRadio.focus();
        }
      });

      li.appendChild(link);
      list.appendChild(li);
    });

    errorSummaryBox.appendChild(list);

    if (firstKey) {
      const firstTarget = document.getElementById(`q-${firstKey}`);
      if (firstTarget) {
        firstTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  /**
   * Mensaje global de estado
   */
  function showGeneralMessage(msg, type = 'error') {
    if (!generalStatusMsg) return;
    generalStatusMsg.textContent = msg;
    generalStatusMsg.className = `general-status-msg ${type}`;
  }

  /**
   * Valida en cliente y prepara el cuerpo JSON
   */
  function validateAndCollect() {
    const errors = {};
    const respuestas = {};

    for (let i = 1; i <= TOTAL_PREGUNTAS; i++) {
      const key = `p${i}`;
      const checked = form.querySelector(`input[name="${key}"]:checked`);
      if (!checked) {
        errors[key] = 'Selecciona una opción';
      } else {
        const val = Number(checked.value);
        if (isNaN(val) || val < 1 || val > 5) {
          errors[key] = 'Valor fuera de rango';
        } else {
          respuestas[key] = val;
        }
      }
    }

    const hpInput = form.querySelector('input[name="website"]');
    const website = hpInput ? hpInput.value : '';

    return { errors, data: { respuestas, website } };
  }

  /**
   * Envía los datos a la API con manejo de reintento de CSRF
   */
  async function submitForm(datos, isRetry = false) {
    if (!csrfToken) {
      await fetchCsrfToken();
    }

    const response = await fetch('/api/submit.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'Accept': 'application/json'
      },
      body: JSON.stringify(datos)
    });

    if (response.status === 201) {
      const resData = await response.json().catch(() => ({}));
      // Redirigir a página de gracias
      const id = resData.id || '';
      sessionStorage.setItem('encuesta_completada', JSON.stringify({
        id: id,
        timestamp: new Date().toISOString()
      }));
      window.location.href = 'gracias.html';
      return;
    }

    if (response.status === 403) {
      if (!isRetry) {
        // Renovar token e intentar 1 sola vez
        await fetchCsrfToken();
        return submitForm(datos, true);
      }
      showGeneralMessage('Tu sesión de seguridad ha expirado. Por favor, recarga la página.', 'error');
      return;
    }

    if (response.status === 422) {
      const resData = await response.json();
      if (resData.errors) {
        Object.keys(resData.errors).forEach((key) => {
          showFieldError(key, resData.errors[key]);
        });
        renderErrorSummary(resData.errors);
      }
      return;
    }

    if (response.status === 429) {
      showGeneralMessage('Has enviado demasiadas solicitudes. Por favor, intenta de nuevo en un minuto.', 'warning');
      return;
    }

    if (response.status === 413) {
      showGeneralMessage('El tamaño de los datos excede el límite permitido por el servidor.', 'error');
      return;
    }

    showGeneralMessage('Ocurrió un error en el servidor. Por favor, intenta más tarde.', 'error');
  }

  // Escuchar cambios en radio buttons para progreso y limpieza de error individual
  form.addEventListener('change', function (e) {
    if (e.target && e.target.type === 'radio') {
      const questionName = e.target.name;
      const fieldset = document.getElementById(`q-${questionName}`);
      const errElem = document.getElementById(`err-${questionName}`);

      if (fieldset) fieldset.classList.remove('has-error');
      if (errElem) errElem.textContent = '';

      updateProgress();
    }
  });

  // Manejo de envío
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearErrors();

    const { errors, data } = validateAndCollect();

    if (Object.keys(errors).length > 0) {
      Object.keys(errors).forEach((key) => {
        showFieldError(key, errors[key]);
      });
      renderErrorSummary(errors);
      return;
    }

    // Deshabilitar botón durante el envío para evitar doble clic
    btnSubmit.disabled = true;
    btnSubmit.classList.add('is-loading');

    try {
      await submitForm(data);
    } catch (err) {
      console.error('Error en el envío:', err);
      showGeneralMessage('No se pudo conectar con el servidor. Revisa tu conexión a internet.', 'error');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.classList.remove('is-loading');
    }
  });

  // Inicialización al cargar la página
  document.addEventListener('DOMContentLoaded', function () {
    fetchCsrfToken();
    updateProgress();
  });
})();
