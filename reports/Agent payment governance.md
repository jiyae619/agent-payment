# Governance for shopping agents that pay: a critique of the first draft (Nov 4, 2026)

This doc checks seven initial governance ideas against what card networks (Visa, Mastercard, Amex), payment companies (PayPal, Stripe) and the open protocols (AP2, ACP, Verifiable Intent) actually do as of November 2026. It builds on `research_notes/PayPal agentic shopping gap analysis/policy_protocols_liability.md` (Oct 31), so it doesn't repeat what that file already sources. Section 4 answers the same questions from PayPal's seat.

Confidence note: Amex, Stripe and Mastercard details mostly come from trade press, not rulebooks. Items marked *(secondary)* weren't checked against a primary document.

---

## 1. Start with a better question: who enforces each rule?

The first draft is a list of *topics*. Governance is really a list of *rules plus the party that enforces each one*. A rule is only as strong as whoever enforces it.

| Layer | Who | What it can enforce today | Strength |
| --- | --- | --- | --- |
| **Network / issuer** | Visa, Mastercard, Amex, the card issuer | Per-agent token with amount cap, merchant or merchant-category limit, session lifetime, revoke anytime | Hard. The payment is declined. |
| **Wallet / PSP** | PayPal Approval Token, Stripe Shared Payment Token, ACP allowance | Amount, expiry, one merchant, one checkout | Hard, but per purchase only. ACP allows only `one_time`. |
| **Your agent app** | The prototype | Everything else: must-haves, refund terms, check-ins, delivery date, blocked categories | Soft. A bug or a prompt injection can bypass it. |
| **Merchant** | The store (merchant of record) | Refund policy, bot access, price | Not yours to set. You can only choose whether to buy. |
| **Nobody** | — | "No unknown sellers", "no sponsored picks", "agent misread me" | Gap. |

Three things follow from this table:

- **Put every money limit in two places.** Your app checks it, and the payment token carries it. If only your app enforces the budget, one bug overspends.
- **Your draft mixes three audiences.** Budget, sites and consent protect the *shopper*. LLM token limits protect *you, the operator*. Refund policy belongs to the *merchant*. Keep them in separate sections, or the design blurs whose risk each rule controls.
- **PayPal's own test is a good spine.** At an AI Engineer talk (Sept 2026), PayPal framed agent authorization as three questions: *Did the human authorize this? Is it allowed right now, in this scope? Can we prove it later?* ([StartupHub summary](https://www.startuphub.ai/ai-news/artificial-intelligence/2026/paypal-s-agent-authorization-model-explained)). Add two the networks keep circling: **Who pays if it goes wrong?** and **Can it be undone?**

---

## 2. The seven ideas, checked

### 2.1 Which websites to search, and which to block

