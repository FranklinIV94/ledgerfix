# LedgerFix — 3-minute live demo script

**Event:** Mel Miami AI Hackathon · Sep 20, 2026 · submission cutoff 6:00 PM ET, live demos 6:00–8:30 PM
**URL:** https://ledgerfix.prospyr305.com (fallback: https://ledgerfix.onrender.com)
**Presenter:** Franklin

## Pre-flight (do this 5 minutes before you go on)

1. Open https://ledgerfix.prospyr305.com in a tab and load it once — this wakes the free Render instance (30–50 s cold start). Reload; it should be instant.
2. Open **Settings** (the gear button, top right) and paste the working ElevenLabs `sk_` key. It is masked, held in memory for this tab only, and never saved — no browser storage, nothing on the server. Do not commit it anywhere. **Close Settings before you present** — the audience should never see the panel.
3. Click **Load sample ledger → Run Reconciliation → Play Findings** once, off-stage. If audio plays: you are live. If it fails: use the **Play pre-recorded** fallback (`/audio/ledgerfix-findings-franklin.mp3`, 38 s, your cloned voice, eleven_v3).
4. Laptop: plugged in, sleep off, screen lock off, volume up, Discord/Mel notifications muted.
5. Reset the page (reload) so the stage run starts clean.

## Talk track (~3:00, then let the voice play in full)

| Time | Beat | Say | Do |
| --- | --- | --- | --- |
| 0:00–0:10 | Hook | "Claims practices close their books by hand every month, and the expensive mistake is the one a line-by-line clerk never sees." | Nothing on screen but the empty drop zone. |
| 0:10–0:30 | Setup | "This is a real month: 14 workers' comp claims, about $79,000 billed. LedgerFix is a reconciliation copilot that closes it in one pass — deterministic rules, no LLM doing arithmetic, so every dollar traces to a ledger line." | Click **Load sample ledger**. |
| 0:30–1:10 | The money beat | "Six exceptions. $26,030 recoverable. And the number one finding is a duplicate a human missed: Carmen Delgado, WC-1051 and WC-1052 — same date of service, same policy, paid twice. $18,400 out the door." | Click **Run Reconciliation**. Point at the CRITICAL card. Then: "Denied claims never re-billed — $7,050 sitting on the table. Paid-versus-billed variances — a $300 overpayment, a $280 underpayment. Ranked by severity, each with the next action a clerk can take without opening the source file." Expand **Lower severity (2)** briefly. |
| 1:10–1:20 | Pivot to voice | "You don't have to read it. It tells you." | Click **Play Findings**. |
| 1:20–2:00 | The voice | **Say nothing.** Let the cloned voice read the findings end-to-end. | Hands off the keyboard. |
| 2:00–2:40 | Close | "That's my voice, cloned on ElevenLabs v3, reading a report that was generated from rules — not a model guessing at numbers. Accounting records the past. LedgerFix owns the close: it finds the error, tells you what to do, and says it out loud. In a business where one billing error is a penalty or an audit, you can't afford not to have this." | Stay on the results screen. |
| 2:40–3:00 | Ask | "Live at ledgerfix.prospyr305.com, source on GitHub, zero dependencies, deploys on push. Questions?" | Done. |

## Numbers to have in your head

- 14 claims scanned · 6 exceptions · **$26,030.00 recoverable**
- CRITICAL: WC-1051 / WC-1052 duplicate, Carmen Delgado, **$18,400** (counted once)
- HIGH: denied-not-rebilled WC-1049 ($4,100) and WC-1048 ($2,950) = $7,050
- MEDIUM: WC-1047 overpaid +$300 · WC-1046 underpaid −$280 = $580 variance
- $18,400 + $7,050 + $580 = $26,030

## If something breaks

| Symptom | Do |
| --- | --- |
| Page hangs on first load | Cold start — wait 30–50 s, or switch to the onrender.com URL. Pre-flight step 1 prevents this. |
| Play Findings errors or stalls | Click **Play pre-recorded** (the 38 s fallback MP3). Same words, same voice. |
| "Add your ElevenLabs API key in Settings" | The panel opens itself — paste the key there, or just click **Play pre-recorded** and keep talking. |
| Key field missing on the main screen | That is intentional. The key lives behind **Settings** so the demo screen stays clean. |
| Sample won't load | Drag `sample-ledger.csv` from the repo folder onto the drop zone. |
| Nothing works | Play the fallback MP3 from the laptop directly and walk through the numbers above from memory. |
