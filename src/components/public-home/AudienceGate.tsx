"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Audience } from "@/lib/home-templates";

type Who = { signedIn: boolean; student: boolean; paid: boolean };

// One request per page load, shared by every gated section.
let whoPromise: Promise<Who> | null = null;
function loadWho(): Promise<Who> {
  whoPromise ??= fetch("/api/home/audience", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : { signedIn: false, student: false, paid: false }))
    .catch(() => ({ signedIn: false, student: false, paid: false }));
  return whoPromise;
}

function matches(audience: Audience, who: Who): boolean {
  switch (audience) {
    case "GUEST":
      return !who.signedIn;
    case "STUDENT":
      return who.student;
    case "FREE":
      return who.student && !who.paid;
    case "PAID":
      return who.student && who.paid;
    default:
      return true;
  }
}

/** Shows a homepage section only to the audience chosen in the Website Builder. */
export function AudienceGate({ audience, children }: { audience: Audience; children: ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let alive = true;
    loadWho().then((who) => alive && setShow(matches(audience, who)));
    return () => {
      alive = false;
    };
  }, [audience]);
  return show ? <>{children}</> : null;
}
