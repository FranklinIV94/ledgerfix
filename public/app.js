/**
 * LedgerFix — Client-side app
 */

(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const apiBase = window.location.origin;

  let currentCSV = null;
  let currentReport = null;

  // ── DOM refs ──────────────────────────────────────────────────────
  const dropZone      = $('drop-zone');
  const fileInput     = $('file-input');
  const browseBtn     = $('browse-btn');
  const apiKeyInput   = $('api-key-input');
  const filePreview   = $('file-preview');
  const fileName      = $('file-name');
  const clearBtn      = $('clear-btn');
  const runRow        = $('run-row');
  const runBtn        = $('run-btn');
  const loading       = $('loading');
  const results       = $('results');
  const exceptionsList= $('exceptions-list');
  const criticalBanner= $('critical-banner');
  const criticalText  = $('critical-text');
  const playBtn       = $('play-btn');
  const voiceStatus   = $('voice-status');
  const audioPlayer   = $('audio-player');

  // ── File handling ────────────────────────────────────────────────
  function handleFile(file) {
    if (!file || !file.name.endsWith('.csv')) {
      alert('Please upload a .csv file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      currentCSV = e.target.result;
      fileName.textContent = file.name;
      filePreview.classList.remove('hidden');
      runRow.classList.remove('hidden');
      results.classList.add('hidden');
      currentReport = null;
    };
    reader.readAsText(file);
  }

  dropZone.addEventListener('click', e => {
    if (e.target === browseBtn) return;
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
    const file = e.dataTransfer.files[0];
    handleFile(file);
  });

  clearBtn.addEventListener('click', () => {
    currentCSV = null;
    currentReport = null;
    fileInput.value = '';
    filePreview.classList.add('hidden');
    runRow.classList.add('hidden');
    results.classList.add('hidden');
  });

  // ── Reconciliation ───────────────────────────────────────────────
  runBtn.addEventListener('click', runReconciliation);

  async function runReconciliation() {
    if (!currentCSV) return;

    runBtn.disabled = true;
    loading.classList.remove('hidden');
    results.classList.add('hidden');

    try {
      const res = await fetch(`${apiBase}/api/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: currentCSV }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      currentReport = data.report;
      renderResults(data.report);
    } catch (err) {
      alert(`Reconciliation failed: ${err.message}`);
    } finally {
      loading.classList.add('hidden');
      runBtn.disabled = false;
    }
  }

  // ── Render results ───────────────────────────────────────────────
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

    // Exception cards
    exceptionsList.innerHTML = '';
    report.exceptions.forEach(ex => {
      const card = document.createElement('div');
      card.className = 'exception-card';

      const amountClass = ex.amount > 0 ? 'recoverable' : 'underpay';
      const amountPrefix = ex.amount > 0 ? '+' : '';
      const amountFormatted = amountPrefix + '$' + Math.abs(ex.amount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

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
        <div class="exception-amount ${amountClass}">${amountFormatted}</div>
      `;
      exceptionsList.appendChild(card);
    });

    results.classList.remove('hidden');
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Voice narration ──────────────────────────────────────────────
  playBtn.addEventListener('click', playNarration);

  async function playNarration() {
    if (!currentReport) return;

    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      alert('Enter your ElevenLabs API key above to enable voice narration.');
      return;
    }

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
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
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
      playBtn.disabled = false;
    }
  }

  // ── Load sample ledger button ─────────────────────────────────────
  // (bonus: auto-load the bundled sample ledger)
  fetch('./sample-ledger.csv')
    .then(r => r.ok ? r.text() : null)
    .then(csv => {
      if (csv) {
        // Optionally auto-fill the sample CSV
        // Uncomment next line to auto-load sample on page open:
        // currentCSV = csv; fileName.textContent = 'sample-ledger.csv'; filePreview.classList.remove('hidden'); runRow.classList.remove('hidden');
      }
    })
    .catch(() => {});
})();
