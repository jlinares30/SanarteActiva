document.addEventListener('DOMContentLoaded', () => {
  const selectArea = document.getElementById('select-area');
  const triggerOverlayBtn = document.getElementById('btn-trigger-overlay');
  const openWidgetBtn = document.getElementById('btn-open-widget');

  // Cargar área guardada
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['sanarte_area'], (res) => {
      if (res.sanarte_area && selectArea) {
        selectArea.value = res.sanarte_area;
      }
    });
  }

  // Guardar área seleccionada
  if (selectArea) {
    selectArea.addEventListener('change', () => {
      const area = selectArea.value;
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ sanarte_area: area });
      }
    });
  }

  // Ejecutar comando en la pestaña activa
  async function triggerTabAction(actionName) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) return;

      // Enviar mensaje al script de contenido inyectado
      chrome.tabs.sendMessage(tab.id, { action: actionName }, (response) => {
        // Fallback con scripting directo si el mensaje no tuvo respuesta
        if (chrome.runtime.lastError || !response) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (action) => {
              const root = document.getElementById('sanarte-extension-root');
              if (root && root.shadowRoot) {
                if (action === 'TRIGGER_BREAK') {
                  const overlay = root.shadowRoot.getElementById('sanarte-screen-overlay');
                  if (overlay) overlay.classList.add('sanarte-active');
                } else if (action === 'OPEN_WIDGET') {
                  const bubble = root.shadowRoot.getElementById('sanarte-bubble');
                  if (bubble) bubble.click();
                }
              }
            },
            args: [actionName]
          }).catch(err => console.log('Execution note:', err));
        }
      });
    } catch (e) {
      console.error('[Sanarte Activa Popup] Error:', e);
    }
  }

  if (triggerOverlayBtn) {
    triggerOverlayBtn.addEventListener('click', () => {
      triggerTabAction('TRIGGER_BREAK');
    });
  }

  if (openWidgetBtn) {
    openWidgetBtn.addEventListener('click', () => {
      triggerTabAction('OPEN_WIDGET');
    });
  }
});
