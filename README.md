# Shopping Assistant

AI shopping agents can spend money, and an approval that only names a total ("up to $120") lets them buy the wrong thing. This app lets a non-technical shopper approve exactly what the agent may buy, and PayPal only charges when code confirms the purchase matches.

Built for the PayPal AI Hackathon. PayPal sandbox only: nothing real is ever charged.

## Live demo

**https://shopping-assistant-z5u2.onrender.com** · interactive system map: [/how-it-works](https://shopping-assistant-z5u2.onrender.com/how-it-works)

- Runs on PayPal sandbox. Approve with the official PayPal button (JS SDK v6) and your own sandbox PayPal login, or use the saved demo account with no sign-in.
- After a purchase, the receipt can refund it through PayPal's refund API, and an "asks you first" hold nobody answers is released after 30 minutes.
- Free Render instance: the first load can take up to a minute if the server was asleep.
- A spend guard limits AI runs per visitor per hour and per day (`lib/guard.ts`).

### Try these

1. **Running shoes** starter: "Waterproof running shoes, size 8, under $120. Free returns please. Ask me if it's over $100." Read the approval screen, approve, and watch it search, check each requirement against the store's own words, and hold, charge or release on PayPal.
2. **Dish soap** starter: "3 bottles of dish soap, under $50 for all of them. Any store is fine." Shows the quantity total (price × 3 must fit the limit). While it shops, a live shelf shows every product found and the rule that removed each one.
3. **Why the approval screen matters** (bottom of the page): a product page hides a note telling shopping agents to buy its $100 gift card. The same simulated, fooled agent runs twice. Under a total-only approval, PayPal sandbox takes the money. Under this app's approval, the gift card never reaches the agent's choice, and enforcement would release the hold if it did.

## How it works

