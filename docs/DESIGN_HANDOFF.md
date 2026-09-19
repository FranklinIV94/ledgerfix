# LedgerFix — UX/Design Elevation Handoff (drive Mel's settings-tab + polish work)

**Author: Prospyr Prime · 2026-09-19 · targets Franklin's premium-editorial bar
(reference: alverrainternational.com — dark, layered, typographic, not a flat Bootstrap page)**

> **Why this doc exists:** the engine is demo-clean and verified. The UI is **functional but
> utilitarian** — it looks like a dev tool, not a product a claims firm would trust with
> $26k of recoverable money. This handoff gives Mel the exact direction to raise the settings
> tab AND the whole surface to a standard that reads "premium," not "hackathon."
> Every instruction below is grounded in the **actual current files** (pulled live from
> `FranklinIV94/ledgerfix`, `public/style.css` + `public/index.html`).

---

## 0. Current state (what's actually live — from the repo)

**Design tokens already in place (good base, keep the bones):**
```css
--bg:#0b0e14     --surface:#13171f   --surface2:#1a1f2a   --border:#1e2530
--green:#22c55e  --green-dim:#166534 --red:#ef4444         --amber:#f59e0b  --blue:#3b82f6
--text:#e2e8f0   --muted:#64748b
--mono:'IBM Plex Mono'   --sans:'Inter'   --r:8px
```

**Structure already has:** a `#settings-panel` (currently a **collapsing panel**, `.card.settings-panel.hidden`), an API-key field (already `type="password"` with a show/hide toggle — good), a `#drop-zone`, stat cards, a `#critical-banner`, an exceptions list, an `error-banner` (already exists, unused flag).

**The honest critique — why it reads "dev tool," not "premium":**
1. **Single flat column, `max-width:820px`, no hierarchy or focal point.** A wall of same-weight cards. Nothing pulls the eye to "Recoverable $26,030."
2. **Flat, default-ish cards** — hairline `#1e2530` borders, 8px radius, no depth, no glow, no typographic rhythm. Looks like a template, not a brand.
3. **No brand story** — a bare "LedgerFix" header with a settings icon. No lockup, no tagline, no personality that says "audit-grade, claims-native."
4. **Settings as an inline panel** is cramped and generic. A dedicated **tab/view** (which Mel is building) is the right call — but it must carry the brand, not a form slapped on a card.

---

## 1. Guiding principle — "audit-grade, claims-native, silent confidence"
The product catches *recoverable money a clerk missed* in a **regulated, penalty-obsessed** world.
The design should feel like: **a dark financial terminal, edited by an editorial art director.** 
Think Stripe's calm + the ALBS/Prospyr green accent + monospace numerals that say "the numbers are real."

**Three words to design against:** *precise, calm, authoritative.*
No playful gradients, no purple, no emoji. Restraint IS the premium.

---

## 2. The settings tab — exact spec for Mel (this is the task in motion)

### 2.1 Navigation pattern (make it a real view, not a panel)
- **Top-right: a proper nav** with 2–3 quiet items. Left of the logo: **Settings** (gear icon + label), and if it earns a place, **About** or a link to the report artifact. Use a segmented look: **Reconcile → Settings** so the main surface reads "the tool," and settings reads "the config."
- **Settings becomes a full view**, not an inline `.card.settings-panel.hidden`. When open, it either (a) slides in as a right-side dismissible drawer with a scrim, or (b) swaps the main view. **Recommendation: right-side drawer (280–320px) with a subtle scrim** — keeps the core tool on screen, feels deliberate, and scales for more settings later.

