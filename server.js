/**
 * ==========================================================================
 * SANARTE FLOW - Backend Server con Mapa de Calor de Horas Pico (Node.js Nativo)
 * Escucha en http://localhost:3000
 * 
 * Genera analítica anónima de Horas Pico y Días de Mayor Estrés Operativo por Área.
 * ==========================================================================
 */

const http = require('http');

const PORT = 3000;
const eventsDB = [];

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Endpoint POST /api/events
  if (req.url === '/api/events' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        
        const cleanPayload = {
          timestamp: data.timestamp,
          eventType: data.eventType,
          area: data.area || 'Administración',
          hourOfDay: data.hourOfDay !== undefined ? data.hourOfDay : new Date(data.timestamp).getHours(),
          dayOfWeek: data.dayOfWeek || null,
          routine: data.routine || null,
          wsiScore: data.wsiScore || null
        };

        eventsDB.push(cleanPayload);
        
        console.log('\n======================================================');
        console.log('🔒 [SANARTE FLOW ANALYTICS] Evento Anónimo Registrado:');
        console.log(`⏰ Hora: ${new Date(cleanPayload.timestamp).toLocaleTimeString()} (Franja: ${cleanPayload.hourOfDay}:00 hs)`);
        console.log(`📍 Área Hospitalaria: ${cleanPayload.area}`);
        console.log(`🎯 Acción: ${cleanPayload.eventType}`);
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

  // 2. Endpoint GET /api/analytics/heatmaps (Mapa de Calor de Horas y Días Pico)
  if (req.url === '/api/analytics/heatmaps' && req.method === 'GET') {
    const hourlyDistribution = {};
    const areaDistribution = {};

    eventsDB.forEach(e => {
      // Agrupar por hora del día
      const hourKey = `${e.hourOfDay || 0}:00 hs`;
      hourlyDistribution[hourKey] = (hourlyDistribution[hourKey] || 0) + 1;

      // Agrupar por área hospitalaria
      const areaKey = e.area || 'Administración';
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

  // 3. Endpoint GET /api/stats
  if (req.url === '/api/stats' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      totalEvents: eventsDB.length,
      recentEvents: eventsDB.slice(-10)
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Sanarte Flow Backend - Endpoint no encontrado');
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 [SANARTE FLOW BACKEND] Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`📊 Analytics Endpoint disponible en http://localhost:${PORT}/api/analytics/heatmaps`);
  console.log(`======================================================\n`);
});
