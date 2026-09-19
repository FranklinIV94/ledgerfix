/**
 * LedgerFix Report Generator
 * Produces the auditable JSON artifact per spec.
 */

function buildReport({ claims, exceptions, sourceLedger }) {
  const totalBilled = claims.reduce((s, c) => s + c.amount_billed, 0);
  const totalPaid = claims.reduce((s, c) => s + c.amount_paid, 0);

  // Count by type
  const duplicateExceptions = exceptions.filter(e => e.type === 'DUPLICATE_PAY');
  const deniedExceptions = exceptions.filter(e => e.type === 'DENIED_NO_REBILL');
  const varianceExceptions = exceptions.filter(e => e.type === 'PAID_VARIANCE');

  // Recoverable: the duplicate's primary line, every denied claim, and the full
  // size of each variance gap in either direction. Duplicate sibling lines are
  // excluded — they restate the primary's exposure rather than adding to it.
  const recoverableDuplicate = duplicateExceptions
    .filter(e => e.primary === true)
    .reduce((s, e) => s + e.amount, 0);
  const recoverableDenied = deniedExceptions.reduce((s, e) => s + e.amount, 0);
  const recoverableVariance = varianceExceptions.reduce((s, e) => s + Math.abs(e.amount), 0);
  const recoverableTotal = recoverableDuplicate + recoverableDenied + recoverableVariance;

  const criticalExceptions = exceptions.filter(e => e.severity === 'CRITICAL');

  // Headline
  const headline = exceptions.length > 0
    ? `${exceptions.length} exception${exceptions.length !== 1 ? 's' : ''} found across ${claims.length} claims — $${recoverableTotal.toLocaleString('en-US', {minimumFractionDigits: 2})} recoverable.`
    : `No exceptions found across ${claims.length} claims. Ledger is clean.`;

  // Build next action queue (unique, ordered by severity)
  const nextActions = [];
  const seenActions = new Set();
  exceptions.forEach(e => {
    const key = e.next_action;
    if (!seenActions.has(key)) {
      seenActions.add(key);
      nextActions.push({
        claim_id: e.claim_id,
        action: e.next_action,
        severity: e.severity,
        type: e.type,
      });
    }
  });

  return {
    generated_at: new Date().toISOString(),
    source_ledger: sourceLedger || 'unknown',
    claims_scanned: claims.length,
    total_billed: parseFloat(totalBilled.toFixed(2)),
    total_paid: parseFloat(totalPaid.toFixed(2)),
    exceptions_found: exceptions.length,
    recoverable_total: parseFloat(recoverableTotal.toFixed(2)),
    exception_summary: {
      duplicate_overpayment: {
        count: duplicateExceptions.length,
        recoverable: parseFloat(recoverableDuplicate.toFixed(2)),
      },
      denied_not_rebilled: {
        count: deniedExceptions.length,
        recoverable: parseFloat(recoverableDenied.toFixed(2)),
      },
      paid_variance: {
        count: varianceExceptions.length,
        recoverable: parseFloat(recoverableVariance.toFixed(2)),
      },
    },
    priorities: {
      critical_count: criticalExceptions.length,
      critical_recoverable: parseFloat(
        (recoverableDuplicate + (criticalExceptions.filter(e => e.type === 'DENIED_NO_REBILL').reduce((s, e) => s + e.amount, 0)))
          .toFixed(2)
      ),
    },
    headline,
    exceptions: exceptions.map(e => {
      const out = {
        severity: e.severity,
        type: e.type,
        primary: e.primary,
        claim_id: e.claim_id,
        claimant: e.claimant,
        finding: e.finding,
        amount: parseFloat(e.amount.toFixed(2)),
        next_action: e.next_action,
      };
      // Carry the underlying figures so the voice layer can narrate from
      // numbers rather than parsing formatted text out of `finding`.
      ['amount_billed', 'amount_paid', 'amount_total_billed', 'amount_total_paid'].forEach(k => {
        if (e[k] !== undefined) out[k] = parseFloat(Number(e[k]).toFixed(2));
      });
      return out;
    }),
    next_action_queue: nextActions,
  };
}

module.exports = { buildReport };