### 2.2 Content structure (group, don't dump fields)
Group settings into titled sections with a monospace overline label (small caps, tracked):
1. **VOICE** (the feature that sells)
   - **ElevenLabs API key** — keep the `password` input + show/hide toggle ✓; ADD a **"Connect" status pill** that turns green/"Valid" only after a real test call succeeds, red/"Requires key" otherwise. Don't just accept a key — *verify it.*
   - **Voice selector** — a picker that lists the available voices (Rachel is stock; **add Franklin's clone** `b49BEbpA9R0tq5wqd5yV` as the default/featured, labeled "Franklin — your clone"); default to `eleven_v3` model (NOT the robotic `multilingual_v2`).
   - **"Preview voice"** button — plays a 3-second sample from the *live* key. This is the trust moment.
   - A quiet **model note**: "eleven_v3 · higher fidelity" vs "eleven_multilingual_v2 · broader languages."
2. **DATA**
   - CSV delimiter auto-detect / a note on expected columns (`claim_id, claimant, date_of_service, amount_billed, amount_paid, policy_id, coverage_remaining, claim_type, adjuster, status`).
   - This solves the "robustness: messy CSV" gap with real UX (see §4).
3. **APP**
   - Theme (already dark — offer **Dark** / **System**; keep it dark-only at the hackathon, don't add a light theme that invites inconsistency).
   - Danger zone reserved for later — do **not** build destructive settings into a hackathon UI.

### 2.3 The key-field UX (raise the bar — this is what judges see)
- Style it **monospace**, placeholder `sk_••••`, `aria` labels intact, **never echo the key in logs or the DOM value**. Add a **masked-chip** once entered (show `sk_2e93…b1d` truncated, not the whole key) with a "change" affordance.
- **Persist for the session only** (it already is — keep that; the handoff confirms "session memory"). On reload, show **"Re-enter key"**, not a stored secret. That's the secure behavior judges and I will check.

### 2.4 Empty/loading/error states (this is where "premium" shows)
- **Settings loading** → skeleton, not blank.
- **Key verify failure** → inline red, actionable copy ("Check the key starts with `sk_` and has ElevenLabs credits") — not just "Error."
- **Success** → the green "Valid" pill + a quiet check. Silent confidence.

---

## 3. The core surface — elevation plan (make the demo surface sing)

### 3.1 Hero / focal point (biggest win)
- **Replace the flat stat row with a single hero panel.** Top of the results: **"Recoverable $26,030.00"** in a **large monospace figure** (e.g. 44–56px, `--mono`, letter-spaced), with a sub-line — `6 exceptions across 14 claims` — and a **CRITICAL banner** that pulses gently when an exception is flagged. Make the recoverable number the *first thing the judge's eye lands on.*
- Below it, a **2-up grid**: **Top Exceptions** (ranked, severity-coded) and **Next Actions** (the `next_action_queue`). This matches my earlier recommendation and gives the demo a clear focal rhythm: *number → what's wrong → what to do.*

### 3.2 Typography & spacing
- **Display face:** add **Fraunces** (our brand serif) for the "LedgerFix" wordmark and the recoverable figure — it's the ALBS/prospyr editorial anchor. Keep **Inter** for body, **IBM Plex Mono** for all numerals/IDs/amounts (already `--mono`).
- **Type scale:** hero 44–56px · h2 18–20px · body 15px · meta 12–13px muted. Tight leading on mono figures.
- **Spacing rhythm:** generous, consistent (8/16/24/32). A 48px gap between the drop zone and results.

### 3.3 Surfaces & depth
- **Cards:** keep `--surface` but add **subtle depth** — `border: 1px solid var(--border)`, `background: linear-gradient(180deg, #161b26, #13171f)`, `border-radius: 14px` (up from 8), and a faint **top highlight** (`inset 0 1px 0 rgba(255,255,255,.04)`).
- **The CRITICAL element:** a low glow — `box-shadow: 0 0 0 1px rgba(239,68,68,.3), 0 8px 32px -12px rgba(239,68,68,.25)` behind the red banner. Use red *only* for the critical/duplicate; keep green for the recoverable number. Scarcity = authority.
- **Hover states** on interactive rows (exceptions) — brighten text, show the action on hover.

### 3.4 The drop zone (first impression)
- **Full-bleed dashed panel** with a large glyph, **drag-over state** (accent border + subtle green fill), and the two buttons (`Load sample ledger` secondary, `Browse` primary?). 
- **After load:** show a **file chip** — filename in mono + a `clear` affordance — instead of raw text.
- **On malformed CSV:** SHOW the `error-banner` (it's built but unused) with a human readable line ("Row 7: expected a number in 'amount_paid'"). This turns the robustness gap into a feature judges respect.

### 3.5 Footer / trust line
- Keep the **determinism disclaimer** ("deterministic rules · no LLM arithmetic · every figure traces to a ledger line") — but style it as a quiet, confident **trust bar** at the bottom, not a body paragraph. That line is a *selling point*; make it look intentional.

---

## 4. Robustness that doubles as polish (bake in, don't bolt on)
1. **CSV validation feedback** → surface the built `#error-banner` with row/field specifics (a real differentiator judges test).
2. **Underpay sign fix** (confirmed live: WC-1046 `-280` renders signless) — keep the minus. An auditor sees "$280" without sign and questions the math.
3. **`report.headline` is a string** (live `"6 exceptions found across 14 claims — $26,030.00 recoverable."`), not the structured object some docs imply — **align the code contract** so the hero can parse structured numbers, not a sentence, for the big figure.
4. **Severity grouping in the exceptions list** — CRITICAL + HIGH visible, MEDIUM collapsible under "Other variations (2)". Tightens the demo.

---

## 5. Concrete build order for Mel (do this sequence, not parallel chaos)
1. **Settings drawer + nav** (Reconcile ↔ Settings) carrying the brand.
2. **Key connect + verify** (the pill status) + voice selector with Franklin's clone + `eleven_v3` default + preview button.
3. **Hero recoverable figure** (mono, large) + critical glow + 2-up grid.
4. **Drop-zone polish** (drag state, file chip, error-banner wiring).
5. **Typography pass** (Fraunces wordmark + figure, Inter body, Plex Mono numerals) + spacing rhythm.
6. **Footer trust bar** + underpay sign + severity grouping.
7. **Verify** every push → auto-deploy → `curl` the health + reconcile → screenshot the new settings drawer for Franklin's review.

---

## 6. Non-negotiables (our standard, don't let the hackathon strip these)
- **Dark, restrained, on-brand** — Fraunces + Inter + Plex Mono, green accent scarce, red for critical only. No purple/emoji/gradients.
- **Numbers are real** — the recoverable figure and every exception trace to the ledger. The design must *reinforce* that integrity, never dress it up as fake.
- **Security** — API key masked, session-only, never in logs/DOM. Judges check this.
- **Settings are config, not a second app** — a quiet drawer, grouped, with verified connect states. No bloat.
- **Accessibility** — keep `aria-label`s on the settings button/toggle, focus rings, `accept=".csv"`. Premium and accessible are the same thing here.

---

## 7. Reference guardrail (don't drift)
- Match the depth of **alverrainternational.com** and our **portfolio** (franklin.simplifyingbusinesses.com) — same dark-canvas, serif display + green accent system. LedgerFix should *look like it belongs to the same firm* as every other Prospyr 305 / ALBS asset. If Mel produces a purple gradient "AI app," flag it — that's drift, not elevation.

---

## Handoff note for Mel (paste along with any code)
> You are raising LedgerFix's UI to a premium editorial standard. The engine and API are done
> and verified — do NOT touch rules/logic, only `public/` (index.html, style.css, app.js).
> Read this handoff section-by-section. Build the settings drawer + key-verify + voice selector
> FIRST, then the hero + grid, then the polish list. Keep the dark theme, Fraunces/Inter/Plex-Mono,
> green-accent-scarce. Ship small, verify (curl health + reconcile + screenshot), commit, push
> `master` — Render auto-deploys. Never store the API key in the repo or logs.
