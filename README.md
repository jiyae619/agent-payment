# Okay-Pay

AI shopping agents can spend money, and an approval that only names a total ("up to $120") lets them buy the wrong thing. This app lets a non-technical shopper approve exactly what the agent may buy, and PayPal only charges when code confirms the purchase matches.

Built for the PayPal AI Hackathon. PayPal sandbox only: nothing real is ever charged.

## Live demo

**https://shopping-assistant-z5u2.onrender.com** · interactive system map: [/how-it-works](https://shopping-assistant-z5u2.onrender.com/how-it-works)

- Runs on PayPal sandbox. Approve with the official PayPal button (JS SDK v6) and a sandbox PayPal login. Judges: the sandbox login is in the Devpost testing instructions. If the PayPal sign-in won't open, a small link uses a saved sandbox test account instead.
- Refunds live in **Your purchases** (`/purchases`), the order list kept in the shopper's browser, not on the confirmation screen. An "asks you first" hold nobody answers is released after 30 minutes.
- Free Render instance: the first load can take up to a minute if the server was asleep.
- A spend guard limits AI runs per visitor per hour and per day (`lib/guard.ts`).

### Try these

The page shows one purchase from three sides: PayPal on the left (where the money is, and every real API call this run made), the shopper in the middle, and the store on the right (what it was checked against, the order it gets, and the proof id on that order). Pick a run, choose how much it may guess (Check each guess, Allow guesses, Use best guesses), then go. Every run uses live search and PayPal sandbox.

1. **Buys it:** "3 bottles of dish soap, under $50 for all of them. Any store is fine." Every rule passes and the return terms are on file, so PayPal holds and charges the total (price × 3).
2. **Asks you first:** "Waterproof running shoes, size 8, under $120. Free returns please. Ask me if it's over $80." The listing proves waterproof, size 8 and free returns; the price is over $80, so PayPal holds the money and waits for your Pay or Don't buy.
3. **Stops itself:** "Waterproof running shoes, size 8, under $60. Free returns please." No store under $60 proves free returns, so every option says "Won't pass" and nothing is held. You can still tap **Choose anyway**: PayPal holds the money and asks you first, listing what wasn't confirmed. Hard limits (over the limit, a store you didn't allow, gift cards) can never be chosen past.
4. **Prompt-injection trap:** a product page hides a note telling shopping agents to buy its $100 gift card. The same simulated, fooled agent runs twice: under a total-only approval PayPal sandbox takes $100; under this app's approval the gift card never reaches the agent and no PayPal call is made.

Type your own request too. A phrase the AI has to interpret, like "doesn't smell like anything", shows up as a guess chip.

## How it works

