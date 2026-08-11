import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { AuthSessionProvider } from "@/components/providers/AuthSessionProvider";

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
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Geist:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-on-background font-body-md overflow-x-hidden antialiased">
        <AuthSessionProvider>{children}</AuthSessionProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
