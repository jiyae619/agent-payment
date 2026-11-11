// Store policies (return terms) for the product checker and the receipt. One interface,
// findPolicy(store, topic), so the backend can grow from this small file to a search index over
// every store without the checker or receipt changing.
//
// The text is the store's own words, never a summary: the checker must quote it, and the receipt
// shows where it came from and when it was read. No policy found means "couldn't check".

import data from "../data/policies.json" with { type: "json" };

export type PolicyTopic = "returns";

export type Policy = {
  store: string; // retailer domain, e.g. "nike.com"
  topic: PolicyTopic;
  text: string; // copied word for word from the store's page
  url: string; // the store's own policy page
  retrieved: string; // date the text was read, YYYY-MM-DD
};

const POLICIES = data.policies as Policy[];

// "www.nike.com" and "store.nike.com" are Nike; "notnike.com" is not.
function sameStore(domain: string, store: string): boolean {
  const d = domain.trim().toLowerCase().replace(/^www\./, "");
  return d === store || d.endsWith(`.${store}`);
}

export function findPolicy(store: string, topic: PolicyTopic): Policy | null {
  return POLICIES.find((p) => p.topic === topic && sameStore(store, p.store)) ?? null;
}