The rule: **the AI chooses and explains; code decides whether PayPal may charge.** The [How it works](https://shopping-assistant-z5u2.onrender.com/how-it-works) page plays four real runs (buys, asks first, stops itself, gift-card trap) through this pipeline.

| # | Step | Who | Where |
|---|---|---|---|
| 1 | Shopper writes the request in their own words | Shopper | `app/assistant.tsx` |
| 2 | Draft structured instructions (limit, stores, must-haves, check-ins, can't-promise) | **AI** (Claude Sonnet 5, high effort) | `lib/draft.ts`, `lib/draft-prompt.ts` |
| 3 | Readback: one line per rule, tied to the shopper's words; warnings for anything the draft added or lost | Code (fixed templates, no AI text) | `lib/readback.ts`, `lib/warnings.ts` |
| 4 | Shopper approves; the approval is sealed with HMAC-SHA256, so a raised limit or new store is refused later | Code | `lib/approval.ts`, `app/api/approve/route.ts` |
| 5 | Product search (live Channel3, saved snapshot as backup) | Code | `lib/search.ts`, `lib/catalog.ts` |
| 6 | Shortlist: price × quantity under the limit, allowed stores only, avoided stores dropped, no gift cards or money-like items | Code | `lib/shortlist.ts` |
| 7 | Check each requirement: Checked / Didn't match / Couldn't check, quoting the listing or return policy | **AI** (Claude Sonnet 5, high effort) | `lib/check-product.ts` |
| 8 | Verify every quote appears verbatim in the listing or policy; otherwise the answer becomes "couldn't check" | Code | `lib/check-core.ts` |
| 9 | Pick one shortlisted product and explain why in one sentence | **AI** (Claude Haiku 5.5, low effort) | `lib/pick.ts` |
| 10 | Accept the pick only if it names a shortlisted product; with one option left, code picks and no AI is called | Code | `lib/pick-core.ts` |
| 11 | PayPal Orders v2 `AUTHORIZE` on the saved (vaulted) account, for the real item and total | Code | `lib/hold.ts`, `lib/paypal.ts` |
| 12 | Enforcement decides: capture, void, or ask the shopper first | Code (pure function, no AI, no network) | `lib/enforce.ts` |
| 13 | Receipt read back from PayPal, plus a sealed proof record the shopper can keep | Code | `lib/hold.ts` (`readOrder`), `lib/proof.ts` |

Enforcement order: hard limits first (amount, stores, quantity, expiry, gift cards, exact item), then the checker's results, then check-ins (over the ask-first amount, substitute, unnamed store, price changed since approval, final sale, same item within 24 hours). Any hard-limit or check failure releases the hold; a requirement nobody could check counts as a failure, never a pass.

## PayPal integration

All money-moving calls are plain REST in `lib/paypal.ts` and `lib/hold.ts`; the AI never reaches them. (The Agent Toolkit's `create_order` always uses intent `CAPTURE`, so holds go through REST directly.)

- **Saved account (Vault v3):** setup token and payment token (`/v3/vault/setup-tokens`, `/v3/vault/payment-tokens`) on the owner-only bench `app/api/day1/[action]/route.ts`. Before sealing an approval, `app/api/approve/route.ts` reads `/v3/vault/payment-tokens/{id}` to confirm the saved account still exists.
- **Hold:** `POST /v2/checkout/orders` with `intent: "AUTHORIZE"` and `payment_source.paypal.vault_id`, so no shopper login is needed per purchase (`vaultedHoldOrderBody` in `lib/paypal.ts`, `placeHold` in `lib/hold.ts`).
- **Capture:** `captureHold` first reads the authorization, refuses unless its status is `CREATED`, and refuses any amount above `min(held, shopper's limit)`. PayPal itself allows capturing up to 115% of a hold; this code does not. Captures send `final_capture: true`.
- **Void:** `releaseHold` voids the authorization, then reads it back.
- **Idempotency:** every money-moving POST sends `PayPal-Request-Id` from `stepRequestId(resource, step)`: stable per step on one resource, so a retried charge or release replays PayPal's first answer instead of acting twice. The hold's key is stable per approval + product.
- **Read-back:** the receipt shows `GET /v2/checkout/orders/{id}` as PayPal reports it, never assumed from our own calls.
- The vault id is set by the server, never by the model, and is left out of the shareable proof file.

## Model scorecard

Every AI step was chosen by an eval on synthetic cases (written by Claude for testing, not user research). Full rounds, failures and fixes: [eval/LOG.md](eval/LOG.md).

- **pass^3:** a case counts only if all 3 runs pass. A shopper sees one run, so a case that is right 2 times out of 3 is a case that sometimes buys the wrong thing.
- **Severity:** **critical** = the result could spend money against the shopper's wishes (a false "Checked" on a requirement, a dropped store list, an invented spending rule, a false claim or invented dollar amount shown to the shopper). **Major** = wrong but money stays safe or a good buy is blocked (e.g. "didn't match" vs "couldn't check", a worse pick). **Minor** = wording or preference-level mistakes. A model needs zero critical mistakes to pass the gate.

### Drafter (39 requests × 3 runs)

| Model | pass^3 | pass@1 | Cases with a critical error | Avg time | Cost per draft |
|---|---|---|---|---|---|
| **Claude Sonnet 5** (gateway, high effort) | **34/39** | 92% | **0** | 4.6 s | ~$0.016 |
| GPT-5.6 Luna | 33/39 | 90% | 1 | 1.6 s | ~$0.0005 |
| Claude Haiku 4.5 | 30/39 | 80% | 2 | 2.2 s | ~$0.006 |
| Claude Sonnet 5, app path, medium effort (Round 6) | 33/39 | 91% | 2 | 3.8 s | |

Screened out in a single-run round: Mistral Large 3 (7 critical, broken JSON) and Nova Lite (2/39, invented stores). **Chosen: Sonnet 5, high effort.** The only model with zero critical errors in 117 runs, and the only one that resisted an injected "leave the price limit empty" instruction before the prompt was hardened. About 30× Luna's cost, but a dropped store list is exactly the failure this product exists to prevent. Medium effort was tried in the app and wrote `brooks.com` for "Brooks" in 2 of 3 runs, so the app went back to high.

### Product checker (37 cases × 3 runs)

| Model | Route | pass^3 | Cases with a critical mistake | Avg time | Cost per check |
|---|---|---|---|---|---|
| **Claude Sonnet 5, high** | Anthropic direct | **34/37** | **0** | 1.3 s | ~$0.0033 |
| Claude Haiku 5.5, medium | Anthropic direct | 33/37 | 0 | 1.1 s | ~$0.0002 |
| Claude Haiku 5.5, high | Anthropic direct | 32/37 | 0 | 1.3 s | ~$0.0002 |
| GPT-5.6 Luna | Astropods gateway | 34/37 | 0 | 0.6 s | |
| Claude Sonnet 5 (no effort setting) | Astropods gateway | 32/37 | 0 | 1.5 s | |
| Mistral Large 3 | Astropods gateway | 25/37 | 4 | 0.9 s | |

**Chosen: Sonnet 5, high effort.** Zero critical mistakes and the most requirements proven; Haiku 5.5 was over-cautious ("couldn't check" on a title that says "Waterproof"), which releases holds on good products. Luna tied on quality at lower cost but would need a second API key; not switched.

### Pick (19 cases × 3 runs)

| Model | Route | pass^3 | Critical | Avg time | Cost per pick |
|---|---|---|---|---|---|
| Claude Sonnet 5, low | Anthropic direct | 19/19 | 0 | 1.2 s | ~$0.0017 |
| **Claude Haiku 5.5, low** | Anthropic direct | 18/19 (19/19 read by hand) | 1 flagged, not a false claim | 0.9 s | ~$0.0001 |
| GPT-5.6 Luna | Astropods gateway | 19/19 | 0 | 0.7 s | ~$0.0001 |
| Mistral Large 3 | Astropods gateway | 14/19 | 3 | 0.6 s | |

**Chosen: Haiku 5.5, low effort.** It matched Sonnet 5 on every pick and every price × quantity total, at a fraction of the cost, on the same key. The pick is low stakes: it only sees options that already passed every code filter, and enforcement re-checks it.

Caveats, as recorded in the log: several prompt fixes were found on the same cases they were re-scored on, so these scores are optimistic. The pick set was too easy to separate models (all Claude setups scored 19/19 in Round 9).

## Safety invariants and tests

`npm test` runs 151 tests (151 pass, 0 skipped, as of this README). What they guarantee:

- **Never charges above the limit:** 10,000 random seeded cases where no capture ever breaks a promise to the shopper (`tests/enforce-invariants.test.mts`); one cent over the limit releases the hold; nothing above what PayPal holds is captured; no limit means nothing is charged (`tests/enforce.test.mts`).
- **Unverifiable means no:** a must-have nobody could check, or a missing checker result, releases the hold; a failed hard limit wins over any check-in (`tests/enforce.test.mts`).
- **Quotes must be the store's words:** a "Checked" with no quote or a quote not in the listing becomes "couldn't check"; a skipped requirement never counts as passed (`tests/check-product.test.mts`).
- **Gift cards never reach the pick or the charge**, even with any store allowed (`tests/shortlist.test.mts`, `tests/attack.test.mts`).
- **Sealed approval:** raising the limit after approval, or a seal from another secret, is refused; a missing or short secret fails loudly (`tests/approval.test.mts`).
- **Proof record:** an edited proof no longer checks out; the saved account's vault id never goes into the shareable file; the return policy is kept word for word with a fingerprint (`tests/proof.test.mts`).
- **Idempotency:** a retried charge sends the same PayPal-Request-Id; charge and release never share one (`tests/paypal.test.mts`).
- **The model can never set the payment account**; invented limits, added stores and an empty product list are all flagged on the readback (`tests/rules.test.mts`).
- **Spend guard:** per-visitor hourly limit and a daily ceiling for the whole demo (`tests/guard.test.mts`).
- **The evals themselves:** scorers fail drafts that drop any instruction, answer keys score perfectly against themselves, and pass^k can't be inflated by a lost run (`tests/drafter-check.test.mts`, `tests/product-check-score.test.mts`, `tests/pick-score.test.mts`, `tests/pass-k.test.mts`).

## Feedback loop

- **Loop 1, in the browser (`lib/history.ts`, `lib/suggest.ts`):** past purchases and the shopper's answers ("Don't buy: too expensive / wrong store / not what I meant", "Was this right?") stay in their own browser. They become "From your past purchases" suggestions on the readback. A suggestion is only applied when the shopper taps it, names the purchase it came from, and tightening suggestions come first. Loosening (e.g. raising the ask-first amount) is never applied without a tap and never goes past the spending limit.
- **Loop 2, logs to draft eval cases (`npm run feedback -- server.log`):** the server logs one line per answer and per released hold. Request edits are logged only when the shopper ticks "Share this correction". The script turns logs into draft drafter cases with no expected answer (a person writes it), return-policy to-dos, flagged stores and refusal rates. Nothing is applied automatically; reviewed cases must pass the evals like any other. See [eval/README.md](eval/README.md).

## Run locally

Requirements: Node 24, a PayPal sandbox app, a Channel3 key and an Anthropic key.

```bash
npm ci
cp .env.example .env.local     # then fill in the values below
npm run dev                    # http://localhost:3000
```

`.env.local` names (see `.env.example` for where to get each):

| Name | What |
|---|---|
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Sandbox app from the PayPal Developer Dashboard. Turn on Vault / Save payment methods for the app. |
| `PAYPAL_API_BASE` | Optional; defaults to sandbox |
| `CHANNEL3_API_KEY` | Product search |
| `ANTHROPIC_API_KEY` | Drafter, checker and pick |
| `APPROVAL_SECRET` | 32+ random characters; seals approvals and proofs |
| `PAYPAL_DEMO_VAULT_ID` | The saved sandbox account shoppers buy with. In dev, open `/day1`, click "Save PayPal account", log in with your sandbox personal account, then paste the vault id it shows. |

Optional: `npm run catalog` saves a Channel3 snapshot to `data/catalog.json` (not committed) as a search backup.

Checks and evals:

```bash
npm test                         # all unit, invariant and eval-scorer tests (no network)
npm run typecheck && npm run lint
npm run fixtures -- --runs=3     # drafter eval on the app's exact setup (Anthropic key, spends credit)
npm run eval-checker -- claude-sonnet-5:high --runs=3
npm run eval-pick
npm run feedback -- server.log   # Loop 2
```

Non-Claude models were compared through the Astropods AI Gateway in a container; see [eval/README.md](eval/README.md). The public app does not use Astropods.

### Deploy

`render.yaml` is a Render Blueprint (New, then Blueprint, then pick this repo). It builds with `npm ci && npm run build`, runs on Node 24, generates `APPROVAL_SECRET`, and asks for the other secrets in Render's dashboard; none are stored in the repo. The `/day1` bench is hidden in production.

## Built with

- PayPal Orders v2 and Vault v3 (sandbox)
- Anthropic Claude: Sonnet 5 (drafter, checker), Haiku 5.5 (pick)
- Channel3 product search
- Next.js 16, Render

Not affiliated with or endorsed by PayPal.

## License

MIT. See [LICENSE](LICENSE).
