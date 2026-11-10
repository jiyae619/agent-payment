// Run: npm test
// Guesses are the rules the shopper never literally said. If a guess were mistaken for their own
// words, the approval screen would hide the one thing they most need to check.

import { test } from "node:test";
import assert from "node:assert/strict";
import { isGuess, setGuess, guesses } from "../lib/guesses.ts";
import type { Mandate } from "../lib/mandate.ts";

test("a value the shopper said word for word is theirs, not a guess", () => {
  assert.equal(isGuess("size", "8", "size 8"), false);
  assert.equal(isGuess("waterproof", "yes", "Waterproof"), false);
  assert.equal(isGuess("free returns", "yes", "Free returns please"), false);
  assert.equal(isGuess("scent", "unscented", "unscented if you can"), false);
});

test("an interpreted value, or one with no source phrase, is a guess", () => {
  assert.equal(isGuess("color", "black, grey or navy", "nothing too flashy"), true);
  assert.equal(isGuess("scent", "unscented", "no smell"), true);
  assert.equal(isGuess("size", "8", null), true);
});

test("changing a guess makes it the shopper's own words, so it stops being a guess", () => {
  const m = { ext: { must_haves: [{ attr: "color", value: "black, grey or navy", source_phrase: "nothing too flashy" }], conditions_of_sale: [] } } as unknown as Mandate;
  assert.equal(guesses(m).length, 1);
  const changed = setGuess(m, { list: "must_haves", index: 0 }, "black");
  assert.equal(changed.ext.must_haves[0].value, "black");
  assert.equal(guesses(changed).length, 0);
});
