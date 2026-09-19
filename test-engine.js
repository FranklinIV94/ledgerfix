const { parseCSV, runReconciliation } = require('./engine');
const { buildReport } = require('./report');
const fs = require('fs');

const csv = fs.readFileSync('./sample-ledger.csv', 'utf8');
const claims = parseCSV(csv);
const exs = runReconciliation(claims);
const r = buildReport({ claims, exceptions: exs, sourceLedger: 'sample-ledger.csv' });

console.log('\n=== EXCEPTIONS ===');
exs.forEach(e => console.log(`[${e.severity}] ${e.type} | ${e.claim_id} | $${e.amount}`));

console.log('\n=== REPORT SUMMARY ===');
console.log('claims_scanned:', r.claims_scanned);
console.log('exceptions_found:', r.exceptions_found);
console.log('recoverable_total:', r.recoverable_total);
console.log('exception_summary:', JSON.stringify(r.exception_summary, null, 2));
console.log('priorities.critical_count:', r.priorities.critical_count);
console.log('headline:', r.headline);

// Verify against spec expectations
const expected = {
  exceptions: 6,
  recoverable: 26030,
  criticalCount: 1,
  firstCriticalType: 'DUPLICATE_PAY',
};

let pass = true;
if (r.exceptions_found !== expected.exceptions) {
  console.error(`FAIL: expected ${expected.exceptions} exceptions, got ${r.exceptions_found}`);
  pass = false;
}
if (r.recoverable_total !== expected.recoverable) {
  console.error(`FAIL: expected recoverable $${expected.recoverable}, got $${r.recoverable_total}`);
  pass = false;
}
if (r.priorities.critical_count !== expected.criticalCount) {
  console.error(`FAIL: expected ${expected.criticalCount} critical, got ${r.priorities.critical_count}`);
  pass = false;
}
if (r.exceptions[0]?.type !== expected.firstCriticalType) {
  console.error(`FAIL: expected first exception to be DUPLICATE_PAY, got ${r.exceptions[0]?.type}`);
  pass = false;
}

if (pass) {
  console.log('\n✅ ALL CHECKS PASSED — engine output matches spec');
} else {
  process.exit(1);
}
