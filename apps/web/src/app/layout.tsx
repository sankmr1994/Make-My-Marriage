import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Make My Marriage",
  description: "One workspace for planning an Indian wedding."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
