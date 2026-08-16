/**
 * ==========================================================================
 * SANARTE ACTIVA - Backend Server & Dashboard (Node.js Nativo)
 * Escucha en http://localhost:3000
 * 
 * Servidor HTTP para la Extensión de Navegador y el Dashboard de RRHH
 * Dashboard disponible en: http://localhost:3000/dashboard
 * ==========================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const eventsDB = [];

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Servir el Dashboard de RRHH (http://localhost:3000/dashboard)
  if (req.url === '/dashboard' || req.url === '/dashboard/') {
    const htmlPath = path.join(__dirname, 'dashboard', 'index.html');
    fs.readFile(htmlPath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Error al cargar el Dashboard');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      }
    });
    return;
  }

  if (req.url === '/dashboard/styles.css') {
    const cssPath = path.join(__dirname, 'dashboard', 'styles.css');
    fs.readFile(cssPath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end(content);
      }
    });
    return;
  }

  if (req.url === '/dashboard/app.js') {
    const jsPath = path.join(__dirname, 'dashboard', 'app.js');
    fs.readFile(jsPath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(content);
      }
    });
    return;
  }

  // 2. Endpoint POST /api/events (Confirmaciones Anónimas de la Extensión)
  if (req.url === '/api/events' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        
        const cleanPayload = {
          timestamp: data.timestamp,
          eventType: data.eventType,
          area: data.area || 'Administración / Farmacia',
          hourOfDay: data.hourOfDay !== undefined ? data.hourOfDay : new Date(data.timestamp).getHours(),
          dayOfWeek: data.dayOfWeek || null,
          routine: data.routine || null,
          stressLevel: data.stressLevel || null,
          stressLabel: data.stressLabel || null,
          wsiScore: data.wsiScore || null
        };

        eventsDB.push(cleanPayload);
        
        console.log('\n======================================================');
        console.log('🔒 [SANARTE ACTIVA ANALYTICS] Evento Anónimo Registrado:');
        console.log(`⏰ Hora: ${new Date(cleanPayload.timestamp).toLocaleTimeString()} (Franja: ${cleanPayload.hourOfDay}:00 hs)`);
        console.log(`📍 Área Hospitalaria: ${cleanPayload.area}`);
        console.log(`🎯 Acción: ${cleanPayload.eventType}`);
        if (cleanPayload.stressLevel) console.log(`📊 Encuesta Estrés: Nivel ${cleanPayload.stressLevel} (${cleanPayload.stressLabel})`);
        if (cleanPayload.wsiScore) console.log(`📈 Índice WSI Detectado: ${cleanPayload.wsiScore}%`);
        console.log('======================================================\n');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', message: 'Registro de analítica completado' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: 'Payload inválido' }));
      }
    });
    return;
  }

  // 3. Endpoint GET /api/analytics/heatmaps (Mapa de Calor y Métricas)
  if (req.url === '/api/analytics/heatmaps' && req.method === 'GET') {
    const hourlyDistribution = {};
    const areaDistribution = {};

    eventsDB.forEach(e => {
      const hourKey = `${e.hourOfDay || 0}:00 hs`;
      hourlyDistribution[hourKey] = (hourlyDistribution[hourKey] || 0) + 1;

      const areaKey = e.area || 'Administración / Farmacia';
      areaDistribution[areaKey] = (areaDistribution[areaKey] || 0) + 1;
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      totalEventsAnalyzed: eventsDB.length,
      hourlyPeakDistribution: hourlyDistribution,
      areaDistribution: areaDistribution
    }));
    return;
  }

  // 4. Endpoint GET /api/stats
  if (req.url === '/api/stats' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      totalEvents: eventsDB.length,
      recentEvents: eventsDB.slice(-10)
    }));
    return;
  }

  // Redirección por defecto a /dashboard
  if (req.url === '/') {
    res.writeHead(302, { 'Location': '/dashboard' });
    res.end();
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Sanarte Activa Backend - Endpoint no encontrado');
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 [SANARTE ACTIVA BACKEND] Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`📊 Dashboard de RRHH disponible en: http://localhost:${PORT}/dashboard`);
  console.log(`======================================================\n`);
});
