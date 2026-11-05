import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Make My Marriage | One wedding, one shared space",
  description: "Bring wedding events, tasks, expenses, guests, RSVPs, and the guest experience together in one thoughtful planning space.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/favicon-512.png", sizes: "512x512", type: "image/png" }]
  },
  manifest: "/site.webmanifest"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
