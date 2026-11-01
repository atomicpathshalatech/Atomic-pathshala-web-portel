"use client";

import { useIsNativeApp } from "@/lib/platform/use-native-app";

/**
 * Frame of the login / register / password pages. On the website: the site
 * header and footer around the form. In the Android app: nothing but the
 * form on a clean screen with the Atomic Pathshala logo in the background.
 */
export function AuthShell({ header, footer, children }: { header: React.ReactNode; footer: React.ReactNode; children: React.ReactNode }) {
  const native = useIsNativeApp();
  if (native) {
    return (
      <main className="relative min-h-[100dvh] flex items-center justify-center px-4 py-8 bg-white overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset as a faint backdrop */}
        <img src="/brand/logo.png" alt="" aria-hidden className="pointer-events-none select-none absolute w-[85vw] max-w-md opacity-[0.06]" />
        <div className="relative w-full flex justify-center">{children}</div>
      </main>
    );
  }
  return (
    <>
      {header}
      <main className="pt-24 min-h-[80vh] flex items-center justify-center bg-surface-container-low/30 px-margin-mobile md:px-margin-desktop py-stack-lg">
        {children}
      </main>
      {footer}
    </>
  );
}
