import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

/**
 * Inter is the app's body/label font (used on effectively every screen).
 * Self-hosting it via next/font removes a render-blocking request to
 * fonts.googleapis.com/fonts.gstatic.com on every page and ships a matched
 * `size-adjust` fallback so there is no layout shift when it swaps in.
 * Only the `latin` subset actually used is inlined.
 *
 * Geist (display/headline font) stays on the external stylesheet below —
 * next/font in this Next version doesn't yet provide it.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});
import { AuthSessionProvider } from "@/components/providers/AuthSessionProvider";
import { CapacitorProvider } from "@/components/providers/CapacitorProvider";
import { FloatingGuruWidget } from "@/components/shared/FloatingGuruWidget";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#090D16",
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  title: {
    default: "Atomic Pathshala | Accelerating Excellence",
    template: "%s | Atomic Pathshala",
  },
  description:
    "India's premium accelerator for NEET, JEE, and Foundation courses — live classes, AI doubt solving, test series, and 1-on-1 mentorship.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} scroll-smooth w-full min-h-screen-safe`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Geist (display font) + Material Symbols (icon font). Inter is
            self-hosted by next/font above. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="w-full min-h-screen-safe bg-background text-on-background font-body-md overflow-x-hidden antialiased">
        <AuthSessionProvider>
          <CapacitorProvider>
            {children}
            <FloatingGuruWidget />
          </CapacitorProvider>
        </AuthSessionProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
