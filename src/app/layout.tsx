import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import "./globals.css";
import { AuthSessionProvider } from "@/components/providers/AuthSessionProvider";
import { CapacitorProvider } from "@/components/providers/CapacitorProvider";
import { PwaProvider } from "@/components/pwa/PwaProvider";
import { DisableZoomProvider } from "@/components/providers/DisableZoomProvider";
import { ActivityTelemetryProvider } from "@/components/providers/ActivityTelemetryProvider";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  display: "swap",
  weight: "400 700",
  variable: "--font-inter",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#090D16" },
  ],
  colorScheme: "light",
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://atomicpathshala.in"),
  title: {
    default: "Atomic Pathshala — NEET, JEE & Board Exam Preparation",
    template: "%s | Atomic Pathshala",
  },
  description:
    "India's premier education accelerator for NEET UG, JEE Main, and Foundation courses with chapter-wise PYQs, live interactive classes, and verified faculty.",
  applicationName: "Atomic Pathshala",
  appleWebApp: {
    capable: true,
    title: "Atomic Pathshala",
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "https://atomicpathshala.in",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://atomicpathshala.in",
    siteName: "Atomic Pathshala",
    title: "Atomic Pathshala — NEET, JEE & Board Exam Preparation",
    description:
      "India's premier education accelerator for NEET UG, JEE Main, and Foundation courses with chapter-wise PYQs, live interactive classes, and verified faculty.",
    images: [{ url: "/brand/logo.png", width: 1200, height: 630, alt: "Atomic Pathshala" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Atomic Pathshala — NEET, JEE & Board Exam Preparation",
    description:
      "India's premier education accelerator for NEET UG, JEE Main, and Foundation courses with chapter-wise PYQs, live interactive classes, and verified faculty.",
    images: ["/brand/logo.png"],
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GSC_VERIFICATION || undefined,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} scroll-smooth w-full min-h-screen-safe`}
      suppressHydrationWarning
    >
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
        />
        <meta name="color-scheme" content="light dark" />
        <meta name="HandheldFriendly" content="true" />
        <meta name="format-detection" content="telephone=no" />
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
        <DisableZoomProvider />
        <AuthSessionProvider>
          <CapacitorProvider>
            <Suspense fallback={null}>
              <ActivityTelemetryProvider>
                {children}
              </ActivityTelemetryProvider>
            </Suspense>
          </CapacitorProvider>
        </AuthSessionProvider>
        <PwaProvider />
        <Analytics />
        <Toaster richColors position="top-center" />
        <SpeedInsights />
      </body>
    </html>
  );
}