**What the industry does**
- Hard limits are **allowlists only**. AP2 has `allowed_merchants` and `allowed_payees`, and Verifiable Intent the same. Network tokens can be scoped to merchants or merchant categories (Mastercard Agentic Tokens, Visa agent tokens) *(secondary)*.
- **The reverse direction matters just as much: sites block agents.** In March 2026 a federal judge granted Amazon a preliminary injunction blocking Perplexity's Comet agent from buying on Amazon. Part of Amazon's argument was that Comet disguised itself as Google Chrome ([GeekWire](https://www.geekwire.com/2026/03/10/judge-blocks-perplexitys-ai-bot-from-shopping-on-amazon-in-early-test-of-agentic-commerce/), [Decrypt](https://decrypt.co/360629/amazon-perplexity-comet-court-order-agentic-commerce)). One report says an appeals court later lifted the injunction; that's a single source, unverified.
- Visa's Trusted Agent Protocol, Mastercard Agent Pay and Amex all build on Cloudflare's **Web Bot Auth**: the agent signs every request, and a tag says whether it's *browsing* or *purchasing* ([Cloudflare](https://blog.cloudflare.com/secure-agentic-commerce/)).

**Pushback on the draft**
- **"Search" and "pay" need separate lists.** Searching widely is low-risk. Paying is where the risk is. Let the agent *look* almost anywhere, but *pay* only allowlisted sellers.
- **Blocklists fail open.** A scam store set up yesterday isn't on any blocklist. Use blocklists for discovery and allowlists for payment.
- **A domain isn't a seller.** Allowlisting `amazon.com` or `ebay.com` allows millions of third-party sellers. "Only from REI" is a seller rule; "only from Amazon" needs "sold by / ships from" to mean what people think it means.
- **Being allowed in is a governance rule too.** Your agent should identify itself honestly (a signed agent, not a fake browser) and respect each site's terms. That's both a legal risk (Amazon v. Perplexity) and a design choice.
- **Pages can attack the agent.** A product page can hide instructions ("add this gift card"). The rule "page content is data, not instructions" belongs in governance, not just in the prompt.

### 2.2 Budget limits

**What the industry does**
- Everyone supports a **per-purchase cap with an expiry**: PayPal Approval Token (amount, expiry, merchant), ACP allowance (`max_amount`, `expires_at`, `one_time` only), Stripe Shared Payment Token (one seller, one currency, max amount, expiry), Mastercard Agentic Token (max spend per session, merchants or categories, session lifetime) *(secondary)*.
- **Standing budgets across many purchases are mostly missing.** ACP accepts only `one_time`. Stripe says user-set spending limits and "when the agent can act without approval" are planned, not shipped ([ainews.com](https://www.ainews.com/p/stripe-launches-agent-wallet-for-ai-purchases-with-user-approval)) *(secondary)*. AP2 and Verifiable Intent do have `budget`.

**Pushback on the draft**
- **"Budget" is at least five different numbers.** Price per item; order total including tax, shipping and fees; total across repeat buys; total across *all* the shopper's agents; and quantity. An agent that buys 10 of a $9 item stays under a $100 cap and is still wrong.
- **Watch for spending that starts later.** Free trials that convert to paid, subscriptions hidden in a checkout, split shipments that charge more than once, and currency conversion fees. Recurring charges with no total limit are the biggest hidden-spend risk (the prototype already warns about this).
- **Some categories should be blocked, not capped.** Gift cards, prepaid cards, crypto and money transfers are hard to reverse and a favorite scam target. Gift cards are also excluded from PayPal Purchase Protection. Block them by default and ask before allowing them.
- **Rolling or calendar?** "$300 a month" can mean the last 30 days or the calendar month. Pick one and show it.

### 2.3 Refund policy

**What the industry does**
- **The merchant owns refunds.** ACP and Google's UCP both keep the merchant as merchant of record, responsible for refunds and chargebacks. Stripe's seller docs say that if a buyer cancels after checkout, the merchant issues the refund ([Stripe](https://docs.stripe.com/agentic-commerce/for-sellers/refunds-and-disputes)).
- **No protocol says who starts a return**, the shopper or the agent ([Pipe17](https://pipe17.com/blog/returns-in-agentic-commerce/)).
- **Amex is the only network that covers agent mistakes.** Amex Agent Purchase Protection (Apr 14, 2026) credits the cardmember when "the agent has made the error," not the merchant or the shopper. It only applies when the agent is registered through Amex's ACE kit, the cardmember enrolled in it, and the agent passed along the shopper's intent ([Digital Commerce 360](https://www.digitalcommerce360.com/2026/04/14/american-express-agentic-commerce-developer-kit-purchase-protection/)). No dollar caps or claim process have been published.
- **PayPal doesn't cover it.** PayPal Purchase Protection excludes items that were "properly described but you didn't want it." And under the User Agreement, if someone you authorized exceeds that authority, you're responsible (see the Oct 31 notes).

**Pushback on the draft**
- **You can't set a refund policy. You can set refund *conditions*.** Governance means: (a) check refundability *before* buying, and if the item is final-sale, ask the shopper first; (b) decide what the agent may do afterward (start a return? cancel within the window?); (c) refunds only ever go back to the original payment method.
- **Four different things get called "refund":** the merchant's refund (their policy), a chargeback (card network rules), buyer protection (PayPal: seller failures only), and agent-error protection (Amex only). *"The agent picked the wrong item"* falls through PayPal's coverage. That's the most important gap in this whole space, and it's the one a signed intent record could close.
- **Returns cost money.** Restocking fees and return shipping come out of the shopper's pocket. A "free returns" condition is worth more than a slightly lower price.
- **Evidence is what makes a refund winnable.** Amex will only pay out with a recorded intent. The networks can only reverse a payment if someone can show what was asked versus what was bought. See 3.2.

### 2.4 Limit tokens

**Ambiguity first: which tokens?** It could mean two things, and both matter.

**(a) LLM tokens (compute cost).** No payment company regulates this. It's operator cost control, not payment governance. A better rule than a raw token cap:
- **Cap cost per task relative to purchase value.** Checking a $20 item daily for 30 days with a model is wasteful. Also cap steps, tool calls and runtime per task. The real risk is a runaway loop, not one long reply.
- **Don't use the model for price checks.** Comparing today's price to a threshold is a job for plain code. Wake the model only when a candidate actually appears.

**(b) Payment tokens (credentials).** This one *is* payment governance:
- The agent never sees a card number. It uses a scoped network or agent token: one per agent, revocable without reissuing the card (Mastercard *(secondary)*). Visa rules reportedly require network tokens for agent stored-credential payments from April 2026 *(secondary, unverified)*.
- The model can never change its own limits. In the prototype, `vault_id` is set by the app, never by the model. That's the right pattern; generalize it to every hard limit.

### 2.5 Timeline: how long to search, how often to check prices

**What the industry does**
- Every scheme has an expiry: AP2 `exp`, ACP `expires_at`, Mastercard session lifetime. Verifiable Intent allows 24 hours to 30 days for an agent acting alone. Long windows are allowed, not recommended.

**Pushback on the draft**
- **"Timeline" is four things:** the search window (*keep looking until Friday*), the delivery deadline (*must arrive by the 20th*), the buy trigger (*buy when it drops under $90*), and how often to check. Each needs its own field. The prototype has the first two.
- **"Daily" is arbitrary.** Match the cadence to how fast prices move and how much is at stake. Electronics around a sale event move hourly; dish soap barely moves.
- **Frequent checks collide with merchant rules.** Repeated scraping can break terms of service and rate limits. Use product feeds and catalog APIs (the prototype uses Channel3), and identify the agent when visiting a site.
- **Be skeptical of price drops.** A "drop" can be personalized pricing, a fake "was" price, or a different seller or variant on the same listing. Compare the same product ID from the same seller.
- **Decide what happens at expiry.** The default should be *do nothing and tell the shopper*, never *buy the best thing found*. And if the price moved since the shopper approved, ask again.
- **A creative angle:** some retailers refund the difference if the price drops soon after purchase. Watching *after* purchase and claiming that adjustment is a strong use of monitoring.

### 2.6 Creative, flexible suggestions

**What the industry does**
- Hard limits allow almost no flexibility. Verifiable Intent has `match_mode` ("exact" or "minimum"); AP2 only allows listing several products up front. The project spec found that substitutes are where agents most often overstep.

**Pushback on the draft**
- **Flexibility and enforceability pull in opposite directions.** The fix: the agent may *suggest* anything, but it may only *buy* what was approved. A creative option always goes back to the shopper, never gets paid for under the original approval.
- **Ask whose interests the suggestion serves.** If the agent earns affiliate fees or shows sponsored placements, its "creative" picks are suspect. Amex says it may use agent enrollment to send personalized offers. Governance needs a rule: disclose paid placements, or exclude them.
- **"Wait" and "don't buy" are valid options.** A good agent sometimes recommends buying refurbished, waiting for a sale, or using something the shopper already owns.

### 2.7 Consent and approvals from people

**What the industry does**
- **Two modes everywhere:** the shopper is present and approves the exact cart, or the shopper signs limits in advance and the agent acts alone (AP2, Verifiable Intent, Mastercard). Mastercard lets shoppers require the agent to check back before completing a purchase *(secondary)*.
- **How consent gets proven:** passkey-style approval (PayPal), an issuer-signed consent record (Visa TAP), logged enrollment plus "certified intent" (Amex), and Verifiable Intent (Mastercard).
- **Amex's line is clear:** "If there's no directive, there is no authorization to purchase."

**Pushback on the draft**
- **Too many prompts is as bad as none.** If every purchase asks, people tap "approve" without reading. Use *risk-based* check-ins: over an amount, a new store, a substitute, final-sale items, recurring charges, gift cards, a new shipping address. The prototype has the first three.
- **Consent has to be informed, not just collected.** The approval screen must show the merchant, the item, the total *including* tax and shipping, refund terms, whether it recurs, when the permission expires, and what the agent can do without asking. No spec defines this today. That's the design space.
- **The agent writes the rules the shopper signs.** That's a conflict of interest built into AP2. The readback ("You said → What it will do") is the safeguard. Keep it AI-free.
- **Approval is a person, not a click.** The model must never press "approve." Use an out-of-band channel (push notification plus passkey). If there's no answer before the timeout, the answer is no.
- **Consent needs an off switch.** The shopper should see every active permission and revoke any of them in one tap. Mastercard lets a token be cut off without replacing the card *(secondary)*.
- **More than one person can be involved.** Gifts, shipping to someone else, shared household accounts: who agreed to what?

---

## 3. Criteria the draft is missing

1. **Agent identity ("know your agent").** Is the agent registered (Amex ACE, Visa TAP, Mastercard), and does it identify itself honestly to sites? Amex protection depends on registration.
2. **Evidence and audit trail.** PayPal's third question: *can we prove it later?* Keep the shopper's words, the signed limits, the cart, the reason for each decision, and the approval. Visa reportedly requires a "defensible chain of authorization" and record-keeping ([Goodwin](https://www.goodwinlaw.com/en/insights/publications/2026/06/insights-technology-aiml-authorizing-agentic-payments)). Without this, every dispute is your word against theirs.
3. **Who pays for which failure.** Write it down per failure: the merchant sent the wrong thing (merchant refund, buyer protection), the agent misread the shopper (Amex covers it, PayPal doesn't), the agent was hijacked (fraud rules, but under Reg E a payment is presumed authorized if the shopper handed credentials to the agent). This is where the industry is weakest, and where a good design adds the most.
4. **Security against the agent itself.** Prompt injection from pages, card details kept away from the model, and no path for the model to raise its own limits.
5. **Privacy and data sharing.** What the agent tells merchants, a third person's address on a gift, and offers built from enrollment data.
6. **Restricted categories.** Gift cards, prepaid, crypto, money transfer, gambling, age-restricted and regulated goods. Default to blocked.
7. **Velocity and duplicates.** Limit purchases per day, catch the same item bought twice, and make retries safe so a timeout doesn't charge twice.
8. **Safe defaults when unsure.** Ambiguous? Ask. Expired? Stop. Error? Don't retry blindly. Every default should fail toward "don't spend."
9. **Where the shopper lives.** The US has no agent-specific guidance (no CFPB or FTC statement found). EU rules require strong authentication at payment time, which practitioners say clashes with limits set in advance. The UK is consulting on how to split responsibility among payer, provider and agent supplier (closed Oct 6, 2026).

---

## 4. From PayPal's seat

### 4.1 PayPal isn't just a gateway

In agent payments, PayPal plays five roles at once:

| Role | What it does | Governance it owns |
| --- | --- | --- |
| **Shopper's wallet** | Holds funding sources, shows the approval screen | Authentication, consent, Purchase Protection |
| **Merchant's processor** | Onboards and vets merchants (Agent Ready) | Seller Protection, merchant eligibility |
| **Agent's credential provider** | Issues the Approval Token (amount, expiry, merchant) | What an agent is allowed to spend |
| **Catalog distributor** | Store Sync pushes merchant catalogs to AI assistants | What agents find, and how neutral that is |
| **Dispute judge** | The Resolution Center decides PayPal-funded claims | Who pays |

**The advantage:** PayPal is the only party that sees the approval, the merchant, the payment *and* the dispute, and it holds a contract with both the shopper and the merchant. Networks don't have a direct contract with the shopper. Agents never see disputes. Merchants only see their own orders.

### 4.2 The five questions

**1. Did the human authorize this?**
- Confirm the *person*, not the agent's session: a passkey on PayPal's own screen, never a button inside the agent's chat.
- Know *which agent* is asking. Amex and Visa register agents. The PayPal Approval Token is reportedly an opaque string only PayPal can check, and it doesn't say which agent.
- **Contract gap:** the User Agreement doesn't define an agent. An agent counts as "someone you gave your login to," and if it oversteps, the user is responsible. PayPal needs contract language for an agent and the limits it acts under.

**2. Is it allowed right now?**
- Check the limits when the payment is approved: amount, merchant, expiry, blocked categories (gift cards), purchases per day.
- **PayPal is the natural home for a budget that spans stores.** No single merchant can enforce "$300 a month across every store and every agent." ACP tokens cover one purchase, and an issuer sees one card. PayPal sees all of them.
- **Revocation already has a model.** PayPal has a page for managing automatic payments. Extend it to "agents that can spend for you," with a one-tap off switch.

**3. Can we prove it later?**
- Today PayPal sees *amount, merchant and expiry*, but not *what the person asked for*. So it can't tell "the merchant sent the wrong thing" apart from "the agent picked the wrong thing."
- Amex solved this by requiring the agent to pass the purchase intent, with the cart optional. PayPal could require the same from any agent that wants its protection.
- **Privacy tension:** a record of what people asked for is sensitive. Set a retention limit, and let both buyer and seller see the record in a dispute.

**4. Who pays if it goes wrong?**

| What went wrong | Who pays today on PayPal |
| --- | --- |
| Merchant sent a wrong or broken item | Merchant, through Purchase Protection |
| Agent misread the shopper | **The shopper.** Purchase Protection excludes items "properly described but you didn't want it" |
| Agent hijacked or overstepped | **The shopper**, because they gave the agent access |
| Merchant shipped exactly what the agent ordered, and the shopper disputes it | Unclear, so the merchant risks losing |

PayPal's options:
- **Follow Amex:** cover agent mistakes, only for registered agents that pass intent.
- **Push the cost to agent developers** through developer terms.
- **Keep the status quo**, and look weaker than Amex.

**Questions 3 and 4 are linked.** Covering agent mistakes is only affordable with evidence. Without it, every case of buyer's remorse becomes "the agent did it."

**5. Can it be undone?**
- PayPal can't overrule a merchant's refund policy, but it controls payment timing. Merchants can choose to *authorize* a payment now and *capture* the money later. For agent orders, a short gap before capture gives the person a window to cancel. The tradeoff: merchants ship later, and they won't like that.
- Refunds go back to the original funding source only.
- Warn before buying something that can't be undone.

### 4.3 Can PayPal tell people the merchant's refund policy?

Partly. It can't *set* the policy, but it can *require it to be disclosed*.

**The data already exists:**
- Search results quoting PayPal's Store Sync docs show catalog fields for `return_policy` (a URL), `seller_tos` and `seller_privacy_policy` ([Store Sync overview](https://developer.paypal.com/store-sync/overview)). The field reference page returned 404 when fetched on Nov 4, so the exact details are unconfirmed.
- OpenAI's catalog spec reportedly requires a return-policy URL plus a return window in days ([commercetools](https://docs.commercetools.com/agentic-commerce/ai-hub/openai/fulfillment-and-returns)). One integrator says the days field was renamed in July 2026 ([Lengow](https://help.lengow.com/hc/en-us/articles/29189381878812--ChatGPT-News-Structure-udpate-07-27-2026)).

**Five problems with "just show the policy":**
1. **A link isn't a term.** Details like "30 days, you pay return shipping, 15% restocking fee, electronics final sale" live in prose on a web page. If an AI summarizes it and gets it wrong, PayPal's screen has made a promise the merchant never did. Show structured terms where the merchant supplies them. Otherwise quote and link, labeled "per [merchant]'s policy." Never paraphrase.
2. **Store policies miss item exceptions.** Clearance, opened software and custom items are often final sale. PayPal needs a final-sale flag on each item, not just a storewide policy.
3. **Coverage is partial.** It only works for merchants in Store Sync or a catalog feed. If an agent buys through a browser elsewhere, PayPal sees only merchant and amount. Even then, "This store didn't share return terms" is useful information.
4. **Autonomous purchases have no screen.** When the shopper isn't there, disclosure becomes a rule set in advance ("only buy if returnable"), and PayPal can enforce that only with structured data.
5. **Policies change.** Save a copy of the terms as they stood at purchase in the evidence record (question 3). It also helps disputes: "On Nov 4 the policy said 30 days."

**PayPal's lever:** it has the merchant contract, so it could make structured return terms a condition of Agent Ready or Store Sync eligibility.

**The disclosure PayPal fully controls is its own coverage:** "If the agent picks the wrong item, PayPal Purchase Protection doesn't cover it." It's the most uncomfortable line on the screen, and the most honest. It's the same line as suggestion 3 below.

---

## 5. What to take into the prototype

The prototype already covers the strongest parts: hard limits with protocol field names, soft preferences checked by the app, check-ins for amount, substitutes and new stores, plus warnings for any product, long expiry and recurring purchases with no total.

Ranked by how much each adds to the demo, cheapest first. **These are suggestions, not decisions:**

1. **New check-in: final-sale / non-refundable item.** It directly targets the PayPal coverage gap in 2.3.
2. **Block gift cards and prepaid cards by default.** It strengthens the hidden gift-card attack demo.
3. **A "who covers this?" line on the receipt.** *Merchant error: PayPal Purchase Protection. Agent picked the wrong item: not covered; here's your signed record.* It makes the liability gap visible.
4. **Show the expiry default as "do nothing and tell me."**
5. **Leave out:** price monitoring, LLM cost caps, multi-agent budgets. Real issues, but not demoable in the time left.

---

## Sources

New in this doc (others are in the Oct 31 notes):
- [Digital Commerce 360: Amex ACE kit and Agent Purchase Protection, Apr 14, 2026](https://www.digitalcommerce360.com/2026/04/14/american-express-agentic-commerce-developer-kit-purchase-protection/)
- [StartupHub: PayPal's agent authorization model (AI Engineer talk), Sept 1, 2026](https://www.startuphub.ai/ai-news/artificial-intelligence/2026/paypal-s-agent-authorization-model-explained)
- [Cloudflare: securing agentic commerce with Visa and Mastercard](https://blog.cloudflare.com/secure-agentic-commerce/)
- [GeekWire: judge blocks Perplexity's agent on Amazon, Mar 10, 2026](https://www.geekwire.com/2026/03/10/judge-blocks-perplexitys-ai-bot-from-shopping-on-amazon-in-early-test-of-agentic-commerce/) and [Decrypt](https://decrypt.co/360629/amazon-perplexity-comet-court-order-agentic-commerce)
- [Stripe: handle refunds and disputes (agentic commerce, sellers)](https://docs.stripe.com/agentic-commerce/for-sellers/refunds-and-disputes)
- [Pipe17: returns in agentic commerce](https://pipe17.com/blog/returns-in-agentic-commerce/)
- [ainews.com: Stripe agent wallet with user approval](https://www.ainews.com/p/stripe-launches-agent-wallet-for-ai-purchases-with-user-approval) *(secondary)*
- [PaymentsJournal: Mastercard Agent Pay](https://www.paymentsjournal.com/mastercard-takes-ai-shopping-from-search-to-checkout/) *(secondary)*
- [Goodwin: Authorizing Agentic Payments, Jun 11, 2026](https://www.goodwinlaw.com/en/insights/publications/2026/06/insights-technology-aiml-authorizing-agentic-payments)
- [PayPal Store Sync overview](https://developer.paypal.com/store-sync/overview) and [BigCommerce: PayPal Store Sync](https://www.bigcommerce.com/blog/paypal-store-sync/)
- [commercetools: OpenAI fulfillment and returns mapping](https://docs.commercetools.com/agentic-commerce/ai-hub/openai/fulfillment-and-returns)
- [Lengow: ChatGPT feed structure update, Jul 27, 2026](https://help.lengow.com/hc/en-us/articles/29189381878812--ChatGPT-News-Structure-udpate-07-27-2026)
- [Digital Commerce 360: PayPal agentic commerce services, Oct 28, 2025](https://www.digitalcommerce360.com/2025/10/28/paypal-agentic-commerce-ai-driven-shopping-services/)
