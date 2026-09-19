# LedgerFix

Agentic reconciliation + billing-compliance copilot for high-liability service firms
(workers' comp / medical claims / legal billing), where one billing error costs a penalty
or an audit.

Drop in a month of claims and LedgerFix reconciles the ledger, flags the exceptions a
line-by-line clerk misses, hands back an auditable JSON report, and **reads the findings
out loud** in a cloned voice via ElevenLabs.

The engine is deterministic — plain rules, no LLM arithmetic — so the numbers it reports are
the numbers in your ledger.

## What it catches

| Rule | Severity | What it finds |
|------|----------|---------------|
| `DUPLICATE_PAY` | CRITICAL | The same claimant + date of service + policy billed across more than one paid line |
| `PAID_VARIANCE` | HIGH / MEDIUM / LOW | Paid ≠ billed, ranked by the size of the gap |
| `DENIED_NO_REBILL` | HIGH | Denied claim with $0 paid and no re-bill — a recovery opportunity |

Duplicate lines are reported individually so the finding is auditable, but the recoverable
amount is counted **once**, on the primary line. Recoverable total = duplicate primary +
denied + every variance gap.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | The single-screen UI |
| `GET` | `/api/health` | Liveness check — `{ "status": "ok", "service": "ledgerfix" }` |
| `POST` | `/api/reconcile` | Body `{ csvText, sourceLedger? }` → the full report artifact |
| `POST` | `/api/narrate` | Body `{ report, apiKey }` → MP3 narration of the findings |
| `POST` | `/api/narrate-stream` | Same, but streams the audio back as it is generated |

### The report artifact

`POST /api/reconcile` returns `{ success: true, report }`, where `report` is the
auditor-readable record:

```
generated_at, source_ledger, claims_scanned,
total_billed, total_paid, exceptions_found, recoverable_total,
exception_summary { duplicate_overpayment, denied_not_rebilled, paid_variance },
priorities { critical_count, critical_recoverable },
headline, exceptions[], next_action_queue[]
```

Every entry in `exceptions[]` carries `severity, type, claim_id, claimant, finding`
(plain English), `amount`, and `next_action`.

## Running locally

No dependencies to install — LedgerFix runs on Node's built-in `http` module.

```bash
cd ledgerfix
npm start                 # http://localhost:3000
npm test                  # engine checks against sample-ledger.csv
```

Node 18 or newer (the voice layer and tests use the global `fetch`).

Set `PORT` to listen elsewhere; the server binds `0.0.0.0`.

```bash
PORT=8080 npm start
```

Open the UI, click **Load sample ledger**, then **Run Reconciliation**. The bundled
`sample-ledger.csv` (14 claims) is wired to the expected result: **6 exceptions,
$26,030 recoverable, CRITICAL #1 = the $18,400 duplicate**.

## Voice narration and the API key

**The ElevenLabs API key is supplied by the client at runtime** — the user types it into
the UI, and the browser sends it with the `/api/narrate` request. It is never stored on the
server, never written to disk, and not read from an environment variable. Nothing about the
deployment depends on a server-side key.

The narration layer converts every figure to plain English words before it reaches the TTS
engine (`$18,400` → "eighteen thousand four hundred dollars"), and strips raw symbols and
parentheses that garble speech parsing.

## Deployment

`render.yaml` describes the service for Render (health check on `/api/health`, free plan).
Point a Render blueprint at this repo, or set the same values by hand.

## Layout

```
server.js            # HTTP server, routing, static files
engine.js            # parseCSV + the three reconciliation rules
report.js            # builds the report artifact
voice.js             # narration script + ElevenLabs synthesis
test-engine.js       # engine assertions against the sample ledger
public/              # single-screen UI (index.html, app.js, style.css)
sample-ledger.csv    # the 14-claim demo ledger
render.yaml          # Render service definition
```
