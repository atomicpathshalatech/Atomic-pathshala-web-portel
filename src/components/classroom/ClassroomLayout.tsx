"use client";

import { useEffect, useState, type ReactNode } from "react";

export type SidebarTabKey = "chat" | "doubt" | "hand-raise" | "students";

const TABS: { key: SidebarTabKey; label: string; icon: string }[] = [
  { key: "chat", label: "Chat", icon: "chat" },
  { key: "doubt", label: "Doubt", icon: "help" },
  { key: "hand-raise", label: "Hand Raise", icon: "back_hand" },
  { key: "students", label: "Students", icon: "groups" },
];

const SIDEBAR_COLLAPSED_KEY = "classroom-sidebar-collapsed";

/**
 * Desktop/tablet: video + a collapsible side grid column. Mobile portrait:
 * video on top, sidebar becomes a tab switcher below it (not a squeezed
 * side panel). Mobile landscape: video reduced height, sidebar as a
 * slide-up bottom drawer. Picked entirely via Tailwind responsive classes
 * (no JS viewport detection) so it stays SSR-safe with no hydration
 * flicker.
 */
export function ClassroomLayout({
  video,
  panels,
  extraHeader,
}: {
  video: ReactNode;
  panels: Record<SidebarTabKey, ReactNode>;
  extraHeader?: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTabKey>("chat");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      // localStorage may be unavailable (private mode); default to expanded.
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // best-effort only
      }
      return next;
    });
  };

  return (
    <div className="w-full h-full min-h-0 bg-[#0a0b12]">
      {/* Desktop / tablet: side-by-side grid */}
      <div
        className="hidden md:grid gap-3 p-3 h-full min-h-0"
        style={{ gridTemplateColumns: collapsed ? "1fr" : "1fr 340px" }}
      >
        <div className="min-h-0 flex flex-col gap-2">
          {extraHeader}
          <div className="flex-1 min-h-0">{video}</div>
        </div>
        {!collapsed && (
          <div className="min-h-0 flex flex-col rounded-2xl border border-[#2d2e3b] bg-[#0d0e16] overflow-hidden">
            <SidebarTabs activeTab={activeTab} onChange={setActiveTab} onToggleSidebar={toggleCollapsed} collapsed={false} />
            <div className="flex-1 min-h-0 overflow-hidden">{panels[activeTab]}</div>
          </div>
        )}
        {collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="fixed bottom-6 right-6 z-20 p-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-xl transition"
            title="Show sidebar"
          >
            <span className="material-symbols-outlined">left_panel_open</span>
          </button>
        )}
      </div>

      {/* Mobile (below md): orientation variants are nested INSIDE this
          md:hidden wrapper rather than combined on the same element as it —
          `md:hidden` and `portrait:flex` are independent media queries that
          can both match at once (e.g. a tablet in portrait at >=768px), and
          which one wins would depend on Tailwind's generated CSS order, not
          this className string's order. Nesting removes the ambiguity: a
          `display: none` parent hides these regardless of the children's
          own orientation-driven display value. */}
      <div className="md:hidden h-full min-h-0">
        {/* Mobile portrait: stacked, sidebar becomes a tab switcher */}
        <div className="hidden portrait:flex flex-col h-full min-h-0">
          {extraHeader}
          <div className="shrink-0">{video}</div>
          <div className="flex-1 min-h-0 flex flex-col border-t border-[#2d2e3b]">
            <SidebarTabs activeTab={activeTab} onChange={setActiveTab} />
            <div className="flex-1 min-h-0 overflow-hidden">{panels[activeTab]}</div>
          </div>
        </div>

        {/* Mobile landscape: reduced-height video, sidebar as a bottom drawer */}
        <div className="hidden landscape:flex flex-col h-full min-h-0 relative">
          {extraHeader}
          <div className="max-h-[60vh] shrink-0">{video}</div>
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            className="absolute bottom-3 right-3 z-20 p-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-xl transition"
          >
            <span className="material-symbols-outlined">{drawerOpen ? "expand_more" : "forum"}</span>
          </button>
          <div
            className={`absolute left-0 right-0 bottom-0 bg-[#0d0e16] border-t border-[#2d2e3b] rounded-t-2xl transition-transform duration-200 ${
              drawerOpen ? "translate-y-0" : "translate-y-full"
            }`}
            style={{ height: "55%" }}
          >
            <SidebarTabs activeTab={activeTab} onChange={setActiveTab} />
            <div className="h-[calc(100%-48px)] overflow-hidden">{panels[activeTab]}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarTabs({
  activeTab,
  onChange,
  onToggleSidebar,
  collapsed,
}: {
  activeTab: SidebarTabKey;
  onChange: (tab: SidebarTabKey) => void;
  onToggleSidebar?: () => void;
  collapsed?: boolean;
}) {
  return (
    <div className="flex items-center border-b border-[#2d2e3b] shrink-0">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition ${
            activeTab === tab.key ? "text-blue-400 border-b-2 border-blue-500" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          <span className="material-symbols-outlined text-base">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
      {onToggleSidebar && (
        <button type="button" onClick={onToggleSidebar} className="px-2 text-gray-500 hover:text-white transition" title={collapsed ? "Show sidebar" : "Hide sidebar"}>
          <span className="material-symbols-outlined text-base">left_panel_close</span>
        </button>
      )}
    </div>
  );
}
