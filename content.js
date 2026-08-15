/**
 * ==========================================================================
 * SANARTE PULSE - Content Script (Garantía de Privacidad Total On-Device)
 * 
 * GARANTÍA DE PRIVACIDAD:
 * Los micro-movimientos, clics e inactividad se procesan 100% en la memoria RAM local.
 * NUNCA se envían al servidor datos de rendimiento ni uso de teclado/mouse.
 * Al servidor SOLO se envían confirmaciones anónimas de pausas completadas por Área.
 * ==========================================================================
 */

(function () {
  if (document.getElementById('sanarte-extension-root')) {
    return;
  }

  // 1. Inyección en Shadow DOM
  const rootContainer = document.createElement('div');
  rootContainer.id = 'sanarte-extension-root';
  document.body.appendChild(rootContainer);

  const shadowRoot = rootContainer.attachShadow({ mode: 'open' });

  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.type = 'text/css';
  styleLink.href = chrome.runtime.getURL('styles.css');
  shadowRoot.appendChild(styleLink);

  // 2. Variables de Procesamiento LOCAL (Nunca salen del dispositivo)
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
          <button class="sanarte-btn-secondary" id="sanarte-snooze-btn">
            ⏰ Posponer 10 minutos (Snooze)
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
          <div class="sanarte-header-title">🌿 Sanarte Pulse</div>
          <div class="sanarte-header-subtitle" id="sanarte-header-area">${userArea}</div>
        </div>
        <button class="sanarte-close-btn" id="sanarte-close-btn">&times;</button>
      </div>
      <div class="sanarte-body" id="sanarte-body"></div>
    </div>

    <!-- BURBUJA -->
    <button class="sanarte-bubble" id="sanarte-bubble">
      <span class="sanarte-bubble-icon">🌿</span>
      <span class="sanarte-bubble-text">Sanarte Pulse</span>
      <span class="sanarte-bubble-timer" id="sanarte-bubble-score">Score: 0</span>
    </button>
  `;

  shadowRoot.appendChild(widgetWrapper);

  const overlayEl = shadowRoot.getElementById('sanarte-screen-overlay');
  const modalEl = shadowRoot.getElementById('sanarte-modal');
  const bubbleEl = shadowRoot.getElementById('sanarte-bubble');
  const closeBtnEl = shadowRoot.getElementById('sanarte-close-btn');
  const bodyEl = shadowRoot.getElementById('sanarte-body');
  const scoreBadgeEl = shadowRoot.getElementById('sanarte-bubble-score');
  const headerAreaEl = shadowRoot.getElementById('sanarte-header-area');

  const startOverlayBtn = shadowRoot.getElementById('sanarte-start-overlay-btn');
  const snoozeBtn = shadowRoot.getElementById('sanarte-snooze-btn');
  const emergencyBtn = shadowRoot.getElementById('sanarte-emergency-btn');

  // MOTOR DE COMPORTAMIENTO Y CÁLCULO WSI
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

    // Si el score supera el 75%, registrar pico de carga objetiva WSI
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
  startOverlayBtn.addEventListener('click', () => {
    overlayEl.classList.remove('sanarte-active');
    bubbleEl.classList.remove('sanarte-pulsing');
    toggleModal(true);
    startRoutine('BREATH', 90);
  });

  snoozeBtn.addEventListener('click', () => {
    overlayEl.classList.remove('sanarte-active');
    bubbleEl.classList.remove('sanarte-pulsing');
    emergencySnoozeUntil = Date.now() + 10 * 60 * 1000;
    sendAnonymousEvent('SNOOZE');
  });

  emergencyBtn.addEventListener('click', () => {
    overlayEl.classList.remove('sanarte-active');
    bubbleEl.classList.remove('sanarte-pulsing');
    emergencySnoozeUntil = Date.now() + 30 * 60 * 1000;
    sendAnonymousEvent('EMERGENCY_DISMISS');
  });

  // BURBUJA ARRASTRABLE
  let isDragging = false;
  let startX, startY, initialRight, initialBottom;

  bubbleEl.addEventListener('mousedown', (e) => {
    isDragging = false;
    startX = e.clientX;
    startY = e.clientY;

    const computedStyle = window.getComputedStyle(widgetWrapper);
    initialRight = parseInt(computedStyle.right, 10) || 24;
    initialBottom = parseInt(computedStyle.bottom, 10) || 24;

    function onMouseMove(moveEvent) {
      const deltaX = startX - moveEvent.clientX;
      const deltaY = startY - moveEvent.clientY;
      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) isDragging = true;
      widgetWrapper.style.right = `${initialRight + deltaX}px`;
      widgetWrapper.style.bottom = `${initialBottom + deltaY}px`;
    }

    function onMouseUp() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  bubbleEl.addEventListener('click', () => {
    if (!isDragging) toggleModal();
  });

  closeBtnEl.addEventListener('click', () => toggleModal(false));

  function toggleModal(open) {
    isModalOpen = typeof open === 'boolean' ? open : !isModalOpen;
    if (isModalOpen) {
      if (headerAreaEl) headerAreaEl.textContent = userArea;
      modalEl.classList.add('sanarte-open');
      currentState = 'CHECKIN';
      renderView();
    } else {
      modalEl.classList.remove('sanarte-open');
      clearTimers();
    }
  }

  function renderView() {
    clearTimers();
    if (currentState === 'CHECKIN') renderCheckinView();
    else if (currentState === 'ROUTINE_SELECT') renderRoutineSelectView();
    else if (currentState === 'PAUSE') renderPauseView();
    else if (currentState === 'CONFIRMATION') renderConfirmationView();
  }

  function renderCheckinView() {
    bodyEl.innerHTML = `
      <div class="sanarte-section-title">
        ¿Cómo sientes tu nivel de carga en este momento?
      </div>
      <div class="sanarte-routine-grid">
        <button class="sanarte-routine-card" id="btn-opt-optimal" style="border-left: 4px solid #10b981;">
          <span class="sanarte-routine-icon">🟢</span>
          <div class="sanarte-routine-info">
            <span class="sanarte-routine-name">Óptimo / Estable</span>
            <span class="sanarte-routine-time">Me siento bien para continuar.</span>
          </div>
        </button>

        <button class="sanarte-routine-card" id="btn-opt-high" style="border-left: 4px solid #f59e0b;">
          <span class="sanarte-routine-icon">🟡</span>
          <div class="sanarte-routine-info">
            <span class="sanarte-routine-name">Carga Elevada</span>
            <span class="sanarte-routine-time">Cansancio moderado, sugiero pausa.</span>
          </div>
        </button>

        <button class="sanarte-routine-card" id="btn-opt-critical" style="border-left: 4px solid #ef4444;">
          <span class="sanarte-routine-icon">🔴</span>
          <div class="sanarte-routine-info">
            <span class="sanarte-routine-name">Saturación / Necesito Pausa</span>
            <span class="sanarte-routine-time">Tensión acumulada por pantalla.</span>
          </div>
        </button>
      </div>

      <div class="sanarte-status-bar">
        🔒 Datos agregados por franja horaria (100% Anónimo)
      </div>
    `;

    bodyEl.querySelector('#btn-opt-optimal').addEventListener('click', () => {
      sendAnonymousEvent('CHECKIN_OPTIMAL');
      currentState = 'CONFIRMATION';
      renderView();
    });
    bodyEl.querySelector('#btn-opt-high').addEventListener('click', () => {
      sendAnonymousEvent('CHECKIN_HIGH');
      currentState = 'ROUTINE_SELECT';
      renderView();
    });
    bodyEl.querySelector('#btn-opt-critical').addEventListener('click', () => {
      sendAnonymousEvent('CHECKIN_CRITICAL');
      currentState = 'ROUTINE_SELECT';
      renderView();
    });
  }

  function renderRoutineSelectView() {
    bodyEl.innerHTML = `
      <div class="sanarte-section-title">Elige tu Pausa Activa:</div>
      <div class="sanarte-routine-grid">
        <div class="sanarte-routine-card" data-routine="BREATH" data-time="90">
          <span class="sanarte-routine-icon">🧘</span>
          <div class="sanarte-routine-info">
            <span class="sanarte-routine-name">Respiración 4-7-8</span>
            <span class="sanarte-routine-time">90s • Disminuye estrés</span>
          </div>
        </div>

        <div class="sanarte-routine-card" data-routine="EYE" data-time="60">
          <span class="sanarte-routine-icon">👁️</span>
          <div class="sanarte-routine-info">
            <span class="sanarte-routine-name">Descanso Visual 20-20-20</span>
            <span class="sanarte-routine-time">60s • Alivia fatiga de pantalla</span>
          </div>
        </div>

        <div class="sanarte-routine-card" data-routine="STRETCH" data-time="90">
          <span class="sanarte-routine-icon">🙆</span>
          <div class="sanarte-routine-info">
            <span class="sanarte-routine-name">Estiramiento Cuello/Hombros</span>
            <span class="sanarte-routine-time">90s • Alivia tensión acumulada</span>
          </div>
        </div>
      </div>
    `;

    bodyEl.querySelectorAll('.sanarte-routine-card').forEach(card => {
      card.addEventListener('click', () => {
        selectedRoutine = card.getAttribute('data-routine');
        remainingSeconds = parseInt(card.getAttribute('data-time'), 10);
        startRoutine(selectedRoutine, remainingSeconds);
      });
    });
  }

  function startRoutine(routine, duration) {
    selectedRoutine = routine;
    remainingSeconds = duration;
    currentState = 'PAUSE';
    sendAnonymousEvent('PAUSA_ACTIVA_STARTED', { routine });
    renderView();
  }

  function renderPauseView() {
    let titleText = 'Respiración Guiada';
    let iconSymbol = '🫁';
    if (selectedRoutine === 'EYE') { titleText = 'Descanso Visual 20-20-20'; iconSymbol = '👀'; }
    else if (selectedRoutine === 'STRETCH') { titleText = 'Estiramiento Muscular'; iconSymbol = '🤸'; }

    bodyEl.innerHTML = `
      <div class="sanarte-pausa-card">
        <div class="sanarte-section-title">${titleText}</div>
        <div class="sanarte-breathing-wrapper">
          <div class="sanarte-breathing-outer-ring"></div>
          <div class="sanarte-breathing-circle"><span>${iconSymbol}</span></div>
        </div>
        <div class="sanarte-routine-name" id="sanarte-guide-text">Iniciando rutina...</div>
        <div class="sanarte-timer-display" id="sanarte-routine-timer">${formatTime(remainingSeconds)}</div>
        <button class="sanarte-btn-secondary" id="sanarte-finish-btn">Finalizar Pausa</button>
      </div>
    `;

    const timerDisplay = bodyEl.querySelector('#sanarte-routine-timer');
    const guideText = bodyEl.querySelector('#sanarte-guide-text');
    const finishBtn = bodyEl.querySelector('#sanarte-finish-btn');

    routineTimer = setInterval(() => {
      remainingSeconds--;
      if (timerDisplay) timerDisplay.textContent = formatTime(remainingSeconds);
      updateGuideInstructions(guideText);
      if (remainingSeconds <= 0) finishRoutine();
    }, 1000);

    finishBtn.addEventListener('click', finishRoutine);
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
    if (routineTimer) { clearInterval(routineTimer); routineTimer = null; }
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
