# OKay-Pay: build spec for the real app

Date: 2026-11-10. Deadline: Nov 12, 12:00 PT. Source of truth for the design: `html-previews/okay-pay.html` (walkthrough) and `html-previews/okay-pay-case-study.html`.
These decisions were settled with the user in a design review. Build them in this order and stop where time runs out.

## Must-haves before submission

### 1. One approval screen (version B)
- Replace the read-back plus separate questions with one screen: a one-line "I'll buy …" summary, guesses shown as pre-filled chips, and the full rule list folded under "See all N rules". One Approve button.
- A guess is any rule the AI had to interpret. The draft needs one new field to mark it (for example `guess: boolean` on must-haves and preferences in `lib/draft-schema.ts`). `source_phrase` stays as is.
- Files: `app/assistant.tsx`, `lib/readback.ts`, `lib/draft-schema.ts`.
- Done when: Day 1 request reaches "Approved" in one tap, and tapping the chip changes the guess before approving.

### 2. Three levels, picked with each request
- Under the request box: **Check guesses** (Approve stays disabled until each guess is confirmed), **Allow guesses** (default; chips pre-filled), **Auto-shop** (best guesses used, no chips to confirm).
- Every level still asks before anything that can't be undone (see 4).
- Files: `app/assistant.tsx`; carry the level in the sealed approval (`lib/approval.ts`).
- Done when: the level is shown on the approval screen and stored in the proof.

### 3. The agent picks and pays; the receipt shows the rest
- No choose step. Rank options by the shopper's own words first, proven by quotes from the listing (for example "for trails mostly" favors a listing that says "Trail"), then by price. Among equal matches, cheapest wins.
- After the hold and the rule check, capture and show the receipt automatically. No countdown, no extra tap, no "next" button after shopping.
- The receipt card has ‹ › arrows to browse the options it didn't buy, each with a plain reason ("Not picked: a road shoe, and you said trails mostly, $37.82 more").
- "Switch to this one" refunds the first capture in full, then holds and captures the new option under the same sealed plan. Switching to an option outside an earlier answer is the shopper's choice: allowed, logged in the proof.
- Cancel is available while it shops, before any money is held.
- No new instructions once a purchase starts. Cancel is always available. A change means a new request.
- Files: `lib/pick-core.ts` (`optionsForAI`, ranking), `lib/pick.ts`, `app/shopping.tsx`, `app/api/shop/*`.
- Done when: Day 1 shoes go from Approve to a receipt with zero further taps, and ‹ › plus Switch work on the receipt.

### 4. "Can it be undone?" is the only question
- Ask before paying only when: the listing or store says final sale or no returns, the item is a non-returnable kind (personalized, perishable, tickets, digital), or no return policy was found. "Not found" counts as can't be undone.
- Remove the default "ask before a store you didn't name" (`DEFAULT_CHECKINS` in `lib/mandate.ts`, set in `lib/draft-schema.ts` `normalizeDraft`). Keep explicit store rules from the shopper ("only from X", "never from Y") as hard rules that nothing mid-purchase can change.
- Show evidence labels, not percentages:
  - "Returns: stated in the listing"
  - "Returns: found on the store's policy page" (`lib/policy.ts` `findPolicy`)
  - "Returns: not found, treated as final sale, please check"
- A must-have the listing doesn't prove, on a returnable item: prefer a fully proven option; if none, buy it and say so on the item card and in the PayPal order's item description. No question beforehand. Today this releases the hold (`lib/enforce.ts` `decide`), so this is a behavior change.
- Files: `lib/enforce.ts`, `lib/mandate.ts`, `lib/draft-schema.ts`, `lib/policy.ts`, `app/shopping.tsx`.

### 5. Proof ID on every PayPal order, with a merchant verify view
- Add `custom_id` (proof ID, up to 127 chars) to `purchase_units` in `vaultedHoldOrderBody` (`lib/paypal.ts`). Put the returns label and any "not confirmed" note in the item `description`.
- A read-only verify page for the proof ID shows: the rules, the listing quotes they matched, any swap or override, the level, and the hold-to-capture timeline. Never the shopper's raw request.
- The raw request is stored encrypted. The shopper can choose to share it with PayPal when they open a dispute.
- Files: `lib/paypal.ts`, `lib/proof.ts` (`buildProof`, `sealProof`), new route under `app/api/proof/`, a small verify page.

## Stretch (prototype only if time runs out)
- Earned trust: remember what a guess meant ("the usual" dish soap = unscented); suggest Auto-shop per category after repeated OKs, which fills in remembered guesses; a "not what I meant" refund drops that category back one level right away. History already lives in the browser (`lib/history.ts`).
- Encrypted raw request with shopper-controlled release in a dispute.
- The "can't be undone" scenario in the real How it works page (`app/how-it-works/diagram.tsx`).

## Not changing
- Orders v2 AUTHORIZE, then capture or void. Refund stays a full refund from the receipt.
- Gift cards, prepaid cards, crypto and money transfers stay blocked before any PayPal call.
- Store-page text can never become a rule, an item or a store.

## Check before submitting
- Day 1 shoes: one tap to approve, then the receipt appears with no other tap.
- A personalized item asks before paying at every level.
- An excluded store is never picked even when it's the cheapest.
- The gift-card trap still makes no PayPal call.
- The PayPal order shows `custom_id` and the returns note in the sandbox dashboard.
