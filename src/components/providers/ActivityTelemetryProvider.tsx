"use client";

import React, { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

declare global {
  interface Window {
    trackActivity?: (action: string, metadata?: Record<string, unknown>) => void;
  }
}

function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    let vid = localStorage.getItem("ap_visitor_id");
    if (!vid) {
      vid = "v_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now().toString(36);
      localStorage.setItem("ap_visitor_id", vid);
    }
    return vid;
  } catch {
    return "v_anon_" + Date.now();
  }
}

export function ActivityTelemetryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const pageStartTimeRef = useRef<number>(Date.now());
  const prevPathRef = useRef<string>("");

  const sendTelemetry = (payload: {
    path: string;
    title?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    durationSeconds?: number;
    metadata?: Record<string, unknown>;
  }) => {
    try {
      const visitorId = getOrCreateVisitorId();
      const body = JSON.stringify({
        visitorId,
        path: payload.path,
        title: payload.title || (typeof document !== "undefined" ? document.title : ""),
        action: payload.action || "PAGE_VIEW",
        entityType: payload.entityType,
        entityId: payload.entityId,
        durationSeconds: payload.durationSeconds || 0,
        metadata: {
          ...(payload.metadata || {}),
          queryString: searchParams ? searchParams.toString() : "",
          referrer: typeof document !== "undefined" ? document.referrer : "",
        },
      });

      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/telemetry/track", blob);
      } else {
        fetch("/api/telemetry/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Non-blocking telemetry
    }
  };

  // Expose global window helper for explicit tracking
  useEffect(() => {
    window.trackActivity = (action: string, metadata?: Record<string, unknown>) => {
      sendTelemetry({
        path: pathname || window.location.pathname,
        title: document.title,
        action,
        metadata,
      });
    };
    return () => {
      delete window.trackActivity;
    };
  }, [pathname, searchParams]);

  // Track page navigation and dwell duration
  useEffect(() => {
    if (!pathname) return;

    // Flush duration for previous path
    if (prevPathRef.current && prevPathRef.current !== pathname) {
      const durationSeconds = Math.round((Date.now() - pageStartTimeRef.current) / 1000);
      if (durationSeconds > 1) {
        sendTelemetry({
          path: prevPathRef.current,
          action: "PAGE_DWELL",
          durationSeconds,
        });
      }
    }

    // Start timer for new path
    pageStartTimeRef.current = Date.now();
    prevPathRef.current = pathname;

    // Send page view event
    sendTelemetry({
      path: pathname,
      action: "PAGE_VIEW",
      title: typeof document !== "undefined" ? document.title : pathname,
    });

    const handleBeforeUnload = () => {
      const dwell = Math.round((Date.now() - pageStartTimeRef.current) / 1000);
      if (dwell > 0) {
        sendTelemetry({
          path: pathname,
          action: "PAGE_DWELL",
          durationSeconds: dwell,
        });
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [pathname, searchParams, session?.user?.id]);

  return <>{children}</>;
}
