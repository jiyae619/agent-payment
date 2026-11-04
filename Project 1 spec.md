# Project 1 spec: what people ask vs. what protocols enforce

People describe purchases in qualities and conditions ("waterproof, size 8, free returns, ask me if it's over $120"). AP2 and Verifiable Intent can only enforce a short list of hard limits: approved product IDs, stores, amounts, budget, payment method and a time window. Everything else is either stored as text or not captured at all. That gap is what Project 1 designs for.

## What people need to tell a shopping agent

This is a working list of ten things a person may need to say before an agent can search and buy for them. Treat it as a hypothesis: the validation step below checks it against how real people phrase requests.

| # | Dimension | What people actually say | Why it matters |
| --- | --- | --- | --- |
| 1 | **What** (item or category) | "Running shoes", "the same dish soap as last time" | The core of the request; often a category, not a product |
| 2 | **Must-haves** | "Waterproof, size 8, not refurbished" | Most wrong purchases come from a missed detail |
| 3 | **How much** | "Under $120", "no more than $300 total this month" | The one limit almost everyone gives |
| 4 | **Where** | "Only from REI or Amazon", "no unknown sellers" | Protects against fake stores and bad sellers |
| 5 | **When** | "Needs to arrive by Friday", "keep looking for a week", "every month" | Delivery deadline, search window and repeat buys are different things |
| 6 | **Substitutes** | "Any similar brand is fine", "exactly this one or nothing" | Where agents most often overstep |
| 7 | **Check-in rules** | "Ask me if it's over $100", "show me before you pay" | How much autonomy the person is actually giving |
| 8 | **Conditions of sale** | "Free returns only", "4-star sellers or better" | Decides whether a mistake is easy to undo |
| 9 | **Who it's for** | "Ship to my mom's address", "it's a gift" | Delivery and privacy for a third person |
| 10 | **Values and sharing** | "No sponsored picks", "don't share my email" | Whose side the agent is on |

## How AP2 and Verifiable Intent handle it

Only 2 of the 10 are fully enforced: how much and where. Both protocols share one design. When the person is present, they approve the exact cart. When the agent works alone, the person signs an **open mandate** of limits, and the agent signs the final purchase inside them. Merchants check the cart limits, and the card side checks the payment limits.

| # | Dimension | AP2 (v0.2) | Verifiable Intent (v0.1 draft) | Coverage |
| --- | --- | --- | --- | --- |
| 1 | What | `checkout.line_items`: product IDs approved in advance, with quantity | `mandate.checkout.line_items`: same idea; an empty list means *any* product | Partial |
| 2 | Must-haves | Nothing | Brand, color and size are "informational" and not checked; optional free-text `prompt_summary` | Recorded only |
| 3 | How much | `payment.amount_range`, `payment.budget` | `mandate.payment.amount_range`, `mandate.payment.budget` | Enforced |
| 4 | Where | `checkout.allowed_merchants`, `payment.allowed_payees` | Same, as allowlists only; "no unknown sellers" can't be written as a rule | Enforced |
| 5 | When | Mandate expiry (`exp`), `payment.agent_recurrence`, `payment.execution_date`; no delivery deadline | Expiry (24 hours to 30 days when the agent acts alone), recurrence; no delivery deadline | Partial |
| 6 | Substitutes | Only by listing several acceptable products up front | Same, plus `match_mode` ("exact" or "minimum") | Partial |
| 7 | Check-in rules | No rule type; only a choice between approving every cart and full autonomy | Same two modes ("Immediate" and "Autonomous") | Not covered |
| 8 | Conditions of sale | Nothing | Nothing | Not covered |
| 9 | Who it's for | Not a mandate rule; delivery details sit in the merchant's checkout | Same | Not covered |
| 10 | Values and sharing | Selective disclosure limits who sees what; nothing limits sponsored picks | Same | Partial |

**On "compliance":** these are technical protocols, not regulations. Verifiable Intent explicitly leaves out dispute resolution and regulatory mapping (PCI DSS, PSD2). AP2 says mandates can serve as dispute evidence but leaves retention and retrieval out of scope. Following either one doesn't make a product compliant with Reg E, Reg Z or card rules on its own.

## What this means for the prototype

**The translation gap is the real problem.** AP2 says the shopping agent assembles the mandate "after it has determined what task the user wishes it to perform", and how it does that is out of scope. So the agent, the party both specs treat as a possible attacker, writes the limits the person signs. The only human checkpoint is the "Trusted Surface", a screen that must not be AI-driven. Neither spec says what that screen must show for consent to count as informed. That screen is your design space.

**Design the mandate in three parts:**

1. **Hard limits, signed:** product list, stores, price range, budget, payment method, expiry. Use the real AP2 / VI constraint names so the prototype speaks the protocol.
2. **Soft preferences, recorded and checked by your app:** must-haves, conditions of sale, delivery date. Store them next to the mandate, check them after the agent picks, and show pass or fail on the trust receipt ("Waterproof: not confirmed").
3. **Check-in rules, which switch back to the person:** "over $100", "a substitute", "a new store". When one fires, the agent must bring the final cart back for approval instead of signing alone.

**What the consent screen should flag:**

- An empty product list in Verifiable Intent, which means any product.
- Long expiry. Up to 30 days is allowed; a one-off purchase needs about 24 hours.
- Repeat purchases with no total budget.

**A sharper test for your hidden gift-card page:** when the agent acts alone with a tight product list, the protocol itself rejects the gift card, because it isn't an approved item. The attack works when the list is empty, or when the person approves a cart that shows only a total. The weak point is the human screen, not the cryptography, and that's the finding worth demoing.

## How to validate the list this week

A 20-minute exercise you can send to your 8 testers now, before the Nov 2 sessions:

1. Give three scenarios: a household refill (~~$20), a gift for someone else (~~$80), and a bigger purchase (\~$400).
2. Ask each person: "Write exactly what you'd tell an assistant to buy this for you without checking with you again."
3. Code every phrase into the 10 dimensions above. Add a new dimension if a phrase doesn't fit.
4. Count how often each dimension appears, and note which ones show up only for the $400 case.

This gives you real numbers for Post 4, such as how many people set a check-in rule that no protocol can enforce. It also tells you which soft preferences to build first.

## Sources

- [AP2 specification v0.2](https://github.com/google-agentic-commerce/AP2/blob/main/docs/ap2/specification.md): roles, modes, dispute evidence
- [AP2 Checkout Mandate](https://github.com/google-agentic-commerce/AP2/blob/main/docs/ap2/checkout_mandate.md) and [Payment Mandate](https://github.com/google-agentic-commerce/AP2/blob/main/docs/ap2/payment_mandate.md): constraint types
- [Verifiable Intent README](https://github.com/agent-intent/verifiable-intent): modes and layers (v0.1 draft, Feb 2026)
- [Verifiable Intent constraints](https://github.com/agent-intent/verifiable-intent/blob/main/spec/constraints.md) and [credential format](https://github.com/agent-intent/verifiable-intent/blob/main/spec/credential-format.md)
- [Mastercard: Verifiable Intent overview](https://www.mastercard.com/au/en/news-and-trends/stories/2026/verifiable-intent.html)
- [Forbes: Agentic Commerce Has A Consumer Trust Problem](https://www.forbes.com/sites/jordanmckee/2026/10/01/agentic-commerce-has-a-consumer-trust-problem/): approvals that show merchant, item, total and conditions
