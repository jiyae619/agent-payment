# Shopping Assistant (PayPal AI Hackathon)

Hand off a purchase in your own words, be asked when it matters, and get proof the result matches what you meant. The plan is in [build-plan.md](build-plan.md).

Status: **Day 1 done** — PayPal sandbox hold → charge / release works with a saved PayPal account (Vault); test bench at `/day1`. Results in [build-plan.md](build-plan.md) section 1.

## Setup

1. Install: `npm install`
2. In the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications/sandbox) (Sandbox):
   - Create an app (or open the default one) and copy its **Client ID** and **Secret**.
   - In the app's settings, turn on **Vault / Save payment methods** (needed for path A).
   - Under **Testing tools → Sandbox accounts**, note the **personal** (shopper) account email. Open it to see its password.
3. `cp .env.example .env.local` and paste the Client ID and Secret.
4. `npm run dev` and open http://localhost:3000/day1

## Day 1 test (what "done" looks like)

**Path A — saved PayPal account (preferred):**
1. *Save PayPal account* → log in on PayPal with the sandbox **personal** account → approve.
2. Back on `/day1`, *Hold for this item* → a hold for $94 appears, no login.
3. *Charge $94* → charged; or *Release hold* → nothing charged.

**Path B — fallback hold up to a cap:**
1. *Approve hold on PayPal* → log in as the personal account. PayPal's screen should show the item text ("Up to $120: running shoes…").
2. Back on `/day1` the $120 hold is placed. *Charge $94* should capture $94 and release $26.

Also try *Try charging $10 over*: our code must refuse it, even though PayPal itself allows reauthorizing up to 115%.

Check each step in the Dashboard (Sandbox → Event logs / the business account's activity).
