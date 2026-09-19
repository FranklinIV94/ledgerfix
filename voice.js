/**
 * LedgerFix Voice Layer — ElevenLabs TTS
 * Uses Franklin's cloned voice to narrate findings verbatim.
 * Model: eleven_v3 · Voice ID: b49BEbpA9R0tq5wqd5yV
 */

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

// Expand a numeric dollar amount into plain English words.
// e.g. 18400 → "eighteen thousand four hundred dollars"
function expandDollars(amount) {
  const dollars = Math.round(Math.abs(amount));
  const numWords = n => {
    if (n === 0) return 'zero';
    if (n < 20) {
      const under20 = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
                       'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
                       'seventeen', 'eighteen', 'nineteen'];
      return under20[n];
    }
    if (n < 100) {
      const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
      const rest = n % 10 === 0 ? '' : '-' + numWords(n % 10);
      return tens[Math.floor(n / 10)] + rest;
    }
    if (n < 1000) {
      return numWords(Math.floor(n / 100)) + ' hundred' + (n % 100 === 0 ? '' : ' ' + numWords(n % 100));
    }
    if (n < 1000000) {
      const thousands = Math.floor(n / 1000);
      const remainder = n % 1000;
      return numWords(thousands) + ' thousand' + (remainder === 0 ? '' : ' ' + numWords(remainder));
    }
    return String(n); // fallback for very large numbers
  };

  const words = numWords(dollars);
  const sign = amount < 0 ? 'negative ' : '';
  const verb = amount > 0 ? 'overpayment of ' : amount < 0 ? 'underpayment of ' : '';
  return sign + words + ' dollars' + (verb ? ` — ${verb}` : '');
}

/**
 * Build the voice narration script from the report data.
 * Script arc: intro → lead CRITICAL → recoverable breakdown → total → action count.
 */
function buildNarrationScript(report) {
  const lines = [];
  const exs = report.exceptions;
  const crit = exs.filter(e => e.severity === 'CRITICAL');
  const high = exs.filter(e => e.severity === 'HIGH');
  const medium = exs.filter(e => e.severity === 'MEDIUM');
  const low = exs.filter(e => e.severity === 'LOW');

  lines.push(`LedgerFix reconciliation complete. ${report.claims_scanned} claims scanned. ${report.exceptions_found} exception${report.exceptions_found !== 1 ? 's' : ''} found.`);
  lines.push(`Total billed: ${expandDollars(report.total_billed)}. Total paid: ${expandDollars(report.total_paid)}.`);

  // Lead CRITICAL findings
  if (crit.length > 0) {
    lines.push(`Critical alert. ${crit.length} critical finding${crit.length !== 1 ? 's' : ''} requiring immediate action.`);
    crit.forEach(e => {
      if (e.type === 'DUPLICATE_PAY') {
        // Find the total paid / billed from the exception
        lines.push(`Claimant ${e.claimant}. Duplicate payment detected.`);
        lines.push(`Billed ${expandDollars(e.amount_total_billed || 0)}. Paid ${expandDollars(e.amount_total_paid || 0)}.`);
        lines.push(`Recoverable amount: ${expandDollars(e.amount)}.`);
      } else {
        lines.push(`${e.finding} Recoverable: ${expandDollars(e.amount)}.`);
      }
    });
  }

  // High severity
  if (high.length > 0) {
    lines.push(`${high.length} high priority exception${high.length !== 1 ? 's' : ''}.`);
    high.forEach(e => {
      if (e.type === 'DENIED_NO_REBILL') {
        lines.push(`Claim ${e.claim_id}, claimant ${e.claimant}. Denied claim not rebilled. Billed amount: ${expandDollars(e.amount)}. Recoverable if denial is appealed.`);
      } else {
        lines.push(`${e.finding} Recoverable: ${expandDollars(e.amount)}.`);
      }
    });
  }

  // Medium / Low
  if (medium.length > 0) {
    lines.push(`${medium.length} medium priority variance${medium.length !== 1 ? 's' : ''} detected.`);
    medium.forEach(e => lines.push(`${e.finding} Recoverable: ${expandDollars(e.amount)}.`));
  }
  if (low.length > 0) {
    lines.push(`${low.length} low priority item${low.length !== 1 ? 's' : ''} requiring review.`);
    low.forEach(e => lines.push(`${e.finding} Recoverable: ${expandDollars(e.amount)}.`));
  }

  // Recoverable breakdown
  const dupAmt = report.exception_summary.duplicate_overpayment.recoverable;
  const denAmt = report.exception_summary.denied_not_rebilled.recoverable;
  const varAmt = report.exception_summary.paid_variance.recoverable;

  lines.push(`Recoverable funds summary.`);
  if (dupAmt > 0) lines.push(`Duplicate overpayments: ${expandDollars(dupAmt)}.`);
  if (denAmt > 0) lines.push(`Denied claims not rebilled: ${expandDollars(denAmt)}.`);
  if (varAmt > 0) lines.push(`Payment variances: ${expandDollars(varAmt)}.`);
  lines.push(`Total recoverable: ${expandDollars(report.recoverable_total)}.`);

  // Action count
  const critCount = report.priorities.critical_count;
  lines.push(`${critCount} critical action${critCount !== 1 ? 's' : ''} queued.`);
  lines.push(`LedgerFix. Closing the gap between what was billed and what was paid.`);

  return lines.join(' ');
}

/**
 * Synthesize speech via ElevenLabs API.
 * @param {string} apiKey - ElevenLabs API key
 * @param {string} text - Plain English text to speak
 * @param {object} options - voice settings
 * @returns {Promise<Buffer>} - MP3 audio buffer
 */
async function synthesize(apiKey, text, options = {}) {
  const {
    voiceId = 'b49BEbpA9R0tq5wqd5yV',
    model = 'eleven_v3',
    stability = 0.5,
    similarityBoost = 0.8,
  } = options;

  const response = await fetch(`${ELEVENLABS_API_URL}/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: {
        stability,
        similarity_boost: similarityBoost,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ElevenLabs API error ${response.status}: ${err}`);
  }

  return response.buffer();
}

module.exports = { buildNarrationScript, expandDollars, synthesize };