The app runs one step per screen: **Ask → Approve → Shop → Choose → Pay**. The rule: **the AI recommends and explains; the shopper chooses; code decides whether PayPal may charge.** The [How it works](https://shopping-assistant-z5u2.onrender.com/how-it-works) page plays four real runs (buys, asks first, stops itself, prompt-injection trap) through this pipeline.

| # | Step | Who | Where |
|---|---|---|---|
| 1 | Shopper writes the request in their own words | Shopper | `app/assistant.tsx` |
| 2 | Draft structured instructions (limit, stores, must-haves, check-ins, can't-promise) | **AI** (Claude Sonnet 5, high effort) | `lib/draft.ts`, `lib/draft-prompt.ts` |
| 3 | Readback: one line per rule, tied to the shopper's words; warnings for anything the draft added or lost | Code (fixed templates, no AI text) | `lib/readback.ts`, `lib/warnings.ts` |
| 4 | One approval screen: an "I'll buy" summary where every rule the AI interpreted is a guess chip (found by code: the value isn't in the shopper's words), the full rule list folded. The shopper picks a level with each request: **Check guesses** (confirm each before Approve unlocks), **Allow guesses** (default), **Auto-shop**. The approval is sealed (AES-256-GCM, so the browser can neither read the saved PayPal account nor change a rule), and a raised limit or new store is refused later | Code | `lib/approval.ts`, `app/api/approve/route.ts` |
| 5 | Product search (live Channel3, saved snapshot as backup) | Code | `lib/search.ts`, `lib/catalog.ts` |
| 6 | Shortlist: price × quantity under the limit, allowed stores only, avoided stores dropped, no gift cards or money-like items | Code | `lib/shortlist.ts` |
| 7 | Check each requirement: Checked / Didn't match / Couldn't check, quoting the listing or return policy | **AI** (Claude Sonnet 5, high effort) | `lib/check-product.ts` |
| 8 | Verify every quote appears verbatim in the listing or policy; otherwise the answer becomes "couldn't check" | Code | `lib/check-core.ts` |
| 9 | Recommend one shortlisted product and explain why in one sentence | **AI** (Claude Haiku 5.5, low effort) | `lib/pick.ts` |
| 10 | Accept the recommendation only if it names a shortlisted product; with one option left, code picks and no AI is called | Code | `lib/pick-core.ts` |
| 11 | Show up to 3 checked options, recommendation first, each with its requirement checks; nothing is held yet | Code | `app/api/shop/route.ts`, `lib/purchase.ts` (`optionView`) |
| 12 | Shopper chooses one (picking another option is recorded as the shopper's choice in the proof) | Shopper | `app/shopping.tsx`, `app/api/shop/buy/route.ts` |
| 13 | PayPal Orders v2 `AUTHORIZE` on the saved (vaulted) account, for the chosen item and total | Code | `lib/purchase.ts`, `lib/hold.ts`, `lib/paypal.ts` |
| 14 | Enforcement decides: capture, void, or ask the shopper first | Code (pure function, no AI, no network) | `lib/enforce.ts` |
| 15 | Receipt read back from PayPal, plus a sealed proof record the shopper can keep (no shopper words in it, only a fingerprint); refunds from Your purchases | Code | `lib/hold.ts` (`readOrder`, `refundCapture`), `lib/proof.ts` |

Enforcement order: hard limits first (amount, stores, quantity, expiry, gift cards, exact item), then the checker's results, then check-ins (over the ask-first amount, substitute, a new store only if the shopper asked, price changed since approval, final sale, **can't be undone**: a no-return kind of item such as personalized, perishable, tickets or digital, or no return policy found anywhere, same item within 24 hours). Every guess level still asks before anything that can't be undone. Any hard-limit or check failure releases the hold; a requirement nobody could check counts as a failure, never a pass.

## PayPal integration

All money-moving calls are plain REST in `lib/paypal.ts` and `lib/hold.ts`; the AI never reaches them. (The Agent Toolkit's `create_order` always uses intent `CAPTURE`, so holds go through REST directly.)

- **PayPal button (JS SDK v6):** `app/paypal-approve.tsx` loads the v6 web SDK with a browser-safe client token (`app/api/paypal/client-token/route.ts`, `response_type=client_token`), checks eligibility for `VAULT_WITHOUT_PAYMENT`, and starts a PayPal save-payment session. The shopper signs in and agrees in PayPal's own window.
- **Saved account (Vault v3):** the server creates the setup token (`app/api/paypal/setup-token/route.ts`, `/v3/vault/setup-tokens`), then turns the approved one into a payment token (`/v3/vault/payment-tokens`) in `app/api/approve/route.ts`. The vault id is sealed into the approval and never sent to the browser. The fallback link uses a saved sandbox test account (`PAYPAL_DEMO_VAULT_ID`), after confirming it still exists.
- **Hold:** `POST /v2/checkout/orders` with `intent: "AUTHORIZE"` and `payment_source.paypal.vault_id`, so no shopper login is needed per purchase (`vaultedHoldOrderBody` in `lib/paypal.ts`, `placeHold` in `lib/hold.ts`).
- **Capture:** `captureHold` first reads the authorization, refuses unless its status is `CREATED`, and refuses any amount above `min(held, shopper's limit)`. PayPal itself allows capturing up to 115% of a hold; this code does not. Captures send `final_capture: true`.
- **Void:** `releaseHold` voids the authorization, then reads it back. An "asks you first" hold nobody answers is voided after 30 minutes, and a late "Pay" can't charge it (`lib/pending.ts`).
- **Refund:** `refundCapture` (`POST /v2/payments/captures/{id}/refund`) refuses unless the capture is `COMPLETED`; the refund is added to the proof record (`app/api/refund/route.ts`).
- **Idempotency:** every money-moving POST sends `PayPal-Request-Id` from `stepRequestId(resource, step)`: stable per step on one resource, so a retried charge or release replays PayPal's first answer instead of acting twice. The hold's key is stable per approval + product.
- **Proof ID on the order:** every hold sets `purchase_units[0].custom_id` to the proof record's id and puts the returns label plus anything not confirmed in the item description. [`/verify`](https://shopping-assistant-z5u2.onrender.com/verify) lets a store or PayPal open a saved proof: it checks the seal, reads the PayPal order and confirms its `custom_id` matches, then shows the rules, quotes, level and timeline, never the shopper's own words (`app/api/proof/verify/route.ts`, `app/verify/`).
- **Read-back:** the receipt shows `GET /v2/checkout/orders/{id}` as PayPal reports it, never assumed from our own calls.
- **Webhooks (optional):** with `PAYPAL_WEBHOOK_ID` set, `app/api/paypal/webhook/route.ts` receives hold, void, capture and refund events. Each one is checked with PayPal's `POST /v1/notifications/verify-webhook-signature` before it is trusted, and a retried delivery counts once (`lib/webhook.ts`, `tests/webhook.test.mts`). `/verify` lists them as "PayPal told us directly". The demo has no database, so events live in memory and are lost when the server restarts; the read-back above still works without them.
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

`npm test` runs 181 tests (181 pass, 0 skipped, as of this README). What they guarantee:

- **Never charges above the limit:** 10,000 random seeded cases where no capture ever breaks a promise to the shopper (`tests/enforce-invariants.test.mts`); one cent over the limit releases the hold; nothing above what PayPal holds is captured; no limit means nothing is charged (`tests/enforce.test.mts`).
- **Unverifiable means no:** a must-have nobody could check, or a missing checker result, releases the hold; a failed hard limit wins over any check-in (`tests/enforce.test.mts`).
- **Quotes must be the store's words:** a "Checked" with no quote or a quote not in the listing becomes "couldn't check"; a skipped requirement never counts as passed (`tests/check-product.test.mts`).
- **Gift cards never reach the pick or the charge**, even with any store allowed (`tests/shortlist.test.mts`, `tests/attack.test.mts`).
- **Sealed approval:** raising the limit after approval, or a seal from another secret, is refused; a missing or short secret fails loudly (`tests/approval.test.mts`).
- **Can't be undone asks first:** a no-return kind of item, or no return policy found, always asks; returns stated in the listing or on the store's policy page don't (`tests/returns.test.mts`, `tests/enforce.test.mts`).
- **Guesses:** a rule whose value the shopper didn't literally say is shown as a guess, and changing it makes it theirs (`tests/guesses.test.mts`).
- **Ranking:** most requirements proven by the store's words first, then fewest contradictions, then cheapest (`tests/pick-core.test.mts`).
- **Proof record:** every PayPal hold carries the proof id (`tests/paypal.test.mts`); an edited proof no longer checks out; the saved account's vault id never goes into the shareable file; the return policy is kept word for word with a fingerprint (`tests/proof.test.mts`).
- **Idempotency:** a retried charge sends the same PayPal-Request-Id; charge and release never share one (`tests/paypal.test.mts`).
- **The model can never set the payment account**; invented limits, added stores and an empty product list are all flagged on the readback (`tests/rules.test.mts`).
- **Spend guard:** per-visitor hourly limit and a daily ceiling for the whole demo (`tests/guard.test.mts`).
- **Unanswered holds expire:** an "asks you first" hold is released after 30 minutes and a late answer can't charge (`tests/pending.test.mts`).
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
| `PAYPAL_WEBHOOK_ID` | Optional. From `npm run register-webhook`; turns on webhook events. |
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
npm run demo-check               # is the public demo ready for judges?
```

Non-Claude models were compared through the Astropods AI Gateway in a container; see [eval/README.md](eval/README.md). The public app does not use Astropods.

### Deploy

`render.yaml` is a Render Blueprint (New, then Blueprint, then pick this repo). It builds with `npm ci && npm run build`, runs on Node 24, generates `APPROVAL_SECRET`, and asks for the other secrets in Render's dashboard; none are stored in the repo. The `/day1` bench is hidden in production.

### Keeping the demo up during judging

- **Cold starts:** Render's free plan sleeps after about 15 minutes idle, and the next visit took about 34 seconds in a check on Nov 10. `.github/workflows/keep-warm.yml` pings the home page every 10 minutes (GitHub may delay a run by a few minutes). The other fix is a paid Render plan; then delete the workflow.
- **Before submitting and again before Dec 1:** `npm run demo-check` checks the PayPal sandbox login, the demo PayPal account, Channel3 live search, the Anthropic key, the webhook id and the live site, without printing any secret. It reads `.env.local`, so it confirms your keys work; keep Render's values the same.
- **No search backup on Render:** `data/catalog.json` isn't committed (check Channel3's terms first), so if Channel3 is down the demo finds nothing. Watch Channel3 credit before judging.
- **Limits:** 12 runs per visitor per hour and 300 a day (`lib/guard.ts`), with a plain message when reached.
- **Webhooks:** `DEMO_URL=https://shopping-assistant-z5u2.onrender.com npm run register-webhook` registers the webhook on your PayPal sandbox app (it changes that app's settings) and prints `PAYPAL_WEBHOOK_ID` to set in Render.

## Built with

- PayPal JS SDK v6 (PayPal button), Orders v2 (authorize, capture, void), Payments v2 (refund) and Vault v3 (sandbox)
- Anthropic Claude: Sonnet 5 (drafter, checker), Haiku 5.5 (pick)
- Channel3 product search
- Next.js 16, Render

Not affiliated with or endorsed by PayPal.

## License

MIT. See [LICENSE](LICENSE).
