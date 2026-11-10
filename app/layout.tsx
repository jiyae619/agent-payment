import type { Metadata } from "next";
import { Atkinson_Hyperlegible, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Atkinson Hyperlegible: designed for low-vision readers, chosen for non-technical shoppers.
// IBM Plex Mono: money and the store's quoted words, so figures line up and quotes read as quotes.
const sans = Atkinson_Hyperlegible({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "700"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["500"] });

export const metadata: Metadata = {
  title: "Okay-Pay",
  description: "Hand off a purchase in your own words, and get proof it matches what you meant.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} antialiased`}>
      <body>
        {children}
        <footer className="site-foot">Okay-Pay is a hackathon demo on PayPal sandbox. Not affiliated with or endorsed by PayPal.</footer>
      </body>
    </html>
  );
}
