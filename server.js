/**
 * LedgerFix Server
 * Serves static UI + REST API for reconciliation + voice synthesis.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { parseCSV, runReconciliation } = require('./engine');
const { buildReport } = require('./report');
const { buildNarrationScript, synthesize } = require('./voice');

const PORT = 3000;
const STATIC_DIR = path.join(__dirname, 'public');

// MIME types
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

async function handleRequest(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // ── POST /api/reconcile ─────────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/reconcile') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { csvText, sourceLedger = 'upload' } = JSON.parse(body);
        const claims = parseCSV(csvText);
        const exceptions = runReconciliation(claims);
        const report = buildReport({ claims, exceptions, sourceLedger });
        sendJSON(res, 200, { success: true, report });
      } catch (err) {
        sendJSON(res, 400, { success: false, error: err.message });
      }
    });
    return;
  }

  // ── POST /api/narrate ──────────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/narrate') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { report, apiKey } = JSON.parse(body);
        if (!apiKey) {
          sendJSON(res, 400, { success: false, error: 'ElevenLabs API key required' });
          return;
        }
        const script = buildNarrationScript(report);
        const audioBuffer = await synthesize(apiKey, script);
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.length,
          'Access-Control-Allow-Origin': '*',
        });
        res.end(audioBuffer);
      } catch (err) {
        sendJSON(res, 500, { success: false, error: err.message });
      }
    });
    return;
  }

  // ── POST /api/narrate-stream ────────────────────────────────────────────────
  // Streams the audio back as it's generated (faster UX)
  if (req.method === 'POST' && pathname === '/api/narrate-stream') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { report, apiKey } = JSON.parse(body);
        if (!apiKey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'API key required' }));
          return;
        }
        const script = buildNarrationScript(report);

        const response = await fetch(`${require('./voice').ELEVENLABS_API_URL}/b49BEbpA9R0tq5wqd5yV`, {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: script,
            model_id: 'eleven_v3',
            voice_settings: { stability: 0.5, similarity_boost: 0.8 },
          }),
        });

        if (!response.ok) {
          const err = await response.text();
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: `ElevenLabs: ${err}` }));
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Access-Control-Allow-Origin': '*',
        });

        for await (const chunk of response.body) {
          res.write(chunk);
        }
        res.end();
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ── Static files ───────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    let filePath = pathname === '/' ? '/index.html' : pathname;
    const fullPath = path.join(STATIC_DIR, filePath);
    // Security: only serve files under STATIC_DIR. Compare with a path
    // separator so a sibling directory that shares the prefix
    // (e.g. "public-backup") cannot satisfy the check.
    const rel = path.relative(STATIC_DIR, fullPath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    sendFile(res, fullPath);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

http.createServer(handleRequest).listen(PORT, () => {
  console.log(`LedgerFix running at http://localhost:${PORT}`);
});
