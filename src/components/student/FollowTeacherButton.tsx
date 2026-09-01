"use client";

import { useEffect, useState } from "react";

/**
 * Compact follow/unfollow pill for a teacher, used wherever a student
 * encounters one (currently: the lecture player header). Only ever shows
 * the AGGREGATE follower count — see the privacy note on the API route,
 * src/app/api/teachers/[id]/follow/route.ts — never a follower list.
 */
export function FollowTeacherButton({ teacherId }: { teacherId: string }) {
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/teachers/${teacherId}/follow`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json.success) return;
        setFollowing(Boolean(json.data.following));
        setFollowerCount(json.data.followerCount);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  async function toggle() {
    if (busy || following === null) return;
    setBusy(true);
    const nextFollowing = !following;
    setFollowing(nextFollowing);
    try {
      const res = await fetch(`/api/teachers/${teacherId}/follow`, {
        method: nextFollowing ? "POST" : "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        setFollowing(Boolean(json.data.following));
        setFollowerCount(json.data.followerCount);
      } else {
        setFollowing(!nextFollowing);
      }
    } catch {
      setFollowing(!nextFollowing);
    } finally {
      setBusy(false);
    }
  }

  if (following === null) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors disabled:opacity-60 ${
        following
          ? "bg-primary/10 text-primary hover:bg-red-500/10 hover:text-red-500"
          : "bg-surface-container-high text-on-surface-variant hover:bg-primary/10 hover:text-primary"
      }`}
    >
      <span className="material-symbols-outlined text-sm">{following ? "how_to_reg" : "person_add"}</span>
      {following ? "Following" : "Follow"}
      {followerCount !== null && <span className="opacity-70">· {followerCount}</span>}
    </button>
  );
}
