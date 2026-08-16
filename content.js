/**
 * ==========================================================================
 * SANARTE ACTIVA - Content Script (Versión Ultra Robusta)
 * Drag & Drop libre + Apertura instantánea de Encuesta de Estrés
 * ==========================================================================
 */

(function () {
  if (document.getElementById('sanarte-extension-root')) {
    return;
  }

  // 1. Raíz Shadow DOM
  const rootContainer = document.createElement('div');
  rootContainer.id = 'sanarte-extension-root';
  document.body.appendChild(rootContainer);

  const shadowRoot = rootContainer.attachShadow({ mode: 'open' });

  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.type = 'text/css';
  styleLink.href = chrome.runtime.getURL('styles.css');
  shadowRoot.appendChild(styleLink);

  // 2. Variables de Estado Local
  let continuousActiveMinutes = 0;
  let lastUserActivity = Date.now();
  let interactionEventsCount = 0;
  let naturalBreakThreshold = 3 * 60 * 1000;
  let localFatigueScore = 0;
  let emergencySnoozeUntil = 0;

  let currentState = 'CHECKIN';
  let selectedRoutine = 'BREATH';
  let isModalOpen = false;
  let routineTimer = null;
  let remainingSeconds = 90;
  let userArea = 'Administración / Asistencial';

  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['sanarte_area', 'sanarte_pending_events'], (res) => {
      if (res.sanarte_area) userArea = res.sanarte_area;
      if (res.sanarte_pending_events && res.sanarte_pending_events.length > 0) {
        syncPendingEvents(res.sanarte_pending_events);
      }
    });
  }

  // 3. Estructura HTML
  const widgetWrapper = document.createElement('div');
  widgetWrapper.className = 'sanarte-container';

  widgetWrapper.innerHTML = `
    <!-- CONTROL DE PANTALLA OVERLAY -->
    <div class="sanarte-screen-overlay" id="sanarte-screen-overlay">
      <div class="sanarte-overlay-card">
        <div class="sanarte-overlay-badge">🌿 Pausa Activa Sugerida</div>
        <div class="sanarte-overlay-title">¡Es tiempo de cuidar tu salud laboral!</div>
        <div class="sanarte-overlay-desc">
          Detectamos una sesión continua e intensa en pantalla. Tómate 90 segundos para relajar tu vista y postura.
        </div>
        
        <div class="sanarte-action-group">
          <button class="sanarte-btn-primary" id="sanarte-start-overlay-btn">
            ▶ Iniciar Pausa Activa (90s)
          </button>
          <button class="sanarte-btn-danger" id="sanarte-emergency-btn">
            🚨 Omitir por Carga Laboral
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL -->
    <div class="sanarte-modal" id="sanarte-modal">
      <div class="sanarte-header">
        <div>
          <div class="sanarte-header-title">🌿 Sanarte Activa</div>
          <div class="sanarte-header-subtitle" id="sanarte-header-area">${userArea}</div>
        </div>
        <button class="sanarte-close-btn" id="sanarte-close-btn">&times;</button>
      </div>
      <div class="sanarte-body" id="sanarte-body"></div>
    </div>

    <!-- BURBUJA -->
    <button class="sanarte-bubble" id="sanarte-bubble">
      <span class="sanarte-bubble-icon">🌿</span>
      <span class="sanarte-bubble-text">Sanarte Activa</span>
      <span class="sanarte-bubble-timer" id="sanarte-bubble-score">Score: 0%</span>
    </button>
  `;

  shadowRoot.appendChild(widgetWrapper);

  // Referencias a Elementos usando querySelector
  const overlayEl = shadowRoot.querySelector('#sanarte-screen-overlay');
  const overlayCardEl = shadowRoot.querySelector('.sanarte-overlay-card');
  const modalEl = shadowRoot.querySelector('#sanarte-modal');
  const bubbleEl = shadowRoot.querySelector('#sanarte-bubble');
  const closeBtnEl = shadowRoot.querySelector('#sanarte-close-btn');
  const bodyEl = shadowRoot.querySelector('#sanarte-body');
  const scoreBadgeEl = shadowRoot.querySelector('#sanarte-bubble-score');
  const headerAreaEl = shadowRoot.querySelector('#sanarte-header-area');

  const startOverlayBtn = shadowRoot.querySelector('#sanarte-start-overlay-btn');
  const emergencyBtn = shadowRoot.querySelector('#sanarte-emergency-btn');

  function triggerAdaptativeOverlay(reason) {
    if (overlayCardEl) overlayCardEl.style.display = 'flex';
    overlayEl.classList.add('sanarte-active');
    sendAnonymousEvent('ADAPTATIVE_BREAK_TRIGGERED', { reason });
  }

  // MOTOR DE COMPORTAMIENTO LOCAL
  function onUserInteraction() {
    const now = Date.now();
    if (now - lastUserActivity > naturalBreakThreshold) {
      continuousActiveMinutes = 0;
      localFatigueScore = Math.max(0, localFatigueScore - 40);
    }
    lastUserActivity = now;
    interactionEventsCount++;
  }

  window.addEventListener('mousemove', onUserInteraction, { passive: true });
  window.addEventListener('keydown', onUserInteraction, { passive: true });

  setInterval(() => {
    const now = Date.now();
    const isRecentlyActive = (now - lastUserActivity) < 60000;

    if (isRecentlyActive) {
      continuousActiveMinutes += 0.5;
      const timeFactor = Math.min(60, continuousActiveMinutes * 1.5);
      const densityFactor = Math.min(40, interactionEventsCount * 0.5);
      localFatigueScore = Math.min(100, Math.round(timeFactor + densityFactor));
      interactionEventsCount = 0;
    } else {
      localFatigueScore = Math.max(0, localFatigueScore - 5);
    }

    if (scoreBadgeEl) {
      scoreBadgeEl.textContent = `Score: ${localFatigueScore}%`;
    }

    if (localFatigueScore >= 75 && (now - lastUserActivity < 60000)) {
      sendStressPeakEvent(localFatigueScore);
    }

    if (now > emergencySnoozeUntil) {
      if (localFatigueScore >= 80) {
        overlayEl.classList.add('sanarte-active');
      } else if (localFatigueScore >= 60) {
        bubbleEl.classList.add('sanarte-pulsing');
      } else {
        bubbleEl.classList.remove('sanarte-pulsing');
      }
    }
  }, 30000);

  function sendStressPeakEvent(wsiScore) {
    const d = new Date();
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    sendAnonymousEvent('WORKLOAD_STRESS_PEAK', {
      hourOfDay: d.getHours(),
      dayOfWeek: days[d.getDay()],
      wsiScore
    });
  }

  // ACCIONES DEL OVERLAY
  startOverlayBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (overlayCardEl) overlayCardEl.style.display = 'none';
    bubbleEl.classList.remove('sanarte-pulsing');

    selectedRoutine = 'BREATH';
    remainingSeconds = 90;
    currentState = 'PAUSE';

    if (headerAreaEl) headerAreaEl.textContent = userArea;
    modalEl.classList.add('sanarte-open');
    isModalOpen = true;
    renderView();
  });

  emergencyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (overlayCardEl) overlayCardEl.style.display = 'none';
    overlayEl.classList.remove('sanarte-active');
    bubbleEl.classList.remove('sanarte-pulsing');
    emergencySnoozeUntil = Date.now() + 30 * 60 * 1000;
    sendAnonymousEvent('EMERGENCY_DISMISS');
  });

  // ESCUCHA DE MENSAJES DESDE POPUP
  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
      if (req.action === 'TRIGGER_BREAK') {
        triggerAdaptativeOverlay('Prueba manual de control de pantalla');
      } else if (req.action === 'OPEN_WIDGET') {
        toggleModal(true);
      }
      sendResponse({ status: 'OK' });
      return true;
    });
  }

  // ==========================================================================
  // LÓGICA DE ARRASTRE Y CLIC ULTRA ESTABLE DE LA BURBUJA FLOTANTE
  // ==========================================================================
  let isMoving = false;
  let startX = 0, startY = 0;
  let startRight = 24, startBottom = 24;

  bubbleEl.onmousedown = function (e) {
    isMoving = false;
    startX = e.clientX;
    startY = e.clientY;

    const computedStyle = window.getComputedStyle(widgetWrapper);
    startRight = parseInt(computedStyle.right, 10) || 24;
    startBottom = parseInt(computedStyle.bottom, 10) || 24;

    document.onmousemove = function (moveEvent) {
      const dx = startX - moveEvent.clientX;
      const dy = startY - moveEvent.clientY;

      // Si se mueve más de 4 píxeles, marcar como arrastre
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        isMoving = true;
        widgetWrapper.style.right = (startRight + dx) + 'px';
        widgetWrapper.style.bottom = (startBottom + dy) + 'px';
      }
    };

    document.onmouseup = function () {
      document.onmousemove = null;
      document.onmouseup = null;
    };
  };

  bubbleEl.onclick = function (e) {
    if (!isMoving) {
      toggleModal();
    }
  };

  closeBtnEl.onclick = function (e) {
    toggleModal(false);
  };

  function toggleModal(open) {
    isModalOpen = typeof open === 'boolean' ? open : !isModalOpen;
    if (isModalOpen) {
      if (headerAreaEl) headerAreaEl.textContent = userArea;
      modalEl.classList.add('sanarte-open');
      currentState = 'CHECKIN';
      renderView();
    } else {
      modalEl.classList.remove('sanarte-open');
      modalEl.classList.remove('sanarte-modal-large');
      overlayEl.classList.remove('sanarte-active');
      if (overlayCardEl) overlayCardEl.style.display = 'flex';
      closeBtnEl.style.display = 'flex';
      clearTimers();
    }
  }

  // ==========================================================================
  // VISTAS DEL WIDGET
  // ==========================================================================
  function renderView() {
    clearTimers();
    if (currentState === 'CHECKIN') renderCheckinView();
    else if (currentState === 'ROUTINE_SELECT') renderRoutineSelectView();
    else if (currentState === 'PAUSE') renderPauseView();
    else if (currentState === 'CONFIRMATION') renderConfirmationView();
  }

  // VISTA 1: Encuesta de Nivel de Estrés
  function renderCheckinView() {
    bodyEl.innerHTML = `
      <div class="sanarte-section-title">
        Encuesta de Salud Laboral:<br>¿Cuál es tu nivel de estrés en este momento?
      </div>
      <div class="sanarte-routine-grid">
        <button class="sanarte-routine-card" id="btn-stress-1" style="border-left: 4px solid #10b981;">
          <span class="sanarte-routine-icon">🟢</span>
          <div class="sanarte-routine-info">
            <span class="sanarte-routine-name">Nivel 1: Bajo / Estable</span>
            <span class="sanarte-routine-time">Me siento con buena energía y sin tensión.</span>
          </div>
        </button>

        <button class="sanarte-routine-card" id="btn-stress-2" style="border-left: 4px solid #f59e0b;">
          <span class="sanarte-routine-icon">🟡</span>
          <div class="sanarte-routine-info">
            <span class="sanarte-routine-name">Nivel 2: Moderado</span>
            <span class="sanarte-routine-time">Cierta tensión en vista o postura.</span>
          </div>
        </button>

        <button class="sanarte-routine-card" id="btn-stress-3" style="border-left: 4px solid #f97316;">
          <span class="sanarte-routine-icon">🟠</span>
          <div class="sanarte-routine-info">
            <span class="sanarte-routine-name">Nivel 3: Elevado</span>
            <span class="sanarte-routine-time">Carga intensa, necesito descompresión.</span>
          </div>
        </button>

        <button class="sanarte-routine-card" id="btn-stress-4" style="border-left: 4px solid #ef4444;">
          <span class="sanarte-routine-icon">🔴</span>
          <div class="sanarte-routine-info">
            <span class="sanarte-routine-name">Nivel 4: Severo / Saturación</span>
            <span class="sanarte-routine-time">Agotamiento alto, requiere pausa urgente.</span>
          </div>
        </button>
      </div>

      <div class="sanarte-status-bar">
        🔒 Encuesta 100% Anónima (Procesamiento On-Device)
      </div>
    `;

    bodyEl.querySelector('#btn-stress-1').onclick = function () {
      sendAnonymousEvent('STRESS_SURVEY_RESPONSE', { stressLevel: 1, stressLabel: 'Bajo' });
      selectedRoutine = 'EYE';
      remainingSeconds = 60;
      currentState = 'PAUSE';
      renderView();
    };

    bodyEl.querySelector('#btn-stress-2').onclick = function () {
      sendAnonymousEvent('STRESS_SURVEY_RESPONSE', { stressLevel: 2, stressLabel: 'Moderado' });
      selectedRoutine = 'BREATH';
      remainingSeconds = 90;
      currentState = 'PAUSE';
      renderView();
    };

    bodyEl.querySelector('#btn-stress-3').onclick = function () {
      sendAnonymousEvent('STRESS_SURVEY_RESPONSE', { stressLevel: 3, stressLabel: 'Elevado' });
      selectedRoutine = 'STRETCH';
      remainingSeconds = 90;
      currentState = 'PAUSE';
      renderView();
    };

    bodyEl.querySelector('#btn-stress-4').onclick = function () {
      sendAnonymousEvent('STRESS_SURVEY_RESPONSE', { stressLevel: 4, stressLabel: 'Severo' });
      selectedRoutine = 'VIDEO_YT';
      remainingSeconds = 90;
      currentState = 'PAUSE';
      renderView();
    };
  }

  function renderRoutineSelectView() {
    renderCheckinView();
  }

  function startRoutine(routine, duration) {
    clearTimers();
    selectedRoutine = routine;
    remainingSeconds = duration;
    currentState = 'PAUSE';
    sendAnonymousEvent('PAUSA_ACTIVA_STARTED', { routine });
    renderView();
  }

  function renderPauseView() {
    clearTimers();

    modalEl.classList.add('sanarte-modal-large');
    overlayEl.classList.add('sanarte-active');
    closeBtnEl.style.display = 'none';

    let titleText = 'Respiración Guiada';
    let isVideoMode = selectedRoutine === 'VIDEO_YT';

    if (selectedRoutine === 'EYE') titleText = 'Descanso Visual 20-20-20';
    else if (selectedRoutine === 'STRETCH') titleText = 'Estiramiento Muscular';
    else if (selectedRoutine === 'VIDEO_YT') titleText = 'Video Guiado de Pausa Activa';

    const ytVideoId = 'inpok4MKVLM';

    bodyEl.innerHTML = `
      <div class="sanarte-pausa-card">
        <div class="sanarte-section-title">${titleText}</div>

        <div class="sanarte-mode-toggle">
          <button class="sanarte-tab-btn ${!isVideoMode ? 'active' : ''}" id="btn-toggle-anim">🧘 Animación</button>
          <button class="sanarte-tab-btn ${isVideoMode ? 'active' : ''}" id="btn-toggle-video">📺 Video</button>
        </div>

        <div id="sanarte-routine-container" style="width:100%;">
          ${isVideoMode ? `
            <div class="sanarte-video-wrapper">
              <iframe 
                src="https://www.youtube-nocookie.com/embed/${ytVideoId}?autoplay=1&rel=0&modestbranding=1" 
                title="Video de Pausa Activa"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen>
              </iframe>
            </div>
          ` : `
            <div class="sanarte-breathing-wrapper" style="margin:10px auto 16px auto;">
              <div class="sanarte-breathing-outer-ring"></div>
              <div class="sanarte-breathing-circle"><span>🫁</span></div>
            </div>
          `}
        </div>

        ${isVideoMode ? '' : `
          <div class="sanarte-routine-name" id="sanarte-guide-text">
            Iniciando rutina...
          </div>
          <div class="sanarte-timer-display" id="sanarte-routine-timer">${formatTime(remainingSeconds)}</div>
        `}
      </div>
    `;

    const btnAnim = bodyEl.querySelector('#btn-toggle-anim');
    const btnVideo = bodyEl.querySelector('#btn-toggle-video');

    btnAnim.onclick = function () {
      selectedRoutine = 'BREATH';
      remainingSeconds = 90;
      renderPauseView();
    };

    btnVideo.onclick = function () {
      selectedRoutine = 'VIDEO_YT';
      remainingSeconds = 90;
      renderPauseView();
    };

    const timerDisplay = bodyEl.querySelector('#sanarte-routine-timer');
    const guideText = bodyEl.querySelector('#sanarte-guide-text');

    routineTimer = setInterval(() => {
      remainingSeconds--;
      if (timerDisplay) timerDisplay.textContent = formatTime(remainingSeconds);
      if (!isVideoMode) updateGuideInstructions(guideText);

      if (remainingSeconds <= 0) {
        finishRoutine();
      }
    }, 1000);
  }

  function updateGuideInstructions(element) {
    if (!element) return;
    if (selectedRoutine === 'BREATH') {
      const step = (90 - remainingSeconds) % 19;
      if (step < 4) element.textContent = '🫁 Inhala profundamente por la nariz (4s)...';
      else if (step < 11) element.textContent = '✋ Mantén el aire suavemente (7s)...';
      else element.textContent = '🌬️ Exhala lentamente por la boca (8s)...';
    } else if (selectedRoutine === 'EYE') {
      element.textContent = '👁️ Parpadea suavemente y enfoca a 6 metros de distancia.';
    } else {
      const step = (90 - remainingSeconds) % 30;
      if (step < 10) element.textContent = '🙆 Inclina tu cabeza hacia la derecha.';
      else if (step < 20) element.textContent = '🙆 Inclina tu cabeza hacia la izquierda.';
      else element.textContent = '🔄 Rotación suave de hombros.';
    }
  }

  function finishRoutine() {
    clearTimers();
    localFatigueScore = 0;
    continuousActiveMinutes = 0;

    modalEl.classList.remove('sanarte-modal-large');
    overlayEl.classList.remove('sanarte-active');
    if (overlayCardEl) overlayCardEl.style.display = 'flex';
    closeBtnEl.style.display = 'flex';

    currentState = 'CONFIRMATION';
    sendAnonymousEvent('PAUSA_ACTIVA_COMPLETED', { routine: selectedRoutine });
    renderView();
  }

  function renderConfirmationView() {
    bodyEl.innerHTML = `
      <div style="text-align:center; padding: 20px 0; display:flex; flex-direction:column; gap:12px; align-items:center;">
        <div style="width:48px; height:48px; background:#dcfce7; color:#16a34a; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:24px;">✓</div>
        <div style="font-size:16px; font-weight:700; color:#0f172a;">¡Pausa Registrada!</div>
        <div style="font-size:12.5px; color:#475569; line-height:1.4;">
          Registro 100% anónimo completado.
        </div>
      </div>
    `;
    setTimeout(() => toggleModal(false), 3000);
  }

  function clearTimers() {
    if (routineTimer) {
      clearInterval(routineTimer);
      routineTimer = null;
    }
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  async function sendAnonymousEvent(eventType, extraData = {}) {
    const payload = {
      timestamp: new Date().toISOString(),
      eventType,
      area: userArea,
      ...extraData
    };

    try {
      const res = await fetch('http://localhost:3000/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Error status');
    } catch (err) {
      enqueueOfflineEvent(payload);
    }
  }

  function enqueueOfflineEvent(payload) {
    if (!chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.get(['sanarte_pending_events'], (res) => {
      const pending = res.sanarte_pending_events || [];
      pending.push(payload);
      chrome.storage.local.set({ sanarte_pending_events: pending });
    });
  }

  async function syncPendingEvents(pendingEvents) {
    try {
      const res = await fetch('http://localhost:3000/api/events/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: pendingEvents })
      });
      if (res.ok && chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove('sanarte_pending_events');
      }
    } catch (e) { }
  }
})();
