import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Goldies and the Roost Weekly Recap",
  description: "Internal weekly recap tool for Goldies and the Roost",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
