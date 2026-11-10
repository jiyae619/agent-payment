import Link from "next/link";
import type { Metadata } from "next";
import Verify from "./verify";

export const metadata: Metadata = {
  title: "Check a purchase · Shopping Assistant",
  description: "For stores and PayPal: check a purchase record against its PayPal order, without seeing the shopper's own words.",
};

export default function VerifyPage() {
  return (
    <main className="page">
      <header className="brand">
        <h1>Check a purchase</h1>
        <nav className="brand-nav">
          <Link href="/">Try it</Link>
          <span className="chip-sandbox">Sandbox</span>
        </nav>
      </header>
      <section className="hero">
        <h2>Was this purchase made within the shopper&apos;s rules?</h2>
        <p className="sub">For stores and PayPal. Open the shopper&apos;s saved proof file. It shows what they approved, what was checked and how the money moved. Their own request isn&apos;t in the file.</p>
      </section>
      <Verify />
    </main>
  );
}
