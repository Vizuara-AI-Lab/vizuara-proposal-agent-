import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vizuara — Proposal Intake",
  description: "Meeting-to-proposal intake for Vizuara Technologies",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
