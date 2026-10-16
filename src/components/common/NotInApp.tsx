"use client";

import { useIsNativeApp } from "@/lib/platform/use-native-app";
import { NotInAppNotice } from "./NotInAppNotice";

/** Renders its children on the website; in the Android app shows "not available in the app" instead. */
export function NotInApp({ children }: { children: React.ReactNode }) {
  return useIsNativeApp() ? <NotInAppNotice /> : <>{children}</>;
}
