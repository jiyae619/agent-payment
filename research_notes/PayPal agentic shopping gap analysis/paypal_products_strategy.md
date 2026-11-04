# PayPal Agentic Commerce: Products, Partnerships, Strategy and Launch Status (as of Oct 31, 2026)

Research note scope: PayPal (incl. Venmo, Braintree, Honey) products, features, partnerships and announcements related to AI agents shopping/paying. Research date: 2026-10-31. About 18 search/fetch calls; several items rest on secondary coverage only and are flagged as such.

Source-quality caveat: a fetched transcript page (fool.com) contained embedded instructions aimed at AI tools; these were ignored. Several "PayPal agentic" pages are aggregator/blog content (bankingnewsai, eco.com, metaintro, stellagent, finance-loop); they are used only where flagged.

---

## Q0. Master dated inventory (status as of Oct 31, 2026)

Status keys: Announced / Beta-Access-by-request / Limited markets / GA / Discontinued-dependent. "US-only" means the only market named in any source.

| Date | Item | What it is | Status at Oct 31, 2026 | Source quality |
|---|---|---|---|---|
| Apr 2025 | PayPal remote MCP server + Agent Toolkit | Dev tools exposing PayPal APIs (invoices, orders, subscriptions, etc.) to agents/LLM frameworks | GA (developer tools) | Primary docs + secondary |
| Apr-May 2025 | Braintree x Mastercard Agent Pay | Braintree partnered with Mastercard Agent Pay; PayPal reported to have piloted Mastercard's Agent Pay Acceptance Framework | Announced / pilot; no GA confirmation found | Secondary only |
| May 14, 2025 | Perplexity selects PayPal | PayPal/Venmo checkout inside Perplexity (US) | Live in US (reported Nov 25, 2025; single secondary source for date) | Primary (announcement) + secondary (launch date) |
| Sept 2025 | Google AP2 | PayPal a launch collaborator on Google's Agent Payments Protocol; aggregator says PayPal built an AP2-based agent with Google Cloud | Announced/participant; no shipped PayPal AP2 product found | Secondary |
| ~Oct 1, 2025 | Honey AI / Honey in ChatGPT | Honey surfaces product links, real-time pricing and deals in AI chat (starting with ChatGPT) | Live (per announcements); no 2026 status update found | Secondary |
| Oct 28, 2025 | Agentic Commerce Services: Agent Ready + Store Sync | Merchant products for accepting agent payments and syndicating catalogs to AI surfaces | Access-by-request (form) as of Oct 14, 2026 docs; Store Sync live on several surfaces, US-focused | Primary |
| Oct 28, 2025 | OpenAI partnership (ACP / Instant Checkout) | PayPal to adopt OpenAI's Agentic Commerce Protocol; PayPal wallet + merchants in ChatGPT "starting in 2026" | Announced; OpenAI reportedly retired native Instant Checkout in Mar 2026; no confirmation PayPal in-chat checkout ever went live | Primary (announcement); secondary (reversal) |
| ~Jan 2026 | Microsoft Copilot Checkout | PayPal-powered checkout on Copilot.com, US | Live in US (secondary) | Secondary |
| Jan 11, 2026 | Google UCP support | PayPal endorses Universal Commerce Protocol; "will soon be" a payment option in UCP checkout on Google (Search/Gemini) | Announced; no confirmation PayPal live in AI Mode/Gemini checkout (Google Pay was initial credential provider) | Primary |
| Jan 22, 2026 | Cymbio acquisition | Cymbio team/tech to power Store Sync | Announced (closing not verified in this research) | Primary PDF (unreadable) + secondary |
| Mar 1, 2026 | Leadership change | Enrique Lores becomes CEO, succeeding Alex Chriss | Effective | Secondary |
| Apr 29, 2026 | Reorg | Three business units; agentic commerce sits in Checkout Solutions & PayPal | Effective | Primary (SEC 8-K) |
| Apr 29, 2026 | Store Sync app for BigCommerce | App on BigCommerce marketplace for US merchants using PayPal; distributes to Copilot, Meta, Perplexity | GA for US BigCommerce merchants | Secondary (Commerce announcement via Yahoo) |
| Jul 2026 | Glance/Samsung TV commerce deal (T-commerce) | Earlier PayPal TV-commerce deal (80M+ household reach claim) | Announced | Secondary |
| Sept 22, 2026 | Meta Muse partnership | PayPal customers can shop/check out via Meta's Muse AI agent at PayPal merchants worldwide | Announced (via X post); live status/markets unclear | Secondary |
| Oct 14, 2026 | Dev docs update | Agentic commerce services page: Agent Ready + Store Sync, request access via form | Access-by-request | Primary |
| Oct 15, 2026 | Glance native checkout | PayPal as native checkout in Glance AI shopping app across ~60M US mobile + CTV devices | Announced; launch timing, merchants and on-TV checkout undisclosed | Secondary |
| Oct 19, 2026 | Money20/20 CEO remarks | Lores: no meaningful agentic volume until 2028 | Statement | Secondary (Payments Dive) |
| Oct 27, 2026 | Q3 2026 earnings | Lores: collaborating with Meta and other AI companies on personal AI agents | Statement | Transcript (secondary host) |

