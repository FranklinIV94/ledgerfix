/**
 * LedgerFix Server
 * Serves static UI + REST API for reconciliation + voice synthesis.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { parseCSV, runReconciliation } = require('./engine');
const { buildReport } = require('./report');
const { buildNarrationScript, synthesize, VoiceError, ELEVENLABS_API_URL, MODEL_ID, VOICE_ID } = require('./voice');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const STATIC_DIR = path.join(__dirname, 'public');
// Pre-generated narration fallback, played when live synthesis is unavailable.
const AUDIO_DIR = path.join(STATIC_DIR, 'audio');

// MIME types
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
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

  // ── GET /api/health ─────────────────────────────────────────────────────────
  // Render's health check hits this path; keep the payload shape stable.
  if (req.method === 'GET' && pathname === '/api/health') {
    sendJSON(res, 200, { status: 'ok', service: 'ledgerfix' });
    return;
  }

  // ── GET /sample-ledger.csv ──────────────────────────────────────────────────
  // The canonical sample ledger lives at the repo root (test-engine.js reads it
  // from there), which is outside STATIC_DIR — so serve it explicitly or the
  // "Load sample ledger" button 404s.
  if (req.method === 'GET' && pathname === '/sample-ledger.csv') {
    sendFile(res, path.join(__dirname, 'sample-ledger.csv'));
    return;
  }

  // ── GET /audio/*.mp3 ────────────────────────────────────────────────────────
  // Pre-recorded narration fallback. Only .mp3 files directly inside public/audio,
  // so a crafted name cannot reach outside the directory.
  if (req.method === 'GET' && pathname.startsWith('/audio/')) {
    const name = path.basename(pathname);
    if (!name.toLowerCase().endsWith('.mp3')) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const fullPath = path.join(AUDIO_DIR, name);
    fs.readFile(fullPath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Content-Length': data.length,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(data);
    });
    return;
  }

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
          sendJSON(res, 400, { success: false, error: 'ElevenLabs API key required', status: 400 });
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
        // `status` is the upstream code when the voice layer supplied one.
        sendJSON(res, err.status || 500, {
          success: false,
          error: err.message,
          status: err.status || 500,
        });
      }
    });
    return;
  }

  // ── POST /api/narrate-stream ────────────────────────────────────────────────
  // Streams the audio back as it's generated (faster UX). Model and voice come
  // from the voice module's locked constants — never a per-request override.
  if (req.method === 'POST' && pathname === '/api/narrate-stream') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { report, apiKey } = JSON.parse(body);
        if (!apiKey) {
          sendJSON(res, 400, { success: false, error: 'ElevenLabs API key required', status: 400 });
          return;
        }
        const script = buildNarrationScript(report);

        let response;
        try {
          response = await fetch(`${ELEVENLABS_API_URL}/${VOICE_ID}`, {
            method: 'POST',
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: script,
              model_id: MODEL_ID,
              voice_settings: { stability: 0.5, similarity_boost: 0.8 },
            }),
          });
        } catch (netErr) {
          sendJSON(res, 502, {
            success: false,
            error: `Could not reach ElevenLabs: ${netErr.message}`,
            status: 502,
          });
          return;
        }

        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          sendJSON(res, response.status, {
            success: false,
            error: `ElevenLabs rejected the request (${response.status}): ${detail.slice(0, 300) || 'no detail'}`,
            status: response.status,
          });
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
        sendJSON(res, err.status || 500, {
          success: false,
          error: err.message,
          status: err.status || 500,
        });
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

http.createServer(handleRequest).listen(PORT, HOST, () => {
  console.log(`LedgerFix listening on ${HOST}:${PORT}`);
});
