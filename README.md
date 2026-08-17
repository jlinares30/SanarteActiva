# Sanarte Activa - Pausas Activas Inteligentes (INSN-SB)

Extensión de navegador basada en **Manifest V3** diseñada para el personal hospitalario (INSN-SB). Transforma la rutina diaria integrando **Pausas Activas Adaptativas**, monitoreo de uso de pantalla y control visual no invasivo.

---

## ¿Por qué esta solución en navegador es superior?

1. **100% de Compatibilidad Hospitalaria:** No requiere instalación de ejecutables pesados ni permisos de administrador en Windows. Funciona de manera nativa sobre Google Chrome o Microsoft Edge.
2. **Monitoreo de Tiempo en Pantalla:** Detecta automáticamente el uso activo de la computadora y sugiere pausas en momentos estratégicos (evitando fatiga acumulada).
3. **Control de Pantalla (Screen Control Overlay):** Filtro de atenuación suave con difuminado (`backdrop-filter`) que invita a realizar una micro-pausa sin interrumpir la atención de emergencias.

---

## Estructura del Proyecto

```text
sanarte/
├── manifest.json       # Manifest V3 (Storage, Scripting, Alarms)
├── content.js          # Shadow DOM, rastreador de uso en pantalla, Overlay y cola offline
├── styles.css          # Diseño Salud/Bienestar, Screen Control Overlay y animación 4-7-8
├── popup.html          # Configuración del área hospitalaria y pruebas rápidas
├── popup.js            # Comunicación entre popup, storage local y content script
├── server.js           # Backend de prueba en Node.js nativo (http://localhost:3000)
└── icons/              # Íconos de la extensión (16px, 48px, 128px)
```

---

## Guía Rápida de Instalación y Uso

1. **Cargar la Extensión:**
   - Abre `chrome://extensions` o `edge://extensions` y activa el **Modo de desarrollador**.
   - Selecciona **Cargar descomprimida** y elige la carpeta de este repositorio.

2. **Iniciar el Backend de Prueba:**
   ```bash
   node server.js
   ```

3. **Probar el Widget:**
   - Abre cualquier página web y haz clic en el ícono de **Sanarte Activa** en tu navegador.
   - Interactúa con la burbuja flotante o el menú desplegable para iniciar una rutina de pausa activa.

---

## Video Demostrativo


https://github.com/user-attachments/assets/b8073a34-2538-4c2a-9919-61d71eeb91c4




## Créditos y Licencia

Desarrollado por el **Equipo Arcano** para la **Hackatón del Instituto Nacional de Salud del Niño San Borja (INSN-SB)**.