---

## Q1. Agent Ready and Store Sync: what they do, shipped?, markets, 2026 changes

### Takeaway
Both were announced Oct 28, 2025. As of PayPal's Oct 14, 2026 developer docs, both are still gated behind an "request access" form (not self-serve GA), no markets are listed, and ChatGPT is the only AI surface named. Store Sync has real live deployments (Copilot, Perplexity, later Meta via BigCommerce) mainly in the US; Agent Ready's general launch ("early 2026") is not confirmed by any primary source found.

### Cited Findings
- Oct 28, 2025: PayPal launched "agentic commerce services". Agent Ready "instantly unlocks for the millions of existing PayPal merchants the ability to accept payments on AI surfaces"; Store Sync makes merchant product data discoverable in AI channels and drops orders into existing fulfillment/order systems. Store Sync enrollment "will become available soon"; Agent Ready slated for early 2026. — [PayPal newsroom](https://newsroom.paypal-corp.com/2025-10-28-PayPal-Launches-Agentic-Commerce-Services-to-Power-AI-Driven-Shopping); [Digital Commerce 360](https://www.digitalcommerce360.com/2025/10/28/paypal-agentic-commerce-ai-driven-shopping-services/)
- Launch partners: Wix, Cymbio, BigCommerce (Commerce), Feedonomics, Shopware. — [PayPal newsroom](https://newsroom.paypal-corp.com/2025-10-28-PayPal-Launches-Agentic-Commerce-Services-to-Power-AI-Driven-Shopping)
- Developer page (last updated Oct 14, 2026): Agent Ready lets merchants accept payments from AI assistants with minimal changes to existing PayPal setup, supporting supervised and automatic shopping; Store Sync lets customers search, build carts and check out without leaving the AI platform, with orders flowing into existing OMS. Merchants must submit a form to contact PayPal's AI team and request access. No markets listed. Only ChatGPT named as AI platform; no mention of ACP, AP2, UCP or MCP. Points to PayPal extension on VS Code Marketplace for snippets. — [PayPal Developer: Agentic commerce services overview](https://developer.paypal.com/agentic-commerce-services/about)
- Jan 22, 2026: PayPal agreed to acquire Cymbio, whose team and technology will power Store Sync; "Cymbio will enable tens of millions of merchants to become discoverable on leading AI platforms." Named brands live with Store Sync on Microsoft Copilot and Perplexity: Abercrombie & Fitch, Fabletics, Ashley Furniture, Newegg, Adorama. ChatGPT and Google Gemini app / AI Mode described as "coming soon" at that time. — [Barchart (PayPal release)](https://www.barchart.com/story/news/37170333/paypal-to-acquire-cymbio-accelerating-agentic-commerce-capabilities); [PayPal PDF](https://s205.q4cdn.com/875401827/files/doc_news/PayPal-to-Acquire-Cymbio-Accelerating-Agentic-Commerce-Capabilities-2026.pdf) (PDF text not machine-readable in this research; details via secondary)
- Apr 29, 2026: Commerce (BigCommerce) integrated Store Sync; app available on BigCommerce App Marketplace for US-based merchants using PayPal; connects catalogs to discovery/checkout across Microsoft Copilot, Meta and Perplexity. — [Yahoo Finance (Commerce release)](https://finance.yahoo.com/sectors/technology/articles/commerce-announces-integration-paypal-store-120000255.html); [Shopifreaks](https://www.shopifreaks.com/commerce-integrates-paypals-store-sync-to-push-bigcommerce-merchants-onto-microsoft-copilot-meta-and-perplexity/)
- Aug 7, 2026: UK trade press promoting Store Sync ("Reach AI Shoppers with PayPal Store Sync") — suggests UK marketing, but market availability not confirmed. — [The Retail Bulletin](https://www.theretailbulletin.com/retail-solutions/reach-ai-shoppers-with-paypal-store-sync-08-07-2026/)
- Oct 16, 2026: PayPal merchant guidance positions PayPal as a connective layer between merchants, AI shopping experiences and payment networks. — [PayPal BRC article](https://www.paypal.com/us/brc/article/agentic-commerce-merchant-readiness-checklist)

### Inferences
- Store Sync is effectively "limited availability / US-first": live with named enterprise brands and via BigCommerce (US), but the official doc still requires an access request. Agent Ready appears to remain access-by-request rather than "instantly unlocked" for all merchants, contrary to the Oct 2025 framing.
- The developer page naming only ChatGPT while OpenAI reportedly abandoned native checkout (see Q3) suggests stale docs or that the ChatGPT path is via merchant-owned checkout/apps.

### Gaps
- No primary source confirming Agent Ready GA date or country list.
- Cymbio deal closing date not verified.
- No merchant counts or GMV figures for Store Sync found.

---

## Q2. PayPal's own shopping agent/assistant (PayPal app, Honey)

### Takeaway
No standalone PayPal consumer shopping agent in the PayPal app was found as of Oct 31, 2026. The consumer AI shopping product is Honey's AI features (deals/price info surfaced inside AI chats, starting with ChatGPT). The CEO says PayPal has under-invested in consumer and wants to rebuild consumer offerings, and frames future agentic use beyond checkout (e.g., P2P).

### Cited Findings
- Honey AI is a feature layer within the existing Honey extension/app (not separate); surfaces product links, real-time pricing and deals when users ask ChatGPT shopping questions; PayPal told TechCrunch the integrations are AI-agnostic, starting with ChatGPT. — [TechBuzz](https://www.techbuzz.ai/articles/paypal-honey-teams-up-with-chatgpt-for-ai-shopping-assistant); [ecommercenews.blog (Oct 1, 2025)](https://ecommercenews.blog/2025/10/01/paypal-honey-genai-shopping-agent/) (secondary)
- June 2026: a federal judge reportedly allowed a consolidated creator class action over Honey affiliate-link practices to proceed; PayPal disputes. — [bankingnewsai](https://www.bankingnewsai.com/fintech/paypal/payment-ecosystem-ai) (aggregator, unverified)
- Q3 2026 call: Lores said agentic approaches could extend beyond checkout to other activities like peer-to-peer transfers. — [Yahoo Finance Q3 call highlights](https://finance.yahoo.com/markets/stocks/articles/paypal-q3-earnings-call-highlights-150504624.html)
- Oct 19, 2026: Lores: "The attention of the company has been much more in the merchant side than in the consumer side"; wants to rebuild consumer offerings. — [Payments Dive](https://www.paymentsdive.com/news/paypal-isnt-agile-enough-ceo-says/833449/)
- PayPal's AI chat agents (customer service, not shopping) resolved 24M+ contacts YTD across 190 countries, six languages. — [Motley Fool Q3 transcript](https://www.fool.com/earnings/call-transcripts/2026/10/27/paypal-pypl-q3-2026-earnings-call-transcript/)

### Inferences
- A PayPal-owned consumer shopping agent is a visible gap; PayPal's strategy is "be the wallet/trust layer inside other companies' agents" (Meta Muse, Perplexity, Copilot, Glance) rather than build its own.

### Gaps
- Q3 2026 transcript does not mention Honey or a PayPal app assistant. No 2026 primary release on Honey AI status/markets found.

---

## Q3. Partnerships: role and live status

### Takeaway
Live (US): Perplexity checkout (PayPal/Venmo), Microsoft Copilot Checkout, Store Sync on Copilot/Perplexity/Meta via BigCommerce. Announced but not confirmed live: Google UCP checkout, Meta Muse (Sept 2026), Glance (Oct 2026). OpenAI/ChatGPT checkout was announced for 2026 but OpenAI reportedly retired native Instant Checkout in March 2026. Visa/Mastercard ties are thin (Braintree/Mastercard Agent Pay).

### Cited Findings
**OpenAI / ChatGPT**
- Oct 28, 2025: PayPal to adopt OpenAI's Agentic Commerce Protocol so ChatGPT users can pay with PayPal via Instant Checkout, starting 2026; PayPal merchants become discoverable in ChatGPT. — [PayPal/OpenAI PDF](https://s205.q4cdn.com/875401827/files/doc_news/OpenAI-and-PayPal-Team-Up-to-Power-Instant-Checkout-and-Agentic-Commerce-in-ChatGPT-2025.pdf); [TechCrunch](https://techcrunch.com/2025/10/28/paypal-partners-with-openai-to-let-users-pay-for-their-shopping-within-chatgpt)
- Reported: OpenAI shelved Instant Checkout after ~6 months; a March 2026 OpenAI post said merchants could use their own checkout while OpenAI focuses on discovery. — [Exploding Topics](https://explodingtopics.com/blog/agentic-commerce-protocol); [Lengow](https://blog.lengow.com/chatgpt-wanted-to-become-the-worlds-biggest-shop) (secondary; no primary OpenAI statement fetched)
- PayPal's Q3 2026 call did not mention OpenAI. — [Motley Fool transcript](https://www.fool.com/earnings/call-transcripts/2026/10/27/paypal-pypl-q3-2026-earnings-call-transcript/)

**Perplexity**
- May 14, 2025: Perplexity selected PayPal; US Pro users to check out with PayPal or Venmo for products, travel, tickets, using passkey one-click. — [PayPal about.pypl.com](https://about.pypl.com/news-details/2025/Perplexity-Selects-PayPal-to-Power-Agentic-Commerce/default.aspx); [CNBC](https://www.cnbc.com/2025/05/14/perplexity-partners-with-paypal-for-in-chat-ai-shopping.html)
- Reported live for US users Nov 25, 2025. — [bankingnewsai](https://www.bankingnewsai.com/fintech/paypal/agentic-commerce) (single secondary source)

**Microsoft Copilot**
- PayPal-powered checkout debuts on Copilot.com in the US, with further Copilot channels planned; reported live in US (early 2026). — [Yahoo Finance](https://finance.yahoo.com/news/microsoft-brings-paypal-powered-checkout-122234866.html); [WindowsForum](https://windowsforum.com/threads/copilot-checkout-paypal-powered-in-chat-shopping-goes-live-in-the-us.396289/) (secondary; exact date not verified from Microsoft primary)

**Google (AP2, UCP, AI Mode/Gemini, Google Cloud)**
- Jan 11, 2026: PayPal supports Google's Universal Commerce Protocol; "will soon be available as a payment option within a new checkout experience on Google powered by UCP" (Search, Gemini app). No date or markets given. Quotes: Michelle Gill (GM Small Business & Financial Services), Prakhar Mehrotra (SVP, Head of AI). — [PayPal investor release](https://investor.pypl.com/news-and-events/news-details/2026/From-Search-to-Checkout-PayPal-Supports-Trusted-AI-Checkout-with-Google/default.aspx)
- Google's UCP checkout in AI Mode/Gemini initially used Google Pay as credential provider; PayPal "in the future"; US retailers first. — [9to5Google](https://9to5google.com/2026/01/11/gemini-ai-mode-checkout/); [Google blog](https://blog.google/products/ads-commerce/agentic-commerce-ai-tools-protocol-retailers-platforms/); a recent BigCommerce guide still lists PayPal as future — [BigCommerce](https://www.bigcommerce.com/articles/ecommerce/google-agentic-checkout/)
- AP2 (Sept 2025): PayPal a collaborator/participant; aggregator claims an AP2-based PayPal agent with Google Cloud; as of Apr 2026 AP2 production integrations limited. — [eco.com](https://eco.com/support/en/articles/14730447-paypal-agentic-commerce-explained); [bankingnewsai](https://www.bankingnewsai.com/fintech/paypal/agentic-commerce) (secondary)

**Meta (Muse)**
- Sept 22, 2026: PayPal and Meta announced PayPal customers can shop and check out through Meta's Muse AI agent at PayPal merchants worldwide (announced on X). Muse initially used Stripe Link; PayPal adds an option. PYPL rose ~5%. — [PYMNTS](https://www.pymnts.com/news/artificial-intelligence/2026/meta-adds-paypal-muse-ai-assistant-global-checkout/); [The Paypers](https://thepaypers.com/payments/news/paypal-partners-with-meta-to-bring-checkout-to-muse-ai-agent); [24/7 Wall St](https://247wallst.com/investing/2026/09/23/paypal-just-got-a-meta-partnership-heres-what-it-could-mean-for-the-stock/)
- Q3 call: Lores said PayPal is "collaborating with Meta and other AI companies" to integrate into personal AI agents, emphasizing trust/security for consumers and merchants. — [Motley Fool transcript](https://www.fool.com/earnings/call-transcripts/2026/10/27/paypal-pypl-q3-2026-earnings-call-transcript/)
- Note: no Meta press release found on PayPal newsroom page 1 (Jul-Oct 2026). — [PayPal newsroom](https://newsroom.paypal-corp.com/news)

**Glance (InMobi) / Samsung TV**
- Oct 15, 2026: PayPal native checkout integrated into Glance AI shopping platform, ~60M US mobile + connected-TV devices; German report says PayPal is the sole native checkout provider. Analysis notes checkout described as in-app on phone; on-TV checkout, fees, merchants and launch timing undisclosed. — [PYMNTS](https://www.pymnts.com/?p=4317643); [Stellagent](https://stellagent.ai/insights/glance-paypal-native-checkout); [boerse-global](https://www.boerse-global.de/paypal-aktie-wird-exklusiver-checkout-bei-glance/833772); [Yahoo Finance](https://finance.yahoo.com/technology/ai/articles/paypal-just-put-agent-checkout-183110322.html)
- Earlier (Jul 2026) PayPal T-commerce deal with claimed reach of 80M+ households. — [Digital Transactions](https://www.digitaltransactions.net/paypals-latest-t-commerce-deal-offers-potential-to-reach-more-than-80-million-households/)

**Mastercard / Visa**
- Braintree partnered with Mastercard Agent Pay; PayPal reportedly piloted Mastercard's Agent Pay Acceptance Framework. — [Finovate](https://finovate.com/4-companies-bringing-agentic-ai-to-checkout/); [bankingnewsai](https://www.bankingnewsai.com/fintech/paypal/agentic-commerce) (secondary)
- Visa Intelligent Commerce partners listed (Anthropic, Microsoft, Mistral, OpenAI, Samsung, Perplexity) do not include PayPal in the source found. — [Finovate](https://finovate.com/4-companies-bringing-agentic-ai-to-checkout/)

**Salesforce** — no 2025-2026 PayPal agentic item found in this research.

### Inferences
- PayPal's live footprint is concentrated in US AI surfaces where it is one of several rails (Stripe, Shopify, Google Pay compete). The highest-profile partner (OpenAI) changed its checkout model, weakening that announcement.

### Gaps
- No primary OpenAI or PayPal statement on current ChatGPT/PayPal status.
- Meta Muse: whether checkout is live, in which markets.
- Salesforce, Visa Intelligent Commerce: no PayPal-specific confirmation.

---

## Q4. Developer offerings for agents

### Takeaway
PayPal's shipped agent developer tools are the Agent Toolkit and MCP server (local and remote at mcp.paypal.com) — general PayPal API access for agents, GA. No shipped PayPal "agent token/mandate" API or official AP2 SDK was found; Agent Ready/Store Sync are access-by-request merchant programs.

### Cited Findings
- Remote MCP server at mcp.paypal.com (plus sandbox) with OAuth/client credentials; local via @paypal/mcp (Node 18+). — [PayPal Developer MCP server](https://developer.paypal.com/ai-tools/mcp-server)
- Agent Toolkit supports MCP, LangChain, CrewAI, OpenAI Agents SDK, Vercel AI SDK, Amazon Bedrock. — [PayPal Community Blog](https://developer.paypal.com/community/blog/paypal-agentic-ai-toolkit/); [PulseMCP](https://www.pulsemcp.com/servers/paypal-agent-toolkit)
- Third-party review: Agent Toolkit/MCP has hosted endpoints but "no automatic human-confirmation gate". — [Vorp Labs](https://vorplabs.com/agent-tools/paypal-agent-toolkit)
- Remote MCP server released April 2025 (secondary). — [bankingnewsai](https://www.bankingnewsai.com/fintech/paypal/agentic-commerce)
- AP2: spec published but production integrations limited as of Apr 2026; no official PayPal AP2 SDK found.
- Agentic commerce page points developers to PayPal VS Code extension for snippets. — [PayPal Developer](https://developer.paypal.com/agentic-commerce-services/about)

### Inferences
- Gap: no public agent-native payment primitives (scoped agent tokens, signed mandates, spending limits, human-approval gates) from PayPal comparable to Visa/Mastercard tokenized agent credentials or Stripe Link single-use cards.

### Gaps
- paypal.ai / docs.paypal.ai contents not fetched; any newer 2026 agentic API endpoints unverified.

---

## Q5. Strategy: earnings calls, exec statements, leadership

### Takeaway
New CEO Enrique Lores (from Mar 1, 2026) frames agentic commerce as a long-term opportunity where PayPal's role is trust/identity verification of buyer and merchant, but explicitly does not expect meaningful agentic volume until 2028. Near-term priorities are cost cuts, reorg into three units, Venmo/Braintree/financial services, and consumer rebuild. No 2026 investor day found.

### Cited Findings
- Lores became CEO Mar 1, 2026, succeeding Alex Chriss. — [Airwallex blog](https://www.airwallex.com/en-us/blog/paypal-acquisition) (secondary)
- Apr 29, 2026 reorg into Checkout Solutions & PayPal; Consumer Financial Services & Venmo; Payment Services & Crypto. Agentic commerce placed under Checkout Solutions & PayPal. — [SEC 8-K exhibit](https://www.sec.gov/Archives/edgar/data/0001633917/000119312526197533/d128781dex991.htm)
- Q2 2026 call: Lores described agentic payments as a longer-term source of profitable growth; simplified operating model around three businesses. — [Yahoo Finance Q2 transcript](https://finance.yahoo.com/quote/PYPL/earnings/PYPL-Q2-2026-earnings_call-660505.html)
- Q3 2026 call (Oct 27, 2026): revenue $8.6B (+2%), non-GAAP EPS $1.45 (+8%), TPV $487.1B (+6%), branded checkout TPV +1-2%; 2,000+ roles cut, three layers removed; $1.5B+ gross run-rate savings target. Lores: collaborating with Meta and other AI companies; called agentic commerce "a great opportunity"; PayPal's role to validate that buyer and merchant are real and able to transact. No mention of OpenAI, Google, Perplexity, Microsoft, Store Sync, Agent Ready, Honey. — [Motley Fool](https://www.fool.com/earnings/call-transcripts/2026/10/27/paypal-pypl-q3-2026-earnings-call-transcript/); [Yahoo Finance Q3 transcript](https://finance.yahoo.com/quote/PYPL/earnings/PYPL-Q3-2026-earnings_call-669270.html); [Yahoo Finance highlights](https://finance.yahoo.com/markets/stocks/articles/paypal-q3-earnings-call-highlights-150504624.html)
- Q3 call: on strategic-alternatives question, Lores said board would evaluate any offer objectively but plan is to execute independently. — [Motley Fool](https://www.fool.com/earnings/call-transcripts/2026/10/27/paypal-pypl-q3-2026-earnings-call-transcript/). A third-party blog references a Stripe/Advent $53B bid — unverified. — [Airwallex](https://www.airwallex.com/en-us/blog/paypal-acquisition)
- Oct 19, 2026 (Money20/20): "If we are realistic, the amount of commerce that is done through agents in '26, or that will be done in '27, is going to be relatively small"; no meaningful volume until 2028; trust "even more important in an agentic world". — [Payments Dive](https://www.paymentsdive.com/news/paypal-isnt-agile-enough-ceo-says/833449/)
- Prakhar Mehrotra is SVP, Head of AI (Jan 2026). — [PayPal investor release](https://investor.pypl.com/news-and-events/news-details/2026/From-Search-to-Checkout-PayPal-Supports-Trusted-AI-Checkout-with-Google/default.aspx)

### Inferences
- Strategic tone shifted from Chriss-era "launch everything agentic" (Oct 2025 wave) to Lores-era realism: partner-led, trust-layer positioning, revenue expectations pushed to 2028.

### Gaps
- Q1 2026 call content not found. No 2026 investor day found. Status of Chriss-era agentic leaders unknown.

---

## Q6. Sept-Oct 2026 specifically

### Takeaway
Recent activity is partnership-led (Meta Muse Sept 22; Glance Oct 15), plus a docs refresh (Oct 14), merchant guidance (Oct 16), CEO realism at Money20/20 (Oct 19) and Q3 call (Oct 27). None of these appears as a release on PayPal's own newsroom page 1 (Jul-Oct 2026), which lists no AI/agentic releases.

### Cited Findings
- Sept 22: Meta Muse partnership. — [PYMNTS](https://www.pymnts.com/news/artificial-intelligence/2026/meta-adds-paypal-muse-ai-assistant-global-checkout/)
- Oct 14: agentic commerce docs updated (access by request). — [PayPal Developer](https://developer.paypal.com/agentic-commerce-services/about)
- Oct 15: Glance native checkout. — [PYMNTS](https://www.pymnts.com/?p=4317643)
- Oct 16: merchant readiness article. — [PayPal BRC](https://www.paypal.com/us/brc/article/agentic-commerce-merchant-readiness-checklist)
- Oct 19: Money20/20 remarks. — [Payments Dive](https://www.paymentsdive.com/news/paypal-isnt-agile-enough-ceo-says/833449/)
- Oct 27: Q3 2026 results/call. — [PayPal Q3 release](https://s205.q4cdn.com/875401827/files/content_files/PYPL-3Q-26-Earnings-Release.pdf)
- Newsroom Jul 2-Oct 27, 2026 lists no AI/agent releases (items: Venmo credit card, holiday survey, Venmo NIL, tuition payments, PayPal World/Weixin Pay, Venmo on Google Play, Amazon BNPL DE/AT, EPC). — [PayPal newsroom](https://newsroom.paypal-corp.com/news)
- Context: Mastercard's Agent Connect (Sept 2026) also names Glance as an expected user. — [Stellagent](https://stellagent.ai/insights/glance-paypal-native-checkout)

### Inferences
- Absence of agentic press releases on PayPal's own newsroom in H2 2026 is consistent with lower-key, partner-announced approach under Lores.

### Gaps
- Official PayPal or Glance release text and launch date not fetched; Meta primary announcement not fetched.
