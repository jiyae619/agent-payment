# PayPal Policies and the Protocol/Liability Framework for Agent-Initiated Purchases (as of Oct 31, 2026)

Method note: PayPal's US User Agreement and US Purchase Protection pages were downloaded directly on 2026-10-31 and searched with keyword greps ("agent", "AI", "automated", "on your behalf", "Unauthorized Transaction", "Significantly Not as Described", "reference transaction"). Quotes from those pages below are verbatim. Everything else comes from web search and page fetches. Vendor and blog claims are labeled as such.

## 1. Do PayPal's User Agreement, Purchase Protection, Seller Protection or AUP mention AI agents or delegated purchases?

### Takeaway
No. The current US User Agreement (last updated Sept 14, 2026) and the US Purchase Protection program terms (last updated Jan 26, 2026) contain no clause about AI agents, automated agents or agent-initiated purchases. The only AI wording in the User Agreement is an arbitration rule about AI-generated filings. Agent purchases therefore fall under the general rules for granting someone else authority over an account, and those rules put the risk on the user.

### Cited Findings
- **US User Agreement, "Last updated on September 14, 2026."** Its only AI-specific text is in the arbitration section: "Any submission containing AI-generated content must include a certification by the party... that they have personally verified the content's accuracy." That rule is about court filings, not payments. — [PayPal US User Agreement](https://www.paypal.com/us/legalhub/paypal/useragreement-full)
- In the US User Agreement, "agent" appears only in unrelated senses: PayPal as "your agent and custodian" for FDIC Program Banks, "event ticketing agents or online travel agents" as sellers, and "employees, agents" in the restricted-activities list. "Automated" appears only for ATMs and for PayPal crawling merchant websites ("PayPal may use automated technologies (e.g., website crawling) to assess your website"). — [PayPal US User Agreement](https://www.paypal.com/us/legalhub/paypal/useragreement-full)
- **The clause that matters most for agents is the definition of Unauthorized Transaction:** "An 'Unauthorized Transaction' occurs when money is sent from your PayPal account that you did not authorize and that did not benefit you." The agreement then lists what is not unauthorized: "If you grant authority to someone to use your PayPal account (by giving them your login information) and they exceed the authority you gave them. You are responsible for transactions made in this situation unless you have previously notified PayPal that you no longer authorize transfers by that individual." — [PayPal US User Agreement, Liability for Unauthorized Transactions](https://www.paypal.com/us/legalhub/paypal/useragreement-full)
- The section on what is not an "Error" says the same: "If you give someone access to your PayPal account (by giving them your login information) and they use your PayPal account without your knowledge or permission. You are responsible for transactions made in this situation." — [PayPal US User Agreement](https://www.paypal.com/us/legalhub/paypal/useragreement-full)
- **Preauthorized payments are the closest existing construct to delegated spending.** PayPal names "billing agreement," "subscription," "recurring payment," "reference transaction," "preauthorized transfer," and "preapproved payment." Sellers must "Get each buyer's prior authorization for the amount, frequency, and duration of any such payment," and personal-account users may cancel "3 Business Days or more before the date of the next scheduled payment." — [PayPal US User Agreement](https://www.paypal.com/us/legalhub/paypal/useragreement-full)
- **US Purchase Protection, "Last updated on January 26, 2026."** It covers "Item Not Received" claims and "Significantly Not as Described" claims, and sends unauthorized claims to a separate track: "If you believe that a transaction made through your PayPal account was not authorized by you, this type of claim is different from the Purchase Protection program." It contains no agent language. — [PayPal US Purchase Protection Program](https://www.paypal.com/us/legalhub/paypal/buyer-protection)
- Seller Protection terms are embedded in the User Agreement. They cover unauthorized-transaction and item-not-received claims. Eligibility is in "PayPal['s] sole discretion," and there is no agent language. — [PayPal US User Agreement](https://www.paypal.com/us/legalhub/paypal/useragreement-full); [PayPal Seller Protection page (RO locale, updated 17 July 2025)](https://www.paypal.com/ro/webapps/mpp/ua/seller-protection)
- **Other regions and changes in 2025–2026:** The Italy User Agreement was "Last updated on 7 September 2026," and the Australia agreement is version 26-1 (dated around June 10, 2026). Search snippets for both show no agent language, but I could not extract their full text. ConductAtlas logged a July 14, 2026 change to the US agreement as formatting only. — [Italy UA PDF](https://www.paypalobjects.com/marketing/ua/OA/useragreement-full/en-IT-090726.pdf); [Australia UA PDF](https://www.paypalobjects.com/marketing/ua/OA/useragreement-full/en-AU-061026.pdf); [ConductAtlas (third-party tracker)](https://conductatlas.com/change/2026-07-14-paypal-paypal-user-agreement-3669/)
- PayPal's agent-related protection promises appear in press releases, not in the legal terms. The Oct 28, 2025 release says Agent Ready provides "fraud detection, buyer protection, and dispute resolution" at no extra work for merchants, and that merchants "remain the merchant of record." — [PayPal Newsroom, Oct 28, 2025](https://newsroom.paypal-corp.com/2025-10-28-PayPal-Launches-Agentic-Commerce-Services-to-Power-AI-Driven-Shopping)
- A third-party site, unverified, says PayPal announced support for Meta's "Muse" agent on Sept 23, 2026 and applies existing protections rather than new agent-specific rules. — [bankingnewsai.com (secondary)](https://www.bankingnewsai.com/fintech/paypal/agentic-commerce)

### Inferences
- Under the plain text, an agent holding the user's PayPal credentials or an approved session is "someone" the user granted authority to. If the agent goes beyond its instructions, the user is "responsible," and the transaction is neither an Unauthorized Transaction nor an Error. Users would therefore have to rely on Purchase Protection, which covers only seller-side failures, or on PayPal's discretion.
- Agent protection exists today in marketing, through press releases and Agent Ready, but not in the contract. That is the core policy gap.
- The preauthorized-payment rules, which require prior authorization for "amount, frequency, and duration," are the clause that could most readily be extended to agent mandates.

### Gaps
- I could not find a PayPal Help Center FAQ that specifically covers agent or ChatGPT/Perplexity purchases.
- I could not verify the full Acceptable Use Policy text for agent or bot language. It was not fetched.
- I did not check the full EU/UK user agreements for agent clauses. Only snippets were seen.

## 2. How does Purchase Protection apply when an agent buys the wrong item ("not as described" vs "unauthorized")?

### Takeaway
By PayPal's own definitions, an agent choosing the wrong but accurately described item is neither a valid Significantly Not as Described claim nor an Unauthorized Transaction. It falls through both. PayPal has published no guidance on this.

### Cited Findings
- The SNAD definition covers seller-side defects only: "The item is materially different from the seller's description of it. You received a completely different item. The condition of the item was misrepresented..." and also missing parts, short quantity, shipping damage, and undisclosed unusable items. — [PayPal US Purchase Protection (Jan 26, 2026)](https://www.paypal.com/us/legalhub/paypal/buyer-protection)
- The explicit exclusions: "An item may not be considered Significantly Not as Described if: ... The item was properly described but you didn't want it after you received it. The item was properly described but did not meet your expectations." — [PayPal US Purchase Protection](https://www.paypal.com/us/legalhub/paypal/buyer-protection)
- An excess-authority claim is not "unauthorized" (see Section 1). — [PayPal US User Agreement](https://www.paypal.com/us/legalhub/paypal/useragreement-full)
- Purchase Protection also excludes "Payments that you initiate via a third-party platform using either the account and routing number assigned to your PayPal Balance account... or... business account," along with gift cards, custom items for SNAD claims, and other categories. — [PayPal US Purchase Protection](https://www.paypal.com/us/legalhub/paypal/buyer-protection)
- The card-world analogy from vendor commentary: a wrong agent purchase can arrive as fraud (Visa 10.4 or Mastercard 4837) or as not-as-described (Visa 13.3 or Mastercard 4853). In Chargeflow's words, "Reason codes describe the cardholder's claim, not the agent's role." The merchant bears the loss unless it can show the order matched the mandate and the listing. — [Chargeflow, Jul 2026, updated Oct 2026 (vendor)](https://www.chargeflow.io/blog/ai-agent-chargeback-liability)

### Inferences
- The case of "agent misread my intent" falls squarely under "properly described but you didn't want it," so it is excluded. A buyer could still file a SNAD claim, and the outcome would depend on PayPal's discretion. This is a concrete gap a product could fill, for example with a signed intent or mandate record compared against the cart.

### Gaps
- PayPal has published no rulings, FAQs or case examples on agent-error disputes.

## 3. PayPal and AP2: what did PayPal commit to, and has any of it shipped?

### Takeaway
The PayPal developer blog post of Sept 16, 2025 framed nearly every item as an opportunity or pilot, with conditional verbs and no dates. These included putting mandates in Seller Protection and dispute pipelines, carrying Payment Mandates through authorization, and sending issuer signals. I found no evidence that any of it has shipped as a production policy or product by Oct 31, 2026.

### Cited Findings
- Source: Prakhar Mehrotra, "Agent Payments Protocol: Building Verifiable Trust for Agentic Commerce," PayPal Developer Community Blog, Sept 16, 2025 (vendor blog). — [PayPal Developer Blog](https://developer.paypal.com/community/blog/PayPal-Agent-Payments-Protocol/)
  - On disputes: "Incorporating Cart, Intent, and Payment mandates into these pipelines could add..." The post lists "Extending Seller Protection workflows with Cart and Intent Mandates" as an opportunity.
  - On authorization: "Embedding Payment Mandate credentials in authorization flows so issuers and networks see agent presence and modality." This is framed as a pilot to "validate approval lift, step-up accuracy, and ecosystem readiness."
  - On issuer signals: "issuers and networks can receive agent-presence context without requiring changes to existing systems" (conditional).
  - On sequencing: "start with human-present flows, then extend to human-not-present and new rails."
  - The firmest statements are "PayPal is committed to supporting AP2" and "PayPal is leading an effort with participating companies to extend AP2."
- AP2 maturity: at launch, "consumers cannot use AP2-based payments today in any publicly known, real-world product" (VentureBeat). V0.1 covered pull payments and human-present flows, with push payments, recurring payments and human-not-present flows deferred. A secondary source reports that the SDK reached v0.2.0 in April 2026. — [VentureBeat](https://venturebeat.com/ai/googles-new-agent-payments-protocol-ap2-allows-ai-agents-to-complete); [codercops blog (secondary)](https://blog.codercops.com/blog/ap2-x402-ai-agent-payments-explained-2026)
- The Purchase Protection terms (Jan 2026) and the User Agreement (Sept 2026) contain no reference to mandates, AP2 or Intent/Cart Mandates. — [Purchase Protection](https://www.paypal.com/us/legalhub/paypal/buyer-protection); [User Agreement](https://www.paypal.com/us/legalhub/paypal/useragreement-full)

### Inferences
- If mandates had been formally added to Seller Protection evidence rules, the legal terms would most likely show it. They do not. Any mandate use is therefore internal or pilot-stage at most.

### Gaps
- I could not confirm the status of any PayPal AP2 pilot or production launch. I did not fetch ap2-protocol.org or the GitHub repo for adopter lists.

## 4. PayPal and OpenAI's ACP / Delegated Payment spec: what role does PayPal play, and what consent constructs exist?

### Takeaway
PayPal adopted ACP (announced Oct 28, 2025) so ChatGPT users can pay with the PayPal wallet in Instant Checkout, with launch slated for 2026, and so PayPal merchants can be routed into ChatGPT. On the consent side, the ACP Delegated Payment spec's "allowance" defines a single-use token capped by `max_amount`, bound to one merchant and one checkout session, and limited by `expires_at`. The official spec names Stripe, not PayPal, as the first compatible PSP implementation.

### Cited Findings
- Delegated Payment spec allowance fields: `reason` (only `one_time`), `max_amount` (the maximum chargeable amount), `currency` (ISO-4217), `checkout_session_id`, `merchant_id`, and `expires_at` (RFC 3339). The token is single-use and "restricted by the delegated payment's max amount and expiry." `risk_signals` is required and has the form type/score/action (`blocked`, `manual_review`, `authorized`). The API-Version header is `2025-09-29`. — [OpenAI Delegated Payment Spec](https://developers.openai.com/commerce/specs/payment.md)
- Liability posture in the spec: OpenAI is not the merchant of record. The merchant and its PSP handle settlement, refunds, chargebacks and compliance. Direct integration is limited to PSPs and PCI DSS Level 1 merchants with their own vaults. Stripe's Shared Payment Token is described as the first compatible implementation. PayPal is not mentioned. — [OpenAI Delegated Payment Spec](https://developers.openai.com/commerce/specs/payment.md)
- Adyen's documentation confirms the token "cannot be used after" `expires_at` and is bound to `allowance.merchant_id` and `checkout_session_id`. — [Adyen ACP Delegated Payment docs](https://docs.adyen.com/online-payments/agentic-commerce/delegated-payment-spec)
- PayPal–OpenAI: PayPal adopts ACP so ChatGPT users can check out with PayPal, starting in 2026. PayPal wallet payments carry buyer and seller protection plus dispute resolution. Funding can come from bank, balance or cards, with cards through a separate API. PayPal handles merchant routing, so merchants do not need their own integration. These details come from press coverage. — [ConsumerAffairs](https://www.consumeraffairs.com/news/paypal-links-up-with-chatgpt-to-provide-instant-checkout-102825.html); [heise](https://www.heise.de/en/news/ChatGPT-OpenAI-integrates-PayPal-as-a-payment-method-10961770.html); [Open Source For You](https://www.opensourceforu.com/2025/11/paypal-adopts-openais-agentic-commerce-protocol-for-chatgpt-shopping/)
- A secondary source says PayPal supports both ACP and Google's UCP in 2026. — [eco.com (vendor)](https://eco.com/support/en/articles/14845478-acp-agentic-commerce-protocol-explained)

### Inferences
- ACP consent amounts to a per-checkout cap plus a time limit. There are no standing multi-purchase budgets (`reason` accepts only `one_time`) and no captured intent semantics comparable to AP2's Intent Mandate. That makes it weak evidence in "agent picked the wrong thing" disputes, because the cap proves the price was approved but not that the item was.
- The protection on PayPal wallet payments through ChatGPT is ordinary PayPal Purchase Protection, which carries the SNAD exclusions described in Section 2.

### Gaps
- I could not confirm whether PayPal Instant Checkout in ChatGPT is live as of Oct 2026, or whether PayPal acts as a delegated-payment PSP (vault) or as a wallet button. Sources were 2025 announcements.

## 5. Card network rules: Visa Intelligent Commerce / TAP and Mastercard Agent Pay

### Takeaway
Visa's rules, effective around April 2026 per secondary sources, expressly address agentic transactions. They require registration, network tokens and a "defensible chain of authorization." Mastercard relies on Agent Pay, Agentic Tokens and "Know Your Agent," and its public processing rules reportedly say nothing about agents. Neither network has published a dispute-liability allocation specific to agents. PayPal is a Mastercard Agent Pay partner (Oct 27, 2025). I found no evidence that it is a named Visa TAP partner.

### Cited Findings
- Visa requires agentic providers to register, maintain a "defensible chain of authorization," enforce controls that match the delegation scope, and keep transaction records. Compliance shields against network fines but not against customer claims. — [Goodwin, "Authorizing Agentic Payments," Jun 11, 2026](https://www.goodwinlaw.com/en/insights/publications/2026/06/insights-technology-aiml-authorizing-agentic-payments)
- Visa rules effective Apr 18, 2026 reportedly require agentic stored-credential transactions to use a Visa network token or one from a registered Agentic Payment Enabler. Mastercard reportedly accepts only Agentic Tokens issued to agents verified through Know Your Agent. Neither claim was verified against the rulebooks. — [patronusec (secondary)](https://patronusec.com/en/agentic-payments-merchant-compliance-guidelines/)
- A May 2026 FBT Gibbons analysis, as cited by Chargeflow, says Visa's rules "expressly address agentic transactions" and that Mastercard's public Transaction Processing Rules "stay silent," deferring to Agent Pay. No card rule makes the agent platform liable. "The merchant carries the loss unless it wins the dispute or authentication moves fraud liability to the issuer." — [Chargeflow (vendor)](https://www.chargeflow.io/blog/ai-agent-chargeback-liability)
- Consent models: Mastercard Agentic Tokens are tied to a specific agent and consent policy set at provisioning. Visa TAP uses a Verified Agent ID, signed HTTP attestations and an issuer-signed consent record. On liability, one vendor says Mastercard follows standard token rules, with the issuer liable when a token is validly issued. Another says neither network has published a guarantee and that Amex has the clearest commitment, its Agent Purchase Protection. These sources conflict. — [eco.com (vendor)](https://eco.com/support/en/articles/15192003-mastercard-agent-pay-vs-visa-trusted-agent-2026-compared); [CoinGecko (secondary)](https://www.coingecko.com/learn/top-agent-cards-ai-payments)
- PayPal–Mastercard (Oct 27, 2025): Agent Pay is being integrated into the PayPal wallet, and PayPal will pilot the Mastercard Agent Pay Acceptance Framework. Mastercard "will enable cardholders to access their credentials securely via PayPal checkout." — [PayPal Newsroom](https://newsroom.paypal-corp.com/2025-10-27-Mastercard-and-PayPal-Join-Forces-To-Accelerate-Secure-Global-Agentic-Commerce); [Mastercard press](https://www.mastercard.com/us/en/news-and-trends/press/2025/october/Mastercard-and-PayPal-join-forces.html)
- Named Visa TAP partners in search results were Fiserv, Nuvei, Shopify and Stripe. PayPal was not listed. — [Crowdfund Insider (Nuvei)](https://www.crowdfundinsider.com/?p=254697); [Fiserv](https://investors.fiserv.com/node/51796/pdf)

### Inferences
- Network rules spell out how an agent proves identity and consent, but they leave the question of who absorbs an agent's error to existing reason codes. In practice that means the merchant pays.

### Gaps
- I could not access Visa's Core Rules or Mastercard's Agent Pay documentation directly. All rule details are secondhand.
- I could not confirm whether PayPal joined Visa TAP or Visa Intelligent Commerce in 2026.

## 6. Regulatory view: Reg E / Reg Z, CFPB / FTC, EU PSD3/PSR and AI Act, UK

### Takeaway
No US regulator has issued agent-specific payments guidance as of Oct 2026. Law firms read Reg E and Reg Z as treating credential-sharing with an agent as authorization, which favors institutions. The EU PSD3/PSR texts were agreed in April 2026 but have no agent-specific provisions in the sources found. The UK opened the most explicit consultation (HM Treasury, July 2026).

### Cited Findings
- **Reg E:** a transfer is presumed authorized if the consumer gave credentials to an agent, "even if the agent acts outside the scope." **Reg Z:** authority can be actual, implied or apparent, which arguably covers agents that exceed their scope. The Reg Z dispute right for goods "not accepted by the consumer or... not delivered as agreed" in practice shifts losses to merchants and could be used as "buyer's remorse" chargebacks. Goodwin mentions no CFPB or FTC statements. — [Goodwin, Jun 11, 2026](https://www.goodwinlaw.com/en/insights/publications/2026/06/insights-technology-aiml-authorizing-agentic-payments)
- Whether granting an agent credentials satisfies Reg E authorization is "currently unresolved." — [Fenwick, "Is 2026 the Year of Agentic Payments?"](https://www.fenwick.com/insights/publications/is-2026-the-year-of-agentic-payments)
- The think tank ITIF/Center for Data Innovation (Mar 2026) urged the CFPB to clarify that consumer-authorized agents do not waive all error-resolution rights. — [Center for Data Innovation](https://datainnovation.org/2026/03/agentic-commerce-is-coming-but-regulation-meant-for-humans-will-slow-it-down/)
- No agent-specific federal guidance exists. The April 2026 interagency model-risk guidance excludes generative and agentic AI. The Section 1033 open-banking rule is enjoined (E.D. Ky.), and a revised proposal was at White House review as of Aug 2026. These points come from aggregator sources. — [Banks block AI agents (AI News)](https://www.artificialintelligence-news.com/news/banks-block-ai-agents-open-banking-rule/); [bankingnewsai CFPB page (secondary)](https://www.bankingnewsai.com/ai-regulation/cfpb)
- The Consumer Bankers Association published a white paper from its agentic AI in payments symposium in Jan 2026. — [CBA white paper](https://consumerbankers.com/wp-content/uploads/2026/01/CBA-Agentic-Symposium-White-Paper-2026-01v2.pdf)
- **EU:** a provisional PSD3/PSR deal was reached in Nov 2025, and final texts were agreed on Apr 23, 2026. ECON approved them on May 5, 2026, with Official Journal publication expected in H2 or Dec 2026 and application about 21 months later (around 2028). No agent-specific PSR article was found. Practitioners argue strict SCA at execution is "structurally impossible" when variables are set at delegation time (Sopra Steria). The commercial-agent exclusion is now limited to agents acting for one side only. — [MoFo, Apr 30, 2026](https://www.mofo.com/resources/insights/260430-psd3-and-the-payment-services-regulation-key-developments); [Sopra Steria](https://www.soprasteria.com/insights/details/payment-services-regulation-psr-in-2026--the-state-of-play-for-banks); [Adyen PSD3 explainer](https://www.adyen.com/knowledge-hub/psd3); [PwC alert, Apr 2026](https://legal.pwc.de/content/services/regcore-client-alert/pwc-client-alert-eus-new-payments-framework-april-2026.pdf)
- **UK:** HM Treasury's "Modernising Payment Services Regulation" consultation (Jul 14, 2026, closed Oct 6, 2026). Question 15 asks whether the PSRs 2017 consent, authentication and unauthorised-transaction liability provisions need updating for agentic payments, and how responsibility should be split among "the payer, provider and agent supplier." The final approach is undecided. — [Bratby Law](https://bratby.law/agentic-payments-accountability-gap/)
- **International:** the FSB's Oct 2026 final report includes sound practices with "specific attention to generative and agentic AI" (via search snippet). — [Fenwick / search aggregate](https://www.fenwick.com/insights/publications/is-2026-the-year-of-agentic-payments)

### Inferences
- PayPal's User Agreement clause ("you are responsible" when someone you gave login information to exceeds their authority) mirrors the institution-favorable reading of Reg E. Unless regulators act, users carry the agent-error risk on PayPal unless PayPal voluntarily extends protection.

### Gaps
- I found no CFPB or FTC statement specific to agent payments, and no EU AI Act provision addressing payment agents. These were not found, not confirmed to be absent. I did not check the Official Journal publication status of PSD3/PSR as of Oct 31, 2026.

## 7. What is explicitly unresolved (liability gaps)?

### Takeaway
Credible sources agree on several open questions. Who bears loss when an agent acts within its credentials but outside the user's intent? How specific must consent be? How can merchant terms be surfaced through agents? And will dispute rights be weaponized? Protocols produce evidence, such as signed mandates and tokens, but none allocates liability.

### Cited Findings
- Platform-to-user disputes over an agent exceeding its authority have no statutory answer. Common law applies case by case. Delegation scope is often imprecise (the example given is a technically compliant but impractical one-hour layover). It is unclear whether platforms should rely on material terms or require consent to merchant terms per purchase. Large merchants can shift risk to platforms by contract, but small ones cannot. — [Goodwin, Jun 2026](https://www.goodwinlaw.com/en/insights/publications/2026/06/insights-technology-aiml-authorizing-agentic-payments)
- Visa TAP, Mastercard Agent Pay, AP2 and UCP all produce signed identity and intent records, but none publishes a dispute-liability allocation. — [Chargeflow (vendor)](https://www.chargeflow.io/blog/ai-agent-chargeback-liability)
- Trust frameworks and Know Your Agent standards "can supply evidence but cannot settle consent or liability alone." The UK has not decided. — [Bratby Law](https://bratby.law/agentic-payments-accountability-gap/)
- The PayPal AP2 dispute and authorization integrations remain stated as "could" or pilot items. — [PayPal Developer Blog, Sep 16, 2025](https://developer.paypal.com/community/blog/PayPal-Agent-Payments-Protocol/)

### Inferences
- Gap analysis specific to PayPal:
  - (a) No contractual definition of an agent or a mandate.
  - (b) The "exceeds authority means user responsible" clause leaves agent errors uncovered.
  - (c) SNAD excludes "properly described but you didn't want it."
  - (d) Promised mandate-based dispute evidence has not appeared in the terms.
  - (e) ACP allowances cap price and time but carry no item intent.
  A product that captures the user's intent and compares it with the cart before authorization, then attaches that record to any dispute, targets exactly these gaps.

### Gaps
- I found no PayPal statement, FAQ or case data on how it adjudicates agent-error disputes in practice.
