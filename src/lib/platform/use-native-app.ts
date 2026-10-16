"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "./index";

/**
 * True inside the Android app (after mount; false during SSR and in browsers).
 *
 * Google Play only allows selling digital content (batches, subscriptions)
 * inside an app through Play Billing, so the app hides purchases: no Store,
 * no Buy buttons, no checkout. Students who already have access use
 * everything as usual.
 */
export function useIsNativeApp(): boolean {
  const [native, setNative] = useState(false);
  useEffect(() => setNative(isNativeApp()), []);
  return native;
}
