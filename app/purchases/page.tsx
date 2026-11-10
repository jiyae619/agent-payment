import Link from "next/link";
import type { Metadata } from "next";
import Purchases from "./purchases";

export const metadata: Metadata = {
  title: "Your purchases · Okay-Pay",
  description: "What the assistant bought for you, with a refund for anything you changed your mind about.",
};

export default function PurchasesPage() {
  return (
    <main className="page">
      <header className="brand">
        <h1>Your purchases</h1>
        <nav className="brand-nav">
          <Link href="/">Shop</Link>
          <span className="chip-sandbox">Sandbox</span>
        </nav>
      </header>
      <Purchases />
    </main>
  );
}
