/**
 * LedgerFix — Client-side app
 */

(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const apiBase = window.location.origin;

  let currentCSV = null;
  let currentReport = null;
  // Session-only. Deliberately not persisted anywhere — no localStorage, no
  // cookies — so the key dies with the tab.
  let sessionApiKey = '';

  // ── DOM refs ──────────────────────────────────────────────────────
  const dropZone      = $('drop-zone');
  const fileInput     = $('file-input');
  const browseBtn     = $('browse-btn');
  const sampleBtn     = $('sample-btn');
  const apiKeyInput   = $('api-key-input');
  const keyToggle     = $('key-toggle');
  const filePreview   = $('file-preview');
  const fileName      = $('file-name');
  const clearBtn      = $('clear-btn');
  const runRow        = $('run-row');
  const runBtn        = $('run-btn');
  const errorBanner   = $('error-banner');
  const loading       = $('loading');
  const results       = $('results');
  const exceptionsList= $('exceptions-list');
  const criticalBanner= $('critical-banner');
  const criticalText  = $('critical-text');
  const playBtn       = $('play-btn');
  const voiceStatus   = $('voice-status');
  const audioPlayer   = $('audio-player');

  // ── Error banner ─────────────────────────────────────────────────
  function showError(message) {
    errorBanner.textContent = message;
    errorBanner.classList.remove('hidden');
  }

  function hideError() {
    errorBanner.textContent = '';
    errorBanner.classList.add('hidden');
  }

  // ── Formatting ───────────────────────────────────────────────────
  // Money carries an explicit sign. The raw value decides it, so an
  // underpayment reads as -$280.00 rather than a bare $280.00.
  function formatSigned(amount) {
    const digits = Math.abs(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (amount > 0) return { text: '+$' + digits, cls: 'recoverable' };
    if (amount < 0) return { text: '-$' + digits, cls: 'underpay' };
    return { text: '$' + digits, cls: 'zero' };
  }

  // ── File handling ────────────────────────────────────────────────
  function acceptCSV(csvText, displayName) {
    currentCSV = csvText;
    currentReport = null;
    fileName.textContent = displayName;
    filePreview.classList.remove('hidden');
    runRow.classList.remove('hidden');
    results.classList.add('hidden');
    hideError();
  }

  function handleFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showError(`${file.name} is not a .csv file. Upload a CSV export of the ledger.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = e => acceptCSV(e.target.result, file.name);
    reader.onerror = () => showError(`Could not read ${file.name}. Try re-saving it as CSV.`);
    reader.readAsText(file);
  }

  dropZone.addEventListener('click', e => {
    if (e.target === browseBtn || e.target === sampleBtn) return;
    fileInput.click();
  });

  browseBtn.addEventListener('click', e => {
    e.stopPropagation();
    fileInput.click();
  });

  fileInput.addEventListener('change', e => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFile(e.dataTransfer.files[0]);
  });

  clearBtn.addEventListener('click', () => {
    currentCSV = null;
    currentReport = null;
    fileInput.value = '';
    filePreview.classList.add('hidden');
    runRow.classList.add('hidden');
    results.classList.add('hidden');
    hideError();
  });

  // ── Reconciliation ───────────────────────────────────────────────
  runBtn.addEventListener('click', runReconciliation);

  async function runReconciliation() {
    if (!currentCSV) return;

    runBtn.disabled = true;
    hideError();
    loading.classList.remove('hidden');
    results.classList.add('hidden');

    try {
      const res = await fetch(`${apiBase}/api/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: currentCSV }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server returned ${res.status} with an unreadable body.`);
      }

      if (!data.success) throw new Error(data.error || 'Reconciliation failed.');

      // A malformed or empty file parses to zero claims — say so rather than
      // rendering an empty ledger that looks like a clean one.
      if (!data.report || data.report.claims_scanned === 0) {
        showError('No claims found in that file — check it has a header row and at least one claim.');
        return;
      }

      currentReport = data.report;
      renderResults(data.report);
    } catch (err) {
      showError(`Reconciliation failed: ${err.message}`);
    } finally {
      loading.classList.add('hidden');
      runBtn.disabled = false;
    }
  }

  // ── Render results ───────────────────────────────────────────────
  function buildCard(ex) {
    const card = document.createElement('div');
    card.className = 'exception-card';

    const { text, cls } = formatSigned(ex.amount);

    card.innerHTML = `
      <div class="exception-meta">
        <div class="severity-badge severity-${ex.severity}">${ex.severity}</div>
        <div class="type-tag">${ex.type}</div>
      </div>
      <div class="exception-body">
        <div class="exception-claim">${ex.claim_id}</div>
        <div class="exception-finding">${ex.finding}</div>
        <div class="exception-action">${ex.next_action}</div>
      </div>
      <div class="exception-amount ${cls}">${text}</div>
    `;
    return card;
  }

  function renderCards(list, target) {
    list.forEach(ex => target.appendChild(buildCard(ex)));
  }

  function renderResults(report) {
    // Stats
    $('stat-scanned').textContent = report.claims_scanned;
    $('stat-exceptions').textContent = report.exceptions_found;
    $('stat-recoverable').textContent = '$' + report.recoverable_total.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // Critical banner
    const crit = report.exceptions.filter(e => e.severity === 'CRITICAL');
    if (crit.length > 0) {
      criticalBanner.classList.remove('hidden');
      criticalText.textContent = crit[0].finding;
    } else {
      criticalBanner.classList.add('hidden');
    }

    // Cards — CRITICAL and HIGH lead; MEDIUM and LOW sit behind a toggle so the
    // critical finding stays the first thing on screen.
    exceptionsList.innerHTML = '';

    const leading = report.exceptions.filter(e => e.severity === 'CRITICAL' || e.severity === 'HIGH');
    const lower = report.exceptions.filter(e => e.severity === 'MEDIUM' || e.severity === 'LOW');

    leading.forEach(ex => exceptionsList.appendChild(buildCard(ex)));

    if (lower.length > 0) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'lower-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = `Lower severity (${lower.length})`;

      const lowerList = document.createElement('div');
      lowerList.className = 'lower-list hidden';

      renderCards(lower, lowerList);

      toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!expanded));
        lowerList.classList.toggle('hidden', expanded);
        toggle.textContent = expanded
          ? `Lower severity (${lower.length})`
          : `Lower severity (${lower.length}) — hide`;
      });

      exceptionsList.appendChild(toggle);
      exceptionsList.appendChild(lowerList);
    }

    results.classList.remove('hidden');
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── API key (session only, show/hide) ────────────────────────────
  apiKeyInput.addEventListener('input', () => {
    sessionApiKey = apiKeyInput.value.trim();
  });

  keyToggle.addEventListener('click', () => {
    const revealed = apiKeyInput.type === 'text';
    apiKeyInput.type = revealed ? 'password' : 'text';
    keyToggle.textContent = revealed ? 'Show' : 'Hide';
    keyToggle.setAttribute('aria-pressed', String(!revealed));
    keyToggle.setAttribute('aria-label', revealed ? 'Show API key' : 'Hide API key');
    apiKeyInput.focus();
  });

  // ── Voice narration ──────────────────────────────────────────────
  playBtn.addEventListener('click', playNarration);

  async function playNarration() {
    if (!currentReport) return;

    const apiKey = sessionApiKey || apiKeyInput.value.trim();
    if (!apiKey) {
      showError('Enter your ElevenLabs API key above to enable voice narration.');
      return;
    }

    hideError();
    playBtn.disabled = true;
    voiceStatus.textContent = 'Generating voice…';
    voiceStatus.className = 'voice-status';

    try {
      const res = await fetch(`${apiBase}/api/narrate-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: currentReport, apiKey }),
      });

      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const err = await res.json();
          if (err && err.error) message = err.error;
        } catch { /* non-JSON error body — keep the status message */ }
        throw new Error(message);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      audioPlayer.src = url;
      audioPlayer.onended = () => {
        voiceStatus.textContent = 'Playback complete.';
        voiceStatus.className = 'voice-status';
        playBtn.disabled = false;
      };
      audioPlayer.onerror = () => {
        voiceStatus.textContent = 'Playback error.';
        voiceStatus.className = 'voice-status';
        playBtn.disabled = false;
      };

      voiceStatus.textContent = 'Playing…';
      voiceStatus.className = 'voice-status playing';
      await audioPlayer.play();
    } catch (err) {
      voiceStatus.textContent = 'Error: ' + err.message;
      voiceStatus.className = 'voice-status';
      showError(`Voice narration failed: ${err.message}`);
      playBtn.disabled = false;
    }
  }

  // ── Bundled sample ledger ─────────────────────────────────────────
  sampleBtn.addEventListener('click', async e => {
    e.stopPropagation();
    try {
      const res = await fetch('./sample-ledger.csv');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      acceptCSV(await res.text(), 'sample-ledger.csv');
    } catch (err) {
      showError(`Could not load the sample ledger: ${err.message}`);
    }
  });
})();
