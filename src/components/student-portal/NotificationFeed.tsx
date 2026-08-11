"use client";

import { useState } from "react";

type Category = "all" | "academic" | "content" | "tests";

// Sample content — real notifications will come from the `Notification`
// table once team-portal actions (scheduling classes, publishing DPPs,
// grading tests, etc.) start writing to it.
const NOTIFICATIONS: {
  id: string;
  category: Exclude<Category, "all">;
  icon: string;
  iconColor: string;
  title: string;
  time: string;
  body: string;
  action: string;
  actionIcon: string;
  accent?: boolean;
}[] = [
  {
    id: "1",
    category: "academic",
    icon: "videocam",
    iconColor: "text-primary bg-primary/10",
    title: "Target NEET 2025: Physical Chemistry",
    time: "2 mins ago",
    body: "Your live session with Dr. Vikram Singh is about to start. Topics: Thermodynamics & Equilibrium.",
    action: "Join Now",
    actionIcon: "arrow_forward",
    accent: true,
  },
  {
    id: "2",
    category: "content",
    icon: "description",
    iconColor: "text-secondary bg-secondary/10",
    title: "New DPP & Handwritten Notes",
    time: "1 hour ago",
    body: "Daily Practice Problem (DPP) Set #42 for 'Human Anatomy' has been uploaded to your course dashboard.",
    action: "View Notes",
    actionIcon: "download",
  },
  {
    id: "3",
    category: "tests",
    icon: "military_tech",
    iconColor: "text-tertiary bg-tertiary/10",
    title: "Test Results: All India Mock Test #05",
    time: "4 hours ago",
    body: "Congratulations! You ranked in the Top 2% nationally. Check your detailed performance analysis.",
    action: "Analyze Report",
    actionIcon: "analytics",
    accent: true,
  },
  {
    id: "4",
    category: "academic",
    icon: "history",
    iconColor: "text-on-surface-variant bg-outline-variant/20",
    title: "Class Ended: Organic Chemistry",
    time: "Yesterday",
    body: "Missed the live session? The recording and transcript for 'Reaction Mechanisms' are now available.",
    action: "Watch Recording",
    actionIcon: "play_circle",
  },
  {
    id: "5",
    category: "tests",
    icon: "timer",
    iconColor: "text-error bg-error-container",
    title: "Upcoming Test: Biology Unit Test",
    time: "Tomorrow, 10:00 AM",
    body: "Don't forget to complete your revision. 50 MCQ questions on 'Plant Physiology'.",
    action: "Syllabus Details",
    actionIcon: "info",
  },
];

const FILTERS: { key: Category; label: string; icon: string }[] = [
  { key: "all", label: "All Notifications", icon: "all_inclusive" },
  { key: "academic", label: "Academic", icon: "school" },
  { key: "content", label: "Content", icon: "menu_book" },
  { key: "tests", label: "Tests", icon: "assignment_turned_in" },
];

export function NotificationFeed() {
  const [filter, setFilter] = useState<Category>("all");

  const visible =
    filter === "all" ? NOTIFICATIONS : NOTIFICATIONS.filter((n) => n.category === filter);

  return (
    <div className="flex flex-col md:flex-row gap-gutter max-w-6xl">
      <div className="rounded-xl bg-primary-container/10 border border-primary/20 px-4 py-3 text-label-sm font-label-sm text-on-surface-variant md:hidden">
        Sample content — real notifications go live as class/DPP/test actions start firing.
      </div>

      {/* Sidebar filters */}
      <aside className="w-full md:w-1/4 space-y-stack-md">
        <div className="glass-card rounded-xl p-stack-md">
          <h2 className="font-headline-md text-headline-md mb-stack-md">Notifications</h2>
          <div className="space-y-stack-sm">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`w-full flex items-center justify-between p-stack-sm rounded-lg font-label-md transition-colors ${
                  filter === f.key
                    ? "bg-primary-container text-on-primary-container"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined">{f.icon}</span>
                  {f.label}
                </span>
                {f.key === "all" && (
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                    {NOTIFICATIONS.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="hidden md:block rounded-xl bg-primary-container/10 border border-primary/20 px-4 py-3 text-label-sm font-label-sm text-on-surface-variant">
          Sample content — real notifications go live as class/DPP/test actions start firing.
        </div>
      </aside>

      {/* Feed */}
      <div className="w-full md:w-3/4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-stack-md">
          <span className="font-headline-lg text-headline-lg">Latest Updates</span>
          <button className="text-primary font-label-md hover:underline self-start sm:self-auto">Mark all as read</button>
        </div>

        <div className="space-y-stack-md">
          {visible.map((n) => (
            <div
              key={n.id}
              className={`glass-card rounded-xl p-stack-md transition-all duration-300 ${
                n.accent ? "border-l-4 border-l-primary" : ""
              }`}
            >
              <div className="flex gap-stack-md">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${n.iconColor}`}>
                  <span className="material-symbols-outlined">{n.icon}</span>
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-1 gap-1 sm:gap-4">
                    <h4 className="font-label-md text-label-md text-on-surface">{n.title}</h4>
                    <span className="text-label-sm text-outline whitespace-nowrap">{n.time}</span>
                  </div>
                  <p className="text-body-md text-on-surface-variant mb-stack-md">{n.body}</p>
                  <button className="w-full sm:w-auto justify-center bg-primary text-on-primary px-stack-md py-2 rounded-lg font-label-md flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all">
                    {n.action}
                    <span className="material-symbols-outlined text-sm">{n.actionIcon}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {visible.length === 0 && (
            <div className="glass-card rounded-xl p-stack-lg text-center text-on-surface-variant font-body-md">
              No notifications in this category.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
