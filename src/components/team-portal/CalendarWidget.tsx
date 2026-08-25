"use client";

import { useMemo, useState } from "react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Month-grid calendar, driven entirely by props — no `new Date()` calls
 * during render, so server and client agree on what "today" is (it's
 * parsed once from `todayIso`, computed server-side and passed down,
 * rather than read fresh in the browser which could disagree with the
 * server-rendered markup by a few ms/across a midnight boundary and cause
 * a hydration mismatch).
 */
export function CalendarWidget({
  todayIso,
  events,
}: {
  /** YYYY-MM-DD, computed server-side */
  todayIso: string;
  /** Any day with a matching YYYY-MM-DD gets a dot marker. */
  events: { date: string }[];
}) {
  // Cast to a fixed tuple: todayIso is always a well-formed "YYYY-MM-DD"
  // string computed server-side (per the component doc comment above), so
  // all three parts are guaranteed present.
  const [today_y, today_m, today_d] = todayIso.split("-").map(Number) as [number, number, number];
  const [viewYear, setViewYear] = useState(today_y);
  const [viewMonth, setViewMonth] = useState(today_m - 1); // 0-indexed

  const markedDates = useMemo(() => new Set(events.map((e) => e.date)), [events]);

  const cells = useMemo(() => {
    const firstOfMonth = new Date(Date.UTC(viewYear, viewMonth, 1));
    const startWeekday = firstOfMonth.getUTCDay();
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    const daysInPrevMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();

    const out: { day: number; iso: string; outsideMonth: boolean }[] = [];
    for (let i = startWeekday - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const m = viewMonth === 0 ? 12 : viewMonth;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      out.push({ day, iso: `${y}-${pad(m)}-${pad(day)}`, outsideMonth: true });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      out.push({ day, iso: `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`, outsideMonth: false });
    }
    let nextDay = 1;
    while (out.length % 7 !== 0) {
      const m = viewMonth === 11 ? 1 : viewMonth + 2;
      const y = viewMonth === 11 ? viewYear + 1 : viewYear;
      out.push({ day: nextDay, iso: `${y}-${pad(m)}-${pad(nextDay)}`, outsideMonth: true });
      nextDay++;
    }
    return out;
  }, [viewYear, viewMonth]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  const todayIsoNormalized = `${today_y}-${pad(today_m)}-${pad(today_d)}`;

  return (
    <div className="glass-card rounded-xl p-stack-md shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-headline-md text-headline-md text-on-surface">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
            aria-label="Previous month"
          >
            <span className="material-symbols-outlined text-lg">chevron_left</span>
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
            aria-label="Next month"
          >
            <span className="material-symbols-outlined text-lg">chevron_right</span>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-label-sm text-on-surface-variant font-bold mb-2">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-2 text-center text-sm sm:text-body-md">
        {cells.map((c, i) => {
          const isToday = c.iso === todayIsoNormalized;
          const isMarked = markedDates.has(c.iso);
          return (
            <div
              key={i}
              className={`py-2 relative ${c.outsideMonth ? "text-outline" : "text-on-surface"} ${
                isToday ? "bg-primary/10 rounded-full font-bold text-primary ring-1 ring-primary/30" : ""
              }`}
            >
              {c.day}
              {isMarked && !c.outsideMonth && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-secondary rounded-full" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
