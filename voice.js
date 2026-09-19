/**
 * LedgerFix Voice Layer — ElevenLabs TTS
 * Uses Franklin's cloned voice to narrate findings verbatim.
 * Model: eleven_v3 · Voice ID: b49BEbpA9R0tq5wqd5yV
 */

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

// Locked. eleven_v3 is the flagship natural-English model and b49BEbpA9R0tq5wqd5yV is
// Franklin's cloned voice. Both are constants, deliberately NOT parameters: a caller
// that passed a different model used to be able to downgrade narration silently, and
// eleven_multilingual_v2 sounds robotic enough to sink the demo. A failure surfaces
// as an error instead of quietly switching voices.
const MODEL_ID = 'eleven_v3';
const VOICE_ID = 'b49BEbpA9R0tq5wqd5yV';
const DEFAULT_STABILITY = 0.5;
const DEFAULT_SIMILARITY_BOOST = 0.8;

/**
 * Error carrying the upstream HTTP status, so callers can answer with
 * { error, status } rather than a generic 500.
 */
class VoiceError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'VoiceError';
    this.status = status || 502;
  }
}

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
  // A bare amount phrase — callers add their own lead-in words, so there is no
  // trailing fragment left dangling when this lands at the end of a sentence.
  return sign + words + ' dollars';
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
        lines.push(`Claimant ${e.claimant}. Duplicate payment detected on claim ${e.claim_id}.`);
        lines.push(
          `Billed ${expandDollars(e.amount_billed ?? e.amount)}. ` +
          `Paid ${expandDollars(e.amount_total_paid ?? e.amount_total_billed ?? e.amount)} in total.`
        );
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
      } else if (e.type === 'DUPLICATE_PAY' && e.primary === false) {
        lines.push(`Claim ${e.claim_id}, claimant ${e.claimant}, is a duplicate line. No further recovery beyond the amount already counted.`);
      } else {
        lines.push(`${e.finding} Recoverable: ${expandDollars(e.amount)}.`);
      }
    });
  }

  // Medium / Low — narrated from the raw figures, never from `finding`, so no
  // "$" or formatted text reaches the TTS engine.
  const narrateVariance = e => {
    const direction = e.amount > 0 ? 'overpaid' : 'underpaid';
    const billed = e.amount_billed !== undefined ? e.amount_billed : e.amount;
    const paid = e.amount_paid !== undefined ? e.amount_paid : e.amount;
    lines.push(
      `Claim ${e.claim_id}, claimant ${e.claimant}. Billed ${expandDollars(billed)}, paid ${expandDollars(paid)}. ` +
      `${e.claimant} was ${direction} by ${expandDollars(Math.abs(e.amount))}.`
    );
  };

  if (medium.length > 0) {
    lines.push(`${medium.length} medium priority variance${medium.length !== 1 ? 's' : ''} detected.`);
    medium.forEach(narrateVariance);
  }
  if (low.length > 0) {
    lines.push(`${low.length} low priority item${low.length !== 1 ? 's' : ''} requiring review.`);
    low.forEach(narrateVariance);
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
 *
 * Model and voice are fixed (see MODEL_ID / VOICE_ID). There is no fallback: if the
 * request fails, a VoiceError is thrown with the upstream status so the caller can
 * answer with { error, status }.
 *
 * @param {string} apiKey - ElevenLabs API key
 * @param {string} text - Plain English text to speak
 * @param {object} options - delivery overrides (stability, similarityBoost)
 * @returns {Promise<Buffer>} - MP3 audio buffer
 * @throws {VoiceError}
 */
async function synthesize(apiKey, text, options = {}) {
  const {
    stability = DEFAULT_STABILITY,
    similarityBoost = DEFAULT_SIMILARITY_BOOST,
  } = options;

  if (!apiKey) throw new VoiceError('ElevenLabs API key required', 400);

  let response;
  try {
    response = await fetch(`${ELEVENLABS_API_URL}/${VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
        },
      }),
    });
  } catch (err) {
    // Network-level failure reaching ElevenLabs.
    throw new VoiceError(`Could not reach ElevenLabs: ${err.message}`, 502);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    // Pass the upstream status through rather than flattening to 500, so a bad key
    // reads as 401 and a rate limit as 429.
    throw new VoiceError(
      `ElevenLabs rejected the request (${response.status}): ${detail.slice(0, 300) || 'no detail'}`,
      response.status
    );
  }

  try {
    return Buffer.from(await response.arrayBuffer());
  } catch (err) {
    throw new VoiceError(`Could not read the audio response: ${err.message}`, 502);
  }
}

module.exports = {
  buildNarrationScript,
  expandDollars,
  synthesize,
  VoiceError,
  ELEVENLABS_API_URL,
  MODEL_ID,
  VOICE_ID,
};
