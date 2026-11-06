import type { Metadata, Viewport } from "next";
import { Outfit, Figtree } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-display" });
const figtree = Figtree({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "M.E.G.A",
  description: "Make Eating Great Again: plan the week's meals together.",
  applicationName: "M.E.G.A",
  appleWebApp: { capable: true, title: "M.E.G.A", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/favicon-48.png", sizes: "48x48", type: "image/png" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F7922A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${outfit.variable} ${figtree.variable}`}>
      <body>{children}</body>
    </html>
  );
}
