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

  // Guardar área seleccionada al cambiar
  if (selectArea) {
    selectArea.addEventListener('change', () => {
      const area = selectArea.value;
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ sanarte_area: area });
      }
    });
  }

  // Probar Control de Pantalla Overlay
  if (triggerOverlayBtn) {
    triggerOverlayBtn.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_BREAK' }).catch(() => {
          // Fallback con scripting si no responde el listener
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const root = document.getElementById('sanarte-extension-root');
              if (root && root.shadowRoot) {
                const overlay = root.shadowRoot.getElementById('sanarte-screen-overlay');
                if (overlay) overlay.classList.add('sanarte-active');
              }
            }
          });
        });
      }
    });
  }

  // Abrir Widget de Pausa Activa
  if (openWidgetBtn) {
    openWidgetBtn.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'OPEN_WIDGET' }).catch(() => {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const root = document.getElementById('sanarte-extension-root');
              if (root && root.shadowRoot) {
                const bubble = root.shadowRoot.getElementById('sanarte-bubble');
                if (bubble) bubble.click();
              }
            }
          });
        });
      }
    });
  }
});
