import Script from "next/script";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { AuthShell } from "@/components/auth/AuthShell";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://verify.msg91.com/otp-provider.js" strategy="afterInteractive" />
      {/* Website: header + footer around the form. Android app: the form alone (AuthShell). */}
      <AuthShell header={<Navbar />} footer={<Footer />}>
        {children}
      </AuthShell>
    </>
  );
}
