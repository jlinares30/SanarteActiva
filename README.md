# Sanarte Pulse - Pausas Activas Inteligentes (INSN-SB)

Extensión de navegador basada en **Manifest V3** diseñada para el personal hospitalario (INSN-SB). Transforma la rutina diaria integrando **Pausas Activas Adaptativas**, monitoreo de uso de pantalla y control visual no invasivo.

---

## ¿Por qué esta solución en navegador es superior?

1. **100% de Compatibilidad Hospitalaria:** No requiere instalación de ejecutables pesados ni permisos de administrador en Windows. Funciona de manera nativa sobre Google Chrome o Microsoft Edge.
2. **Monitoreo de Tiempo en Pantalla:** Detecta automáticamente el uso activo de la computadora y sugiere pausas en momentos estratégicos (evitando fatiga acumulada).
3. **Control de Pantalla (Screen Control Overlay):** Filtro de atenuación suave con difuminado (`backdrop-filter`) que invita a realizar una micro-pausa sin interrumpir la atención de emergencias.
4. **Respeto a la Dinámica Médica:** Permite **Iniciar la Pausa Activa (90s)**, **Posponer 10 min (Snooze)** u **Omitir por Carga Laboral**.

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

## Guía de Instalación y Prueba End-to-End

### Paso 1: Cargar la extensión en el navegador
1. Abre Google Chrome o Microsoft Edge y ve a `chrome://extensions` o `edge://extensions`.
2. Activa el **"Modo de desarrollador"** (Developer mode).
3. Haz clic en **"Cargar descomprimida"** (Load unpacked).
4. Selecciona la carpeta: `d:\Jorge\portfolio\sanarte`.

### Paso 2: Iniciar el servidor Backend de prueba
Abre una terminal y ejecuta:
```bash
node server.js
```
Verás en consola: `[SANARTE PULSE BACKEND] Servidor ejecutándose en http://localhost:3000`.

### Paso 3: Probar la Extensión
1. Haz clic en el ícono de **Sanarte Pulse** en la barra de extensiones.
2. Selecciona tu área (ej. *Emergencias / Asistencial*, *UCI*, *Pediatría*).
3. Presiona **"Probar Control de Pantalla (Overlay)"** o **"Abrir Widget de Pausa Activa"**.
4. ¡Inicia una rutina! Verás los eventos sincronizándose en tiempo real en la consola donde ejecutas `server.js`.
