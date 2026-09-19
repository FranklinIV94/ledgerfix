/**
 * LedgerFix Reconciliation Engine
 * Rules: DUPLICATE_PAY, PAID_VARIANCE, DENIED_NO_REBILL
 * Severity: CRITICAL > HIGH > MEDIUM > LOW
 */

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/**
 * Parse a CSV string into an array of objects.
 */
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || '';
    });
    row.amount_billed = parseFloat(row.amount_billed) || 0;
    row.amount_paid = parseFloat(row.amount_paid) || 0;
    return row;
  });
}

/**
 * Run all reconciliation rules against the parsed ledger.
 * Returns array of exception objects.
 */
function runReconciliation(claims) {
  const exceptions = [];
  const flaggedClaimIds = new Set();

  // ── RULE 1: DUPLICATE_PAY ─────────────────────────────────────────────────
  // Same claimant + date_of_service + policy_id, summed PAID lines > 1 row
  const groups = {};
  claims.forEach(c => {
    if (c.status !== 'PAID') return;
    const key = `${c.claimant}|${c.date_of_service}|${c.policy_id}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  });

  Object.values(groups).forEach(group => {
    if (group.length < 2) return;

    const totalPaid = group.reduce((sum, c) => sum + c.amount_paid, 0);
    const totalBilled = group.reduce((sum, c) => sum + c.amount_billed, 0);
    const recoverable = totalPaid - totalBilled;

    if (recoverable > 0) {
      // The parent claim is the one with the higher billed amount (WC-1051)
      const [parent, ...children] = group.sort((a, b) => b.amount_billed - a.amount_billed);

      const exc = {
        severity: 'CRITICAL',
        type: 'DUPLICATE_PAY',
        claim_id: `${parent.claim_id} + ${children.map(c => c.claim_id).join(', ')}`,
        claimant: parent.claimant,
        date_of_service: parent.date_of_service,
        policy_id: parent.policy_id,
        amount: recoverable,
        amount_total_paid: totalPaid,
        amount_total_billed: totalBilled,
        finding: `Duplicate payment detected: claimant ${parent.claimant} billed $${totalBilled.toLocaleString('en-US', {minimumFractionDigits: 2})} across ${group.length} lines, but paid $${totalPaid.toLocaleString('en-US', {minimumFractionDigits: 2})} — overpayment of $${recoverable.toLocaleString('en-US', {minimumFractionDigits: 2})}.`,
        next_action: 'Void duplicate line and reissue corrected payment for the accurate billed amount.',
        lines: group.map(c => c.claim_id),
      };

      exceptions.push(exc);
      group.forEach(c => flaggedClaimIds.add(c.claim_id));
    }
  });

  // ── RULE 2: PAID_VARIANCE ─────────────────────────────────────────────────
  // paid ≠ billed, rank by |variance|. Skip already-flagged or denied.
  claims.forEach(c => {
    if (flaggedClaimIds.has(c.claim_id)) return;
    if (c.status !== 'PAID') return;

    const variance = c.amount_paid - c.amount_billed;
    if (variance === 0) return;

    const absVar = Math.abs(variance);
    let severity = absVar >= 500 ? 'HIGH' : absVar >= 100 ? 'MEDIUM' : 'LOW';

    const exc = {
      severity,
      type: 'PAID_VARIANCE',
      claim_id: c.claim_id,
      claimant: c.claimant,
      date_of_service: c.date_of_service,
      policy_id: c.policy_id,
      amount: variance,
      finding: variance > 0
        ? `Overpayment: claimant ${c.claimant} billed $${c.amount_billed.toLocaleString('en-US', {minimumFractionDigits: 2})} but paid $${c.amount_paid.toLocaleString('en-US', {minimumFractionDigits: 2})} — overpaid by $${absVar.toLocaleString('en-US', {minimumFractionDigits: 2})}.`
        : `Underpayment: claimant ${c.claimant} billed $${c.amount_billed.toLocaleString('en-US', {minimumFractionDigits: 2})} but paid $${c.amount_paid.toLocaleString('en-US', {minimumFractionDigits: 2})} — underpaid by $${absVar.toLocaleString('en-US', {minimumFractionDigits: 2})}.`,
      next_action: variance > 0
        ? 'Initiate recovery demand for the overpayment amount.'
        : 'Issue corrected payment for the outstanding balance.',
      lines: [c.claim_id],
    };

    exceptions.push(exc);
  });

  // ── RULE 3: DENIED_NO_REBILL ──────────────────────────────────────────────
  // status DENIED & paid = 0 → recovery opportunity
  claims.forEach(c => {
    if (flaggedClaimIds.has(c.claim_id)) return;
    if (c.status !== 'DENIED') return;
    if (c.amount_paid !== 0) return;

    const exc = {
      severity: 'HIGH',
      type: 'DENIED_NO_REBILL',
      claim_id: c.claim_id,
      claimant: c.claimant,
      date_of_service: c.date_of_service,
      policy_id: c.policy_id,
      amount: c.amount_billed,
      finding: `Denied claim not re-billed: claimant ${c.claimant}, billed $${c.amount_billed.toLocaleString('en-US', {minimumFractionDigits: 2})}, status DENIED, $0 paid. This claim is a recovery opportunity if the denial can be appealed or rebilled.`,
      next_action: 'Review denial reason, prepare appeal or rebilling documentation.',
      lines: [c.claim_id],
    };

    exceptions.push(exc);
  });

  // ── RANKING ───────────────────────────────────────────────────────────────
  exceptions.sort((a, b) => {
    if (SEVERITY_ORDER[a.severity] !== SEVERITY_ORDER[b.severity]) {
      return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    }
    return b.amount - a.amount; // amount desc (absolute not needed since duplicates are CRITICAL)
  });

  return exceptions;
}

module.exports = { parseCSV, runReconciliation };
