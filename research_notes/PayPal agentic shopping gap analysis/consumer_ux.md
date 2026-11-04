# Consumer UX of Agentic Shopping Checkout: PayPal and Competitors (as of Oct 31, 2026)

Method note: about 20 searches and fetches. Several primary pages could not be fetched (403/404): the Commerce/PayPal June 23, 2026 release on commerce.gcs-web.com, chartmill, barchart, the BigCommerce investor PDF and TechSpot. Where I fell back to search snippets or secondary outlets, I say so. Most hands-on detail comes from launch coverage in late 2025 to early 2026; I say when something is older. Anything I label "anecdotal" is a single report, not documented product behavior.

## 1. Approval flows: PayPal inside ChatGPT, Perplexity, Google AI Mode/Gemini, Microsoft Copilot

### Takeaway
On every PayPal-powered chat surface I found, the human confirms each purchase: they tap a Buy or PayPal button, then log in or use a passkey in a PayPal-branded flow. No surface documents fully autonomous PayPal purchases. The only "delegated" flows (buy later when a condition is met) are Google's price-tracking agentic checkout, which uses Google Pay, and Amazon Rufus Auto Buy (see Q5). ChatGPT's Instant Checkout, the flagship surface, was scaled back in March 2026, so the in-chat PayPal flow there is now uncertain.

