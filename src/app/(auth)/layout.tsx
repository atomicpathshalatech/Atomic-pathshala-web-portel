import Script from "next/script";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://verify.msg91.com/otp-provider.js" strategy="afterInteractive" />
      <Navbar />
      <main className="pt-24 min-h-[80vh] flex items-center justify-center bg-surface-container-low/30 px-margin-mobile md:px-margin-desktop py-stack-lg">
        {children}
      </main>
      <Footer />
    </>
  );
}
