"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BatchTabSwitcher({
  myBatchesCount,
  storeCount,
}: {
  myBatchesCount?: number;
  storeCount?: number;
}) {
  const pathname = usePathname();
  const isStore = pathname.startsWith("/store");

  return (
    <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit mb-6 border border-slate-200/80 dark:border-slate-700">
      <Link
        href="/courses"
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
          !isStore
            ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        }`}
      >
        <span className="material-symbols-outlined text-base">school</span>
        <span>My Batches</span>
        {myBatchesCount !== undefined && (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              !isStore
                ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            }`}
          >
            {myBatchesCount}
          </span>
        )}
      </Link>

      <Link
        href="/store"
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
          isStore
            ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        }`}
      >
        <span className="material-symbols-outlined text-base">storefront</span>
        <span>Store</span>
        {storeCount !== undefined && (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              isStore
                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            }`}
          >
            {storeCount}
          </span>
        )}
      </Link>
    </div>
  );
}