### Cited Findings
**PayPal's documented generic flow (PayPal Editorial, March 13, 2026)**
- Perplexity (US web and desktop; mobile "coming soon"):
  1. Prompt.
  2. Shopping tab with product cards showing image, price, delivery estimate and merchant name.
  3. Choose "Instant Buy" or "Buy with PayPal".
  4. Log in or confirm with saved PayPal credentials or a passkey; PayPal supplies payment and shipping.
  5. Confirmation; PayPal handles receipts, order tracking and support.
  — [PayPal: How to shop with PayPal in AI chats](https://history.paypal.com/us/money-hub/article/how-paypal-powers-ai-shopping)
- ChatGPT ("rolling out, possibly limited by user, region, or merchant"):
  1. Prompt with purchase intent.
  2. Suggestions with images, price ranges and merchant details "where available".
  3. Choose "Pay with PayPal".
  4. A PayPal-powered flow opens: confirm with credentials or passkey, then approve payment and shipping in the PayPal interface.
  5. Confirmation in ChatGPT, plus a standard PayPal receipt and transaction history.
  — [PayPal money hub](https://history.paypal.com/us/money-hub/article/how-paypal-powers-ai-shopping)
- The PayPal guide does not mention return policy, item conditions, or a summary of "what you asked for" on the confirmation step. It says nothing about returns at all. — [PayPal money hub](https://history.paypal.com/us/money-hub/article/how-paypal-powers-ai-shopping)

**ChatGPT Instant Checkout status**
- Instant Checkout launched in September 2025 (Etsy first). A "Buy" button appears on compatible products, and the user confirms order, shipping and payment in-chat. — [efulfillmentservice](https://www.efulfillmentservice.com/2025/11/chatgpt-instant-checkout-what-ecommerce-sellers-need-to-know/); [ConsumerAffairs](https://www.consumeraffairs.com/news/paypal-links-up-with-chatgpt-to-provide-instant-checkout-102825.html)
- PayPal announced it would adopt the Agentic Commerce Protocol (ACP) for ChatGPT, with PayPal wallet support starting in 2026 (announced October 28, 2025). — [Yahoo Finance](https://finance.yahoo.com/news/paypal-partners-openai-let-users-104743759.html?.tsrc=rss)
- Around March 17–20, 2026 (sources differ on the date), OpenAI scaled back Instant Checkout after a report by The Information.
  - Users are redirected to merchants' own checkout or merchant apps. A spokesperson said "Instant Checkout is transitioning to apps."
  - Forrester's Emily Pfeiffer is cited as saying only about 30 Shopify merchants participated as of February 2026.
  - OpenAI also reportedly had no US sales-tax collection system in place.
  — [Shopifreaks](https://www.shopifreaks.com/openai-pivots-from-instant-checkout-to-an-app-based-shopping-model-inside-chatgpt/); [Storyboard18](https://storyboard18.com/digital/openai-reduces-chatgpt-shopping-focus-shifts-to-product-discovery-93192.html); [Forkast](https://forkast.news/openai-built-in-chat-checkout-for-ai-commerce-five-months-later-it-walked-away/). These are trade outlets; I did not see the original report from The Information.
- Conflict: PayPal's March 13, 2026 guide still describes the ChatGPT PayPal flow as "rolling out", days before the scale-back reports. Whether the in-chat PayPal flow in ChatGPT is live as of October 2026 is unverified.

**Perplexity**
- PayPal and Perplexity launched "Instant Buy" on November 25, 2025 for US shoppers.
  - The retailer stays merchant of record for shipping, returns and support.
  - Launch promo: 50% back in PayPal Rewards, up to $50. It has ended.
  — [PayPal newsroom](https://newsroom.paypal-corp.com/2025-11-PayPal-and-Perplexity-Launch-Instant-Buy); [Tom's Guide](https://www.tomsguide.com/ai/perplexity-now-includes-in-app-shopping-through-paypal-and-you-can-save-50-percent-on-your-first-purchase); [eWeek](https://www.eweek.com/news/paypal-perplexity-instant-buy-shopping/)
- The earlier "Buy with Pro" agent (late 2024) was tested by TechCrunch:
  - Purchases took hours or failed.
  - The bank statement showed the charge going to Perplexity's agent, not Walmart.
  - Three hours later, an email said the item (toothpaste) was sold out.
  — [TechCrunch via Ben's Bites](https://news.bensbites.com/posts/31127-early-tests-show-perplexitys-ai-shopping-agent-which-lets-users-make-purchases-in-its-app-sometimes-takes-hours-to-process-purchases-or-fails-to-buy-items) (older, pre-PayPal)
- Comet browser: one hands-on found it adds items to the cart but would not complete the purchase; the user had to finish checkout. — [Yahoo](https://www.yahoo.com/life/articles/m-testing-perplexity-ai-browser-093500746.html) (date unclear)

**Google AI Mode / Gemini**
- Agentic checkout with Google Pay (help center):
  - The user confirms a total price. The purchase goes through only if the final price is the same or lower than "the total price you confirmed".
  - If the price rises, the purchase fails and the user is not charged. If it goes out of stock or the price changes significantly, the user gets a notification or email.
  - Updates arrive by email and device notification.
  - Available in the US and Australia (the troubleshooting section says US only, which is internally inconsistent).
  - No promo codes or loyalty rewards.
  - Buy now, pay later is available for select purchases.
  - Wrong items, cancellations and returns: "contact the merchant".
  - PayPal is not mentioned.
  — [Google Pay Help: About agentic checkout](https://support.google.com/googlepay/answer/16421147)
- The original flow (November 2025): "Track price" with a target, then a notification with a "buy for me" option. Google asks permission and buys only after the user confirms purchase and shipping details. — [Finextra](https://www.finextra.com/newsarticle/46022/google-launches-agentic-shopping-experience); [Google blog](https://blog.google/products/shopping/agentic-checkout-holiday-ai-shopping/?hl=de)
- January 2026, Universal Commerce Protocol (UCP):
  - A "Buy" button in Gemini and AI Mode opens a review page pre-filled with Google Pay payment and Google Wallet shipping.
  - The retailer is seller of record.
  - Google said PayPal is "coming soon"; launch coverage conflicts on whether PayPal shipped.
  — [9to5Google](https://9to5google.com/2026/01/11/gemini-ai-mode-checkout/); [PCWorld](https://www.pcworld.com/article/3031254/buy-in-chat-google-adds-checkout-to-gemini-and-searchs-ai-mode.html); [Retail TouchPoints](https://www.retailtouchpoints.com/news/google-launches-direct-checkout-in-search-gemini/156360/)
- PayPal's Agent Ready developer docs (updated June 10, 2026) describe Braintree merchants enabling the UCP Buy button via the Google Pay handler. Customers "authorize PayPal" and a delegated token is issued. — [PayPal developer: Agent Ready](https://developer.paypal.com/agent-ready/overview)

**Microsoft Copilot**
- Copilot Checkout launched January 8, 2026 on Copilot.com (US), with Bing, MSN, Edge and Windows to follow.
  - PayPal powers inventory surfacing, branded checkout, guest checkout and card payments.
  - Purchases are eligible for PayPal buyer protection.
  - Shopify merchants are auto-enrolled after an opt-out window.
  — [PayPal newsroom](https://newsroom.paypal-corp.com/2026-01-08-PayPal-Powers-Microsofts-Launch-of-Copilot-Checkout); [Axios](https://www.axios.com/2026/01/08/microsoft-ai-copilot-checkout); [Engadget](https://www.engadget.com/ai/microsoft-is-now-integrating-shopping-directly-into-copilot-181022989.html)

### Inferences
- PayPal's consent model on these surfaces is "per-transaction approval in a PayPal-branded step". That is strong for consent, but it is just a one-tap wallet confirm: no intent recap, no return-policy surface.
- Google is the only one I found with a documented price ceiling bound to the user's confirmation, where a higher price means no charge. PayPal has no documented equivalent on the consumer side.

### Gaps
- No official OpenAI help-center text was retrieved on the current (post-March 2026) ChatGPT purchase flow or the status of PayPal in it.
- The Copilot Checkout confirmation screen is not described in any source I found: whether merchant, return policy or final total are shown, or whether it requires a PayPal login.
- I could not confirm whether PayPal is live as a payment option in Google AI Mode/Gemini for consumers as of October 2026.
- No 2026 hands-on reviews from The Verge, Wired or CNET of any PayPal agentic checkout surfaced in my searches.

## 2. PayPal's own in-app shopping agent and Honey agent features

### Takeaway
Honey's agentic features are discovery and price comparison layered on chatbot answers. Checkout is a link-out to the merchant. PayPal's own in-app shopping agent was described only as "testing"; I found no confirmed general consumer launch or documented autonomy or controls.

### Cited Findings
- September 30, 2025: Honey's extension shows products that chatbots recommend (ChatGPT first), with real-time pricing, merchant options and offers. Users follow Honey's link to the merchant site to complete the purchase. Free, US only, in time for the holidays. — [TechCrunch](https://techcrunch.com/2025/09/30/paypals-honey-to-integrate-with-chatgpt-and-other-ais-for-shopping-assistance); [PayPal newsroom](https://newsroom.paypal-corp.com/2025-09-30-PayPal-Continues-to-Shape-Agentic-Commerce-with-Instant-Product-Discovery)
- Coverage states "The PayPal app is currently testing its own shopping agent experience." — [getcoai](https://getcoai.com/news/paypal-launches-ai-agent-payment-tools-as-shopping-automation-hits-40) (secondary)
- PayPal's limited-release developer platform describes agents that discover products, manage carts and process payments using Honey product discovery. This is developer-facing, not a consumer UX. — [docs.paypal.ai](https://docs.paypal.ai/limited-release/agentic-commerce/overview)

### Inferences
- PayPal has no first-party consumer "agent wallet" or controls screen I could document. Its consumer UX is borrowed from host surfaces (Perplexity, Copilot, possibly ChatGPT and Google).

### Gaps
- I could not confirm the status of the PayPal app shopping agent in October 2026, its autonomy level, or its controls.

## 3. Natural-language preferences that become enforced limits

### Takeaway
Enforced constraints exist but are narrow:
- Google: a price ceiling tied to the confirmed total.
- Amazon Rufus: a target price, one unit, one active Auto Buy per item.
- Card networks: a spending cap and conditions marketed by Visa and Mastercard, enforced at network or issuer level.

I found no consumer product that turns free-form preferences ("ask me if over $X", must-have attributes, approved stores, expiry) into enforced rules. PayPal documents no consumer-side agent limits.

### Cited Findings
- Google: the purchase executes only if the final price is at or below the confirmed total; otherwise no charge. — [Google Pay Help](https://support.google.com/googlepay/answer/16421147)
- Amazon Rufus Auto Buy:
  - Natural-language setup ("Buy these headphones when they're 30% off") or a price alert.
  - The user must check an "Auto Buy" box.
  - Prices are checked every 30 minutes; the purchase uses the default payment method.
  - US Prime, app only.
  — [ConsumerAffairs](https://www.consumeraffairs.com/news/amazon-rufus-price-alerts-save-by-only-buying-when-its-a-deal-120425.html); [Modern Retail](https://www.modernretail.co/technology/marketplace-briefing-amazons-shopping-bot-rufus-can-now-automatically-buy-products-for-you-when-prices-drop/)
- Amazon Rufus limits (from a community guide): one active Auto Buy per item, one unit, Fulfilled-by-Amazon items only, and a 6-month default alert window. — [Slickdeals](https://slickdeals.net/f/19119676-amazon-auto-buy-feature-automatic-purchase-at-target-price-app-only-via-rufus) (community source)
- Visa Intelligent Commerce (April 30, 2025): it "allows consumers to easily set spending limits and conditions". Visa's framing: "Each consumer sets the limits, and Visa helps manage the rest." — [Visa press release](https://usa.visa.com/about-visa/newsroom/press-releases.release.21361.html)
- Mastercard Agent Pay offers trusted agent registration, biometric authentication, and "Users can set parameters that define agent permissions and spending limits". — [Digital Commerce 360](https://www.digitalcommerce360.com/2025/05/06/visa-mastercard-ai-agentic-commerce/)
- Secondary claims, unverified:
  - Revocation of an agent happens in real time through the issuer's app.
  - A June 10, 2026 Visa–OpenAI partnership with spending limits, merchant categories and approval requirements.
  - Visa says each purchase is currently human-approved, loosening over time.
  — [Stellagent](https://stellagent.ai/insights/visa-openai-agentic-commerce-partnership)

### Inferences
- The enforced/preference split:
  - Enforced: price ceilings (Google, Amazon) and network-level caps (Visa, Mastercard, if issuers expose them).
  - Preferences only: attributes, brands and store choices given to chat agents. Nothing I found binds them at payment time.
- This is a clear opening for PayPal: an "intent mandate" that compiles natural-language constraints into enforced wallet rules.

### Gaps
- I found no consumer-facing Visa or Mastercard UI (issuer-app screenshots or help pages) showing how a shopper actually sets agent limits in 2026.
- I found no source on expiry windows for delegated purchase intents, apart from the community-sourced Rufus 6-month default.

## 4. Receipts and post-purchase recourse

### Takeaway
Receipts are the standard merchant email plus the wallet transaction record (PayPal) or email/push updates (Google). No surface documents a record comparing "what you asked for" with "what was bought".

Returns go to the merchant of record everywhere. PayPal's distinctive offer is Buyer Protection and disputes through PayPal. Some retailers, such as Target's agent, reportedly shift liability for agent mistakes onto the shopper.

### Cited Findings
- PayPal: receipts, transaction history and disputes are handled through PayPal. Eligible purchases get Buyer Protection and "the same dispute resolution process as standard online transactions". No extra fees. — [PayPal money hub](https://history.paypal.com/us/money-hub/article/how-paypal-powers-ai-shopping)
- Copilot Checkout purchases are eligible for PayPal buyer and seller protection. — [PayPal newsroom](https://newsroom.paypal-corp.com/2026-01-08-PayPal-Powers-Microsofts-Launch-of-Copilot-Checkout)
- Perplexity Instant Buy: the merchant of record handles shipping, returns and support. — [eWeek](https://www.eweek.com/news/paypal-perplexity-instant-buy-shopping/)
- Google: wrong items, cancellations, returns and missing orders go to the merchant. — [Google Pay Help](https://support.google.com/googlepay/answer/16421147)
- Amazon Rufus Auto Buy: per the fine print, there are "24 hours to cancel before it ships". — [Modern Retail](https://www.modernretail.co/technology/marketplace-briefing-amazons-shopping-bot-rufus-can-now-automatically-buy-products-for-you-when-prices-drop/)
- Target's AI agent (via Gemini): coverage reports Target's terms put financial responsibility for wrong or duplicate agent orders on the user. A Target spokesperson told Business Insider the items remain eligible for returns and exchanges, which is in tension with that. — [ainauten summary](https://news.ainauten.com/en/story/target-warns-that-if-its-ai-shopping-agent-makes-an-expensive-mistake-youll-have-to-pay-for-it) (secondary; TechSpot original returned 403)
- An industry analysis argues that return processes break down when "the agent bought it", leaving it ambiguous whether the shopper, agent or brand is at fault. — [FusionCX](https://www.fusioncx.com/blog/retail/ai-shopping-customer-support/) (opinion)

### Inferences
- The gap: no record of intent. If an agent buys the wrong size or color, the shopper's evidence is only the chat log, which PayPal does not ingest. A dispute flow that captures agent intent and mandate would be differentiated.

### Gaps
- I found no documentation of a dispute reason code or flow specific to "agent error" at PayPal, Visa or Mastercard aimed at consumers.

## 5. Competitor UX comparison and "agent wallets"

### Takeaway
- Amazon Rufus Auto Buy is the most autonomous mainstream consumer feature: a pre-authorized buy at a target price, with no per-purchase confirmation.
- Google's flow is one-time pre-consent with a price guard.
- Visa and Mastercard market caps and conditions, but these are delivered through issuers and agents rather than one consumer app.

I found no mainstream consumer "agent wallet" from PayPal, Klarna, Amex or Shopify in my searches. Stripe and Shopify mostly power merchant-side rails (ACP, Copilot).

### Cited Findings
- Amazon Rufus Auto Buy: autonomous at trigger time after explicit opt-in (checkbox), default payment method, 24-hour cancel window. — [Modern Retail](https://www.modernretail.co/technology/marketplace-briefing-amazons-shopping-bot-rufus-can-now-automatically-buy-products-for-you-when-prices-drop/); [About Amazon](https://www.aboutamazon.com/news/retail/how-to-use-amazon-shopping-ai-assistant)
- Microsoft Copilot Checkout partners: PayPal, Stripe and Shopify (Shopify merchants auto-enrolled). — [Axios](https://www.axios.com/2026/01/08/microsoft-ai-copilot-checkout)
- Google UCP was co-developed with Shopify, Etsy, Wayfair and Target (sources differ on the list). — [9to5Google](https://9to5google.com/2026/01/11/gemini-ai-mode-checkout/)
- The industry pattern of embedding spend caps in the payment instrument (scoped virtual cards with expiry and limits, e.g. Crossmint) is mainly developer- or enterprise-oriented. — [Privacy.com roundup](https://www.privacy.com/blog/payment-solutions-ai-agents-2026-compared) (vendor blog)

### Inferences
- An autonomy spectrum:
  1. Per-purchase human approval: PayPal on Perplexity, Copilot and ChatGPT.
  2. Pre-approved, price-bounded: Google agentic checkout.
  3. Standing auto-buy: Amazon Rufus.
  4. Network-capped delegation: Visa and Mastercard, mostly not yet consumer-visible.

### Gaps
- I did not research Klarna, Amex or Stripe consumer UX in depth (search budget); no findings on their agent wallets.
- I found no specific 2026 product details for Mastercard Agent Pay consumer screens.

## 6. Reported problems and consumer survey data

### Takeaway
Documented failures are few and mostly early:
- Perplexity's slow or failed buys, with charges going to the agent.
- OpenAI Operator making an unrequested egg purchase (anecdotal).
- Retailer terms pushing liability onto shoppers.

Survey data consistently shows high interest but a demand for human approval and security. The June 2026 Logica Research survey was co-commissioned by Commerce (BigCommerce's parent) and PayPal.

### Cited Findings
**Commerce + PayPal / Logica Research (released June 23, 2026)**
- Online survey by Logica Research, March–April 2026: 1,000 UK online shoppers plus 2,000 across the US and Australia. US release headline: "Two-Thirds of Consumers Are Ready to Try Agentic Shopping, but Many Demand Human Approval Before AI Can Buy". — [Commerce IR (403 on fetch)](https://commerce.gcs-web.com/news-releases/news-release-details/two-thirds-consumers-are-ready-try-agentic-shopping-many-demand); [Chartmill mirror](https://www.chartmill.com/news/external/52793/gnwcq-2026-6-23-two-thirds-of-consumers-are-ready-to-try-agentic-shopping-but-many-demand-human-approval-before-ai-can-buy)
- US: 67% interested in trying an agentic shopping tool, the highest of the markets surveyed. — Search snippet of the Commerce release ([Chartmill](https://www.chartmill.com/news/external/52793/gnwcq-2026-6-23-two-thirds-of-consumers-are-ready-to-try-agentic-shopping-but-many-demand-human-approval-before-ai-can-buy)); not verified against full text.
- UK (separate release, same date):
  - 64% interested; 21% currently use AI shopping tools.
  - 62% of non-users plan to try within a year.
  - 31% are motivated by best price; 28% by promotions.
  — [Lets Data Science, citing Retail Times](https://letsdatascience.com/news/shoppers-express-interest-in-agentic-ai-but-cite-major-conce-c8f5b325); [Sahm Capital headline](https://www.sahmcapital.com/news/content/64-of-uk-consumers-want-to-use-agentic-ai-for-shopping-according-to-new-research-from-commerce-and-paypal-2026-06-23)
- Barriers to giving AI purchasing autonomy:
  - 43% fear unauthorized purchases
  - 39% worry about bank-account security
  - 32% fear incorrect purchases
  - 29% cite privacy or data breaches
  - 83% expect AI payment security to match or exceed current methods
  - 70% want AI shopping help in the future
  - Geographic scope of these figures is unclear: UK, or all respondents.
  — [Lets Data Science](https://letsdatascience.com/news/shoppers-express-interest-in-agentic-ai-but-cite-major-conce-c8f5b325)
- An aggregator reports US figures of 81% wanting AI help with online shopping and 82% demanding payment security equal or better. Unverified secondary. — [briefglance](https://briefglance.com/companies/commerce-com-inc/pulses/45469)
- An Australian figure of "only 4% want AI at the point of payment" appears only in a secondary blog; unverified. — search result, no primary source located
- Do not confuse this survey with PayPal's separate "Agentic Commerce Pulse" UK report (Stripe Partners, business survey). — [PayPal Agentic Pulse UK PDF](https://www.paypalobjects.com/marketing/Agentic%20Pulse%20UK%20Report.pdf)

**Other surveys (secondary snippets)**
- Nuvei US survey (2025): 19% want AI help but will approve each purchase; only 6% would allow routine buys within set limits. — [Nuvei research](https://www.nuvei.com/br/agentic-commerce/research)
- Riskified Q1 2026: 55.0% not comfortable with AI agents purchasing on their behalf. — [Forkast](https://forkast.news/73-use-ai-for-shopping-55-wont-let-it-buy-anything-the-trust-gap-is-widening/)

**Problem reports**
- OpenAI Operator, anecdotal: a columnist testing on Instacart reported it bought $31.43 of eggs he only asked it to find. OpenAI said the agent fell short of its confirmation safeguard. — [vibegraveyard summary](https://vibegraveyard.ai/story/openai-operator-unrequested-instacart-egg-purchase/) (single secondary source; original was a Washington Post column, not retrieved)
- Perplexity Buy with Pro: purchases took hours or failed; the charge appeared under Perplexity, not the retailer. — [TechCrunch via Ben's Bites](https://news.bensbites.com/posts/31127-early-tests-show-perplexitys-ai-shopping-agent-which-lets-users-make-purchases-in-its-app-sometimes-takes-hours-to-process-purchases-or-fails-to-buy-items) (late 2024)
- Target's agent terms place liability for wrong or duplicate orders on the user. — [ainauten](https://news.ainauten.com/en/story/target-warns-that-if-its-ai-shopping-agent-makes-an-expensive-mistake-youll-have-to-pay-for-it)
- Accuracy studies on chatbots recommending products (not checkout agents):
  - A Product.ai study reported "wrong 86% of the time", with a median $300 price error when wrong. — [Tech.co](https://tech.co/news/ai-shopping-assistants-not-ready-holidays) (methodology unverified)
  - A Wharton study on consistency failures. — [themodelwire](https://themodelwire.com/article/wharton-study-reveals-shopping-agents-fail-basic-consistency-tests-01M1280YS4E55RAV7F9QZMETN1)
- Weak adoption is itself a UX signal: about 30 Shopify merchants on ChatGPT Instant Checkout by February 2026, followed by the March 2026 pullback. — [Shopifreaks](https://www.shopifreaks.com/openai-scales-back-its-integrated-commerce-plans/)

### Inferences
- What consumers want (43% fear unauthorized purchases; "many demand human approval") maps directly onto missing UX: visible caps, an approval threshold, an intent receipt, and a clear agent-error dispute path.
- Per-purchase approval is the norm today, but it is a plain wallet confirm. It does not reassure against "incorrect purchase" (32%) because it does not show the original request next to the item being bought.

### Gaps
- I could not retrieve the full text of the Commerce/PayPal US release. The exact "human approval" percentage, the US-specific barrier figures and the Australia figures are unverified. Fetch commerce.gcs-web.com or investors.bigcommerce.com manually to confirm.
- I found no PayPal-only newsroom release of this survey; it appears under Commerce's IR with PayPal as co-sponsor.
- I found no Reddit or user-complaint threads specific to PayPal agentic checkouts.
