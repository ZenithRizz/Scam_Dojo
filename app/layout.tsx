import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scam Dojo",
  description: "Practice spotting scams before scammers find you."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}