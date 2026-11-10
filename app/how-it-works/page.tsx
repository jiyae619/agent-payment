import Link from "next/link";
import type { Metadata } from "next";
import Diagram from "./diagram";

export const metadata: Metadata = {
  title: "How it works · Okay-Pay",
  description: "What happens behind the screen: where the AI helps, where code decides, and when PayPal moves money.",
};

export default function HowItWorks() {
  return (
    <main className="page wide">
      <header className="brand">
        <h1>How it works</h1>
        <nav className="brand-nav">
          <Link href="/">Try it</Link>
          <span className="chip-sandbox">Sandbox</span>
        </nav>
      </header>
      <section className="hero">
        <h2>The AI suggests and explains. You choose, and plain code decides whether PayPal can charge.</h2>
        <p className="sub">Four runs, one for each way a purchase can end: it buys, it asks you, it stops itself, or it blocks an attack. Pick one and press Play to follow it through the system, or tap any box.</p>
      </section>
      <Diagram />
    </main>
  );
}
