import { notFound } from "next/navigation";

// The Day 1 test bench is a developer page. It isn't served on the public demo.
export default function Day1Layout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
