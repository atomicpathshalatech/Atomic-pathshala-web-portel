"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CanvasEngine, type StrokeObject, type CanvasTool, type ShapeKind } from "@/lib/canvas/canvas-engine";
import { getPusherClient } from "@/lib/realtime/pusher-client";
import { sessionChannel, teacherChannel, WB_EVENTS } from "@/lib/realtime/events";
import { VideoStrip } from "@/components/live-class/VideoStrip";
import { MessagesPanel } from "@/components/live-class/MessagesPanel";
import { GRACE_PERIOD_MINUTES, END_WARNING_MINUTES } from "@/lib/whiteboard/constants";

type WhiteboardPage = { id: string; pageNumber: number; objects: StrokeObject[]; background: string };
// Only the values this component actually branches on are spelled out —
// anything else (WAITING_FOR_STREAM, PROCESSING_RECORDING, etc. — see
// LiveClassPhase in schema.prisma) is a real value the field can hold but
// isn't reachable through this teacher UI, so it's covered by the string
// fallback rather than listed here.
type LivePhase = "SCHEDULED" | "PREPARING" | "LIVE" | "ENDED" | (string & {});
type WhiteboardSession = {
  id: string;
  title: string;
  status: "ACTIVE" | "ENDED";
  livePhase: LivePhase;
  activePageNumber: number;
  chatEnabled: boolean;
  handRaiseEnabled: boolean;
  pages: WhiteboardPage[];
};
type HandRaiseQueueItem = { id: string; studentId: string; studentName: string; raisedAt: string };
type QuizOption = { key: string; label: string };
type ActiveQuiz = {
  id: string;
  questionText: string | null;
  options: QuizOption[];
  timeLimitSec: number;
  status: "ACTIVE" | "REVEALED" | "CLOSED";
  correctOption?: string | null;
};

// WhiteboardPage.background is untyped at the DB level (a free string), so
// this list can grow without a migration — see the comment on the column
// in prisma/schema.prisma. "blank"/undefined falls through to the same
// plain-white default "light" already meant.
type SlideTheme = "light" | "dark" | "grid" | "coordinate" | "dotted";

const SHAPE_TOOLS: { id: ShapeKind; label: string; icon: string }[] = [
  { id: "line", label: "Line", icon: "horizontal_rule" },
  { id: "rectangle", label: "Square", icon: "crop_square" },
  { id: "circle", label: "Circle", icon: "circle" },
  { id: "triangle", label: "Triangle", icon: "change_history" },
  { id: "arrow", label: "Arrow", icon: "north_east" },
];

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

// Reference list shown in the Shortcuts tab — kept as one array so the
// displayed list can never drift from what's actually wired in the keydown
// handler below (every entry here corresponds to a real branch there, not
// an aspirational one).
const SHORTCUTS: { label: string; combo: string }[] = [
  { label: "Undo", combo: "Ctrl+Z" },
  { label: "Redo", combo: "Ctrl+Y" },
  { label: "Add page", combo: "Shift+N" },
  { label: "Clear page", combo: "Shift+C" },
  { label: "Toggle Messages", combo: "Shift+M" },
  { label: "Toggle Questions", combo: "Shift+Q" },
  { label: "Full screen", combo: "F (from More menu)" },
];

// The board now genuinely supports a dark slide, so white is a real,
// visible ink color again (previously excluded — see git history — from
// back when the canvas was always a white background).
const PEN_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#ffffff"];
const HIGHLIGHT_COLORS = ["#ef4444", "#eab308", "#22c55e", "#3b82f6"];
const SIZE_PRESETS: { label: string; value: number }[] = [
  { label: "S", value: 2 },
  { label: "M", value: 5 },
  { label: "L", value: 9 },
];

// WhiteboardPage.background is "blank" (default)/"light"/"dark"/"grid"/
// "coordinate"/"dotted" for a theme keyword, or an uploaded storage URL
// (see the pages/[pageId]/background route) — anything that looks like a
// URL is treated as an image.
function isBackgroundImageUrl(background: string | undefined): background is string {
  return typeof background === "string" && /^https?:\/\//.test(background);
}

function slideBackgroundStyle(background: string | undefined): React.CSSProperties {
  switch (background) {
    case "dark":
      return { backgroundColor: "#1a1b23" };
    case "grid":
      return {
        backgroundColor: "#ffffff",
        backgroundImage:
          "linear-gradient(#9ca3af 1px, transparent 1px), linear-gradient(90deg, #9ca3af 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      };
    case "coordinate":
      return {
        backgroundColor: "#ffffff",
        backgroundImage:
          "linear-gradient(#d1d5db 1px, transparent 1px), linear-gradient(90deg, #d1d5db 1px, transparent 1px)",
        backgroundSize: "20px 20px",
        backgroundPosition: "center center",
      };
    case "dotted":
      return {
        backgroundColor: "#ffffff",
        backgroundImage: "radial-gradient(#9ca3af 1.5px, transparent 1.5px)",
        backgroundSize: "20px 20px",
      };
    case "light":
    case "blank":
    default:
      return { backgroundColor: "#ffffff" };
  }
}

async function getJson(url: string) {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? "Request failed");
  return json.data;
}

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? "Request failed");
  return json.data;
}

async function patchJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? "Request failed");
  return json.data;
}

async function deleteJson(url: string) {
  const res = await fetch(url, { method: "DELETE" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? "Request failed");
  return json.data;
}

type SettingsTab = "audio" | "chatpoll" | "broadcast" | "shortcuts";
type PopupId = "pen" | "highlight" | "eraser" | "shapes" | "pages" | "zoom" | "more" | null;

export function TeacherLiveClassRoom({
  batchScheduleId,
  scheduleTitle,
  batchName,
  currentUserId,
  endsAt,
}: {
  batchScheduleId: string;
  scheduleTitle: string;
  batchName: string;
  currentUserId: string;
  endsAt: string;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeCanvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingObjectsRef = useRef<StrokeObject[] | null>(null);
  const activeQuizIdRef = useRef<string | null>(null);
  // The canvas engine (and its onCommit closure) is created once per
  // session and persists across page switches — it must always call the
  // LATEST flushAutosave, not the one captured when the engine was built,
  // or a page switch would keep autosaving strokes to the old page. A ref
  // kept in sync via the effect below solves that without recreating the
  // engine (and losing pointer-capture state) on every page change.
  const flushAutosaveRef = useRef<() => Promise<void>>(async () => {});
  const backgroundFileInputRef = useRef<HTMLInputElement>(null);
  // useMediaDeviceSelect needs <LiveKitRoom> context, which VideoStrip owns;
  // this empty container lives inside the Settings modal (outside that
  // provider), and VideoStrip portals its real device-picker fields into it
  // — see the comment on VideoStrip's settingsPortalRef prop.
  // Deliberately `useRef<HTMLDivElement>(null)` (not `<HTMLDivElement | null>`)
  // — that's the overload that returns RefObject<HTMLDivElement> instead of
  // MutableRefObject<HTMLDivElement | null>, which is what the `ref` prop
  // on a plain <div> actually accepts.
  const settingsPortalRef = useRef<HTMLDivElement>(null);

  const [wbSession, setWbSession] = useState<WhiteboardSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  const [tool, setTool] = useState<CanvasTool>("pen");
  const [color, setColor] = useState<string>(PEN_COLORS[0] ?? "#ef4444");
  const [size, setSize] = useState(5);
  const [undoRedoTick, setUndoRedoTick] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [openPopup, setOpenPopup] = useState<PopupId>(null);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("audio");
  const [togglingChat, setTogglingChat] = useState(false);
  const [togglingHandRaise, setTogglingHandRaise] = useState(false);

  const [saveState, setSaveState] = useState<"saved" | "saving" | "offline">("saved");
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [startingClass, setStartingClass] = useState(false);
  const [startClassError, setStartClassError] = useState<string | null>(null);

  const [studentCount, setStudentCount] = useState(0);
  const [handRaiseQueue, setHandRaiseQueue] = useState<HandRaiseQueueItem[]>([]);
  const [rightTab, setRightTab] = useState<"messages" | "questions">("messages");
  const [unreadMessages, setUnreadMessages] = useState(0);

  const [activeQuiz, setActiveQuiz] = useState<ActiveQuiz | null>(null);
  useEffect(() => {
    activeQuizIdRef.current = activeQuiz?.id ?? null;
  }, [activeQuiz]);
  const [quizMetrics, setQuizMetrics] = useState<{ counts: Record<string, number>; totalResponses: number } | null>(
    null
  );
  const [quizForm, setQuizForm] = useState({
    isQuickQuiz: true,
    questionText: "",
    options: ["", "", "", ""],
    correctOption: "A",
    timeLimitSec: 30,
  });
  const [quizError, setQuizError] = useState<string | null>(null);
  const [launchingQuiz, setLaunchingQuiz] = useState(false);

  const currentPage = wbSession?.pages.find((p) => p.pageNumber === wbSession.activePageNumber) ?? null;

  // Read inside the Pusher handler below, which is bound once per session
  // (not re-bound on every tab change) — a ref keeps it seeing the latest
  // tab without adding `rightTab` to that effect's dependency array.
  const rightTabRef = useRef(rightTab);
  useEffect(() => {
    rightTabRef.current = rightTab;
  }, [rightTab]);

  // ---- Start-or-resume the session on mount ------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await postJson("/api/whiteboard/sessions", { batchScheduleId });
        if (!cancelled) setWbSession(data.whiteboardSession);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Could not start the live class.");
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchScheduleId]);

  // ---- Canvas engine lifecycle --------------------------------------------
  useEffect(() => {
    if (!wbSession || !baseCanvasRef.current || !activeCanvasRef.current) return;

    const engine = new CanvasEngine(
      baseCanvasRef.current,
      activeCanvasRef.current,
      (objects) => {
        pendingObjectsRef.current = objects;
        setSaveState("saving");
        if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
        autosaveTimer.current = setTimeout(() => flushAutosaveRef.current(), 1500);
        setUndoRedoTick((t) => t + 1);
      },
      () => setUndoRedoTick((t) => t + 1)
    );
    engineRef.current = engine;
    engine.syncSize();
    if (currentPage) engine.loadObjects(currentPage.objects ?? []);

    const onResize = () => engine.syncSize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wbSession?.id]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.currentTool = tool;
      engineRef.current.setTool(tool);
    }
  }, [tool]);
  useEffect(() => {
    if (engineRef.current) engineRef.current.currentColor = color;
  }, [color]);
  useEffect(() => {
    if (engineRef.current) engineRef.current.currentSize = size;
  }, [size]);

  const flushAutosave = useCallback(async () => {
    if (!wbSession || !currentPage || !pendingObjectsRef.current) return;
    const objects = pendingObjectsRef.current;
    try {
      await patchJson(`/api/whiteboard/sessions/${wbSession.id}/pages/${currentPage.id}`, { objects });
      setSaveState("saved");
      setWbSession((prev) =>
        prev
          ? {
              ...prev,
              pages: prev.pages.map((p) => (p.id === currentPage.id ? { ...p, objects } : p)),
            }
          : prev
      );
    } catch {
      setSaveState("offline");
    }
  }, [wbSession, currentPage]);

  useEffect(() => {
    flushAutosaveRef.current = flushAutosave;
  }, [flushAutosave]);

  // flush on page unload so a fast page-switch/tab-close doesn't lose the
  // last few strokes sitting in the debounce window
  useEffect(() => {
    const handler = () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      flushAutosave();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [flushAutosave]);

  // ---- Pusher: roster presence + teacher-only hand-raise/quiz channels ----
  useEffect(() => {
    if (!wbSession) return;
    const client = getPusherClient();

    const presence = client.subscribe(sessionChannel(wbSession.id));
    presence.bind("pusher:subscription_succeeded", (members: { count: number }) => {
      setStudentCount(Math.max(0, members.count - 1)); // exclude the teacher themself
    });
    presence.bind("pusher:member_added", () => setStudentCount((c) => c + 1));
    presence.bind("pusher:member_removed", () => setStudentCount((c) => Math.max(0, c - 1)));
    presence.bind(WB_EVENTS.MESSAGE_SENT, () => {
      if (rightTabRef.current !== "messages") setUnreadMessages((c) => c + 1);
    });

    const teacherCh = client.subscribe(teacherChannel(wbSession.id));
    teacherCh.bind(WB_EVENTS.HAND_RAISE_LIST, (data: { queue: HandRaiseQueueItem[] }) => {
      setHandRaiseQueue(data.queue);
    });
    teacherCh.bind(
      WB_EVENTS.QUIZ_METRICS,
      (data: { quizSessionId: string; counts: Record<string, number>; totalResponses: number }) => {
        if (activeQuizIdRef.current !== data.quizSessionId) return;
        setQuizMetrics({ counts: data.counts, totalResponses: data.totalResponses });
      }
    );

    // Initial hand-raise queue snapshot (Pusher only pushes on change).
    getJson(`/api/whiteboard/sessions/${wbSession.id}/hand-raise`)
      .then((data) => setHandRaiseQueue(data.queue))
      .catch(() => {});

    return () => {
      client.unsubscribe(sessionChannel(wbSession.id));
      client.unsubscribe(teacherChannel(wbSession.id));
    };
  }, [wbSession?.id]);

  // ---- Page navigation -----------------------------------------------------
  async function switchToPage(pageNumber: number) {
    if (!wbSession || !engineRef.current) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    await flushAutosave();
    const target = wbSession.pages.find((p) => p.pageNumber === pageNumber);
    if (!target) return;
    try {
      await patchJson(`/api/whiteboard/sessions/${wbSession.id}`, { activePageNumber: pageNumber });
      setWbSession((prev) => (prev ? { ...prev, activePageNumber: pageNumber } : prev));
      engineRef.current.loadObjects(target.objects ?? []);
    } catch {
      setSaveState("offline");
    }
  }

  async function addPage() {
    if (!wbSession) return;
    try {
      const data = await postJson(`/api/whiteboard/sessions/${wbSession.id}/pages`);
      setWbSession((prev) => (prev ? { ...prev, pages: [...prev.pages, data.page], activePageNumber: data.page.pageNumber } : prev));
      engineRef.current?.loadObjects([]);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not add a page.");
    }
  }

  async function deleteCurrentPage() {
    if (!wbSession || !currentPage || wbSession.pages.length <= 1) return;
    if (!window.confirm("Delete this page? This can't be undone.")) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    try {
      const data = await deleteJson(`/api/whiteboard/sessions/${wbSession.id}/pages/${currentPage.id}`);
      setWbSession((prev) =>
        prev ? { ...prev, pages: data.pages, activePageNumber: data.activePageNumber } : prev
      );
      const nextActive = (data.pages as WhiteboardPage[]).find(
        (p) => p.pageNumber === data.activePageNumber
      );
      engineRef.current?.loadObjects(nextActive?.objects ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not delete this page.");
    }
  }

  // ---- Slide background (More menu / Theme modal) --------------------------
  async function handleBackgroundFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file || !wbSession || !currentPage) return;
    setUploadingBackground(true);
    setOpenPopup(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(
        `/api/whiteboard/sessions/${wbSession.id}/pages/${currentPage.id}/background`,
        { method: "POST", body: formData }
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Upload failed");
      const background: string = json.data.page.background;
      setWbSession((prev) =>
        prev
          ? { ...prev, pages: prev.pages.map((p) => (p.id === currentPage.id ? { ...p, background } : p)) }
          : prev
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not upload the background.");
    } finally {
      setUploadingBackground(false);
    }
  }

  async function setSlideTheme(theme: SlideTheme) {
    if (!wbSession || !currentPage) return;
    setOpenPopup(null);
    try {
      await patchJson(`/api/whiteboard/sessions/${wbSession.id}/pages/${currentPage.id}`, {
        objects: engineRef.current?.getObjects() ?? currentPage.objects,
        background: theme,
      });
      setWbSession((prev) =>
        prev
          ? { ...prev, pages: prev.pages.map((p) => (p.id === currentPage.id ? { ...p, background: theme } : p)) }
          : prev
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not change the slide theme.");
    }
  }

  // ---- Fullscreen ------------------------------------------------------------
  async function toggleFullscreen() {
    setOpenPopup(null);
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await containerRef.current?.requestFullscreen();
      }
    } catch {
      // Fullscreen API is blocked in some embedded/iframe contexts — fail
      // soft rather than throw, same as VideoStrip's LiveKit connect errors.
    }
  }

  // ---- Chat / Questions toggles (Class Settings → Chat & Poll controls) ----
  async function toggleChatEnabled() {
    if (!wbSession) return;
    setTogglingChat(true);
    try {
      await patchJson(`/api/whiteboard/sessions/${wbSession.id}`, { chatEnabled: !wbSession.chatEnabled });
      setWbSession((prev) => (prev ? { ...prev, chatEnabled: !prev.chatEnabled } : prev));
    } catch {
      // leave state as-is on failure — the switch just won't visibly move
    } finally {
      setTogglingChat(false);
    }
  }

  async function toggleHandRaiseEnabled() {
    if (!wbSession) return;
    setTogglingHandRaise(true);
    try {
      await patchJson(`/api/whiteboard/sessions/${wbSession.id}`, {
        handRaiseEnabled: !wbSession.handRaiseEnabled,
      });
      setWbSession((prev) => (prev ? { ...prev, handRaiseEnabled: !prev.handRaiseEnabled } : prev));
    } catch {
      // leave state as-is on failure
    } finally {
      setTogglingHandRaise(false);
    }
  }

  // ---- Keyboard shortcuts ------------------------------------------------
  // A ref (not a `[]`-dep effect calling these directly) so the handler
  // always sees the latest wbSession/tool state without re-attaching the
  // window listener on every render — same pattern flushAutosaveRef uses
  // above for the canvas engine's onCommit callback.
  const shortcutHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    shortcutHandlerRef.current = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isTyping) return;

      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === "z") {
        e.preventDefault();
        engineRef.current?.undo();
        setUndoRedoTick((t) => t + 1);
      } else if ((e.ctrlKey || e.metaKey) && (key === "y" || (e.shiftKey && key === "z"))) {
        e.preventDefault();
        engineRef.current?.redo();
        setUndoRedoTick((t) => t + 1);
      } else if (e.shiftKey && key === "n") {
        e.preventDefault();
        addPage();
      } else if (e.shiftKey && key === "c") {
        e.preventDefault();
        engineRef.current?.clearInk();
      } else if (e.shiftKey && key === "m") {
        e.preventDefault();
        setRightTab("messages");
        setUnreadMessages(0);
      } else if (e.shiftKey && key === "q") {
        e.preventDefault();
        setRightTab("questions");
      }
    };
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => shortcutHandlerRef.current(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ---- Start class (leave the pre-class lobby) --------------------------
  async function startClass() {
    if (!wbSession || startingClass) return;
    setStartingClass(true);
    setStartClassError(null);
    try {
      const data = await patchJson(`/api/whiteboard/sessions/${wbSession.id}`, { livePhase: "LIVE" });
      setWbSession(data.whiteboardSession);
    } catch (err) {
      setStartClassError(err instanceof Error ? err.message : "Could not start the class.");
    } finally {
      setStartingClass(false);
    }
  }

  // ---- End-of-class countdown + backend-mirroring auto-end --------------
  // No cron/worker exists in this app (see endWhiteboardSession's comment)
  // — the backend force-ends a class lazily, on the next request that
  // touches it. This timer is what makes that actually happen promptly
  // for a teacher whose tab is still open, instead of waiting for some
  // other request to stumble in; a teacher who navigates away is still
  // covered server-side by resolveWhiteboardAccess's own grace check.
  const [minutesRemaining, setMinutesRemaining] = useState<number | null>(null);
  const autoEndTriggeredRef = useRef(false);

  useEffect(() => {
    const endsAtMs = new Date(endsAt).getTime();
    const tick = () => {
      const now = Date.now();
      setMinutesRemaining(Math.ceil((endsAtMs - now) / 60_000));
      const gracePeriodExpired = now > endsAtMs + GRACE_PERIOD_MINUTES * 60_000;
      if (gracePeriodExpired && !autoEndTriggeredRef.current && wbSession?.status === "ACTIVE" && !ending) {
        autoEndTriggeredRef.current = true;
        endClass();
      }
    };
    tick();
    const interval = setInterval(tick, 15_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, wbSession?.status]);

  // ---- End class -------------------------------------------------------------
  async function endClass() {
    if (!wbSession) return;
    setEnding(true);
    try {
      await postJson(`/api/whiteboard/sessions/${wbSession.id}/end`);
      router.push(`/team/batches`);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not end the class.");
      setEnding(false);
    }
  }

  // ---- Hand raise resolve ------------------------------------------------
  async function resolveHandRaise(id: string) {
    if (!wbSession) return;
    try {
      await patchJson(`/api/whiteboard/sessions/${wbSession.id}/hand-raise/${id}`, {});
    } catch {
      // queue re-syncs on the next Pusher push / manual refresh either way
    }
  }

  // ---- Quiz ------------------------------------------------------------------
  async function launchQuiz() {
    if (!wbSession) return;
    setQuizError(null);
    const filledOptions = quizForm.options
      .map((label, i) => ({ key: String.fromCharCode(65 + i), label: label.trim() }))
      .filter((o) => o.label.length > 0);

    if (filledOptions.length < 2) {
      setQuizError("Add at least two answer options.");
      return;
    }
    if (!quizForm.isQuickQuiz && !quizForm.questionText.trim()) {
      setQuizError("Add a question for a typed quiz (Quick Quiz can be board-driven and skip this).");
      return;
    }

    setLaunchingQuiz(true);
    try {
      const data = await postJson(`/api/whiteboard/sessions/${wbSession.id}/quiz`, {
        questionText: quizForm.questionText.trim() || undefined,
        isQuickQuiz: quizForm.isQuickQuiz,
        options: filledOptions,
        correctOption: filledOptions.some((o) => o.key === quizForm.correctOption)
          ? quizForm.correctOption
          : undefined,
        timeLimitSec: quizForm.timeLimitSec,
      });
      setActiveQuiz(data.quiz);
      setQuizMetrics({ counts: {}, totalResponses: 0 });
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : "Could not launch the quiz.");
    } finally {
      setLaunchingQuiz(false);
    }
  }

  async function revealQuiz() {
    if (!wbSession || !activeQuiz) return;
    try {
      const data = await postJson(`/api/whiteboard/sessions/${wbSession.id}/quiz/${activeQuiz.id}/reveal`);
      setActiveQuiz(data.quiz);
      setQuizMetrics({ counts: data.counts, totalResponses: data.totalResponses });
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : "Could not reveal the answer.");
    }
  }

  async function closeQuiz() {
    if (!wbSession || !activeQuiz) return;
    try {
      await postJson(`/api/whiteboard/sessions/${wbSession.id}/quiz/${activeQuiz.id}/close`);
      setActiveQuiz(null);
      setQuizMetrics(null);
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : "Could not close the quiz.");
    }
  }

  // ------------------------------------------------------------------------

  if (starting) {
    return (
      <div className="flex h-[70vh] items-center justify-center bg-[#10131b] -m-6 text-white">
        <p className="text-sm text-gray-400">Starting the live board…</p>
      </div>
    );
  }

  if (loadError && !wbSession) {
    return (
      <div className="max-w-lg mx-auto mt-16 bg-[#1a1b23] border border-[#2d2e3b] rounded-2xl p-6 text-center space-y-2 text-white">
        <p className="text-lg font-semibold text-red-400">Could not start the live class</p>
        <p className="text-sm text-gray-400">{loadError}</p>
      </div>
    );
  }

  if (!wbSession) return null;

  // ---- Pre-class lobby: chat is live, board/video aren't yet -------------
  // Shown from the moment the teacher opens this page (session create sets
  // livePhase: PREPARING) until they explicitly click Start Class. Students
  // polling by-schedule see the same gate on their side (StudentLiveClassRoom's
  // "lobby" phase) so both sides agree on when the actual class begins.
  if (wbSession.livePhase !== "LIVE") {
    return (
      <div className="flex h-[calc(100vh-5rem)] -m-6 bg-[#10131b] text-white overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <span className="material-symbols-outlined text-5xl text-blue-500">meeting_room</span>
          <div>
            <p className="text-[11px] text-gray-500">{batchName}</p>
            <h1 className="text-xl font-semibold text-gray-100">{scheduleTitle}</h1>
          </div>
          <p className="text-sm text-gray-400 max-w-md">
            You&apos;re in the pre-class lobby. Chat with students who&apos;ve already joined below —
            the board and video open for everyone once you start the class.
          </p>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="material-symbols-outlined text-base">groups</span>
            {studentCount} waiting
          </span>
          {startClassError && <p className="text-xs text-red-400">{startClassError}</p>}
          <button
            type="button"
            disabled={startingClass}
            onClick={startClass}
            className="mt-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 px-8 py-3 rounded-lg disabled:opacity-60 transition"
          >
            {startingClass ? "Starting…" : "Start Class"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/team/batches")}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Leave for now (chat stays open, resume anytime before you start)
          </button>
        </div>
        <aside className="w-96 bg-[#1a1b23] border-l border-[#2d2e3b] flex flex-col p-4 shrink-0">
          <p className="text-sm font-medium text-gray-200 mb-3">Lobby Chat</p>
          <MessagesPanel
            whiteboardSessionId={wbSession.id}
            currentUserId={currentUserId}
            role="TEACHER"
            theme="dark"
            showOwnToggle={false}
          />
        </aside>
      </div>
    );
  }

  const canGoPrev = wbSession.activePageNumber > 1;
  const canGoNext = wbSession.activePageNumber < wbSession.pages.length;
  const pollActive = !!activeQuiz && activeQuiz.status !== "CLOSED";

  return (
    <div
      ref={containerRef}
      className="grid h-[calc(100vh-5rem)] -m-6 bg-[#10131b] text-white overflow-hidden"
      style={{ gridTemplateColumns: "64px 1fr 320px", gridTemplateRows: "56px 1fr 64px" }}
    >
      <input
        ref={backgroundFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleBackgroundFileChange}
        className="hidden"
      />

      {/* Left rail */}
      <aside
        className="border-r border-[#2d2e3b] bg-[#1a1b23] flex flex-col items-center py-4"
        style={{ gridColumn: "1", gridRow: "1 / 4" }}
      >
        <button
          type="button"
          onClick={() => router.push("/team/batches")}
          className="text-blue-500 hover:text-blue-400 transition-colors"
          title="Atomic Pathshala"
        >
          <span className="material-symbols-outlined text-3xl">hub</span>
        </button>
      </aside>

      {/* Header */}
      <header
        className="flex items-center justify-between gap-4 px-6 border-b border-[#2d2e3b] bg-[#1a1b23]"
        style={{ gridColumn: "2 / 4", gridRow: "1" }}
      >
        <div className="min-w-0">
          <p className="text-[11px] text-gray-500 truncate">{batchName}</p>
          <h1 className="text-sm font-medium text-gray-200 truncate">{scheduleTitle}</h1>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <SaveIndicator state={saveState} />
          {minutesRemaining !== null && minutesRemaining <= END_WARNING_MINUTES && wbSession?.status === "ACTIVE" && (
            <span
              className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 border border-amber-900/50 bg-amber-950/30 px-2.5 py-1 rounded-md"
              title="This class will auto-end shortly after its scheduled time if not ended manually."
            >
              <span className="material-symbols-outlined text-base">schedule</span>
              {minutesRemaining > 0 ? `Ending in ${minutesRemaining}m` : "Past scheduled end — wrap up"}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="material-symbols-outlined text-base">groups</span>
            {studentCount} watching
          </span>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="text-xs font-semibold text-gray-300 border border-gray-600 px-4 py-1.5 rounded-md hover:bg-gray-700 transition"
          >
            CLASS SETTINGS
          </button>
          {!confirmingEnd ? (
            <button
              type="button"
              onClick={() => setConfirmingEnd(true)}
              className="text-xs font-semibold text-red-400 border border-red-900/50 px-4 py-1.5 rounded-md hover:bg-red-950/40 transition"
            >
              END CLASS
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">End for everyone?</span>
              <button
                type="button"
                disabled={ending}
                onClick={endClass}
                className="text-xs font-semibold text-white bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded-md disabled:opacity-60 transition"
              >
                {ending ? "Ending…" : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingEnd(false)}
                className="text-xs text-gray-400 hover:text-white px-2"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main canvas area */}
      <main
        className="relative overflow-hidden bg-[#10131b] p-4 flex items-center justify-center"
        style={{ gridColumn: "2", gridRow: "2" }}
      >
        <div
          className="w-full h-full rounded-xl shadow-lg max-w-[1200px] relative overflow-hidden"
          style={isBackgroundImageUrl(currentPage?.background) ? undefined : slideBackgroundStyle(currentPage?.background)}
        >
          {isBackgroundImageUrl(currentPage?.background) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentPage!.background}
              alt=""
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
          )}
          {currentPage?.background === "coordinate" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-full h-[2px] bg-blue-500/70" />
              <div className="absolute h-full w-[2px] bg-blue-500/70" />
            </div>
          )}
          {/* Only the canvases themselves scale with zoom — a pure CSS
              transform, origin top-left. Their backing-store resolution
              stays pinned to their untransformed box (see
              CanvasEngine.syncSize/getPoint), so zoom is purely visual and
              never desyncs where a stroke lands. The slide background
              (color/pattern/image) deliberately stays outside this wrapper
              so zooming never leaves a gap around a smaller-than-100% page. */}
          <div className="absolute inset-0" style={{ transform: `scale(${zoom})`, transformOrigin: "0 0" }}>
            <canvas ref={baseCanvasRef} className="absolute inset-0 w-full h-full" />
            <canvas ref={activeCanvasRef} className="absolute inset-0 w-full h-full touch-none" />
          </div>
        </div>
      </main>

      {/* Right panel: video + Messages/Questions */}
      <aside
        className="bg-[#1a1b23] border-l border-[#2d2e3b] flex flex-col min-h-0"
        style={{ gridColumn: "3", gridRow: "2 / 4" }}
      >
        <div className="h-56 bg-black relative border-b border-[#2d2e3b] shrink-0">
          <VideoStrip whiteboardSessionId={wbSession.id} variant="panel" settingsPortalRef={settingsPortalRef} />
        </div>

        <div className="flex border-b border-[#2d2e3b] px-4 pt-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setRightTab("messages");
              setUnreadMessages(0);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors relative ${
              rightTab === "messages" ? "border-white text-white" : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            Messages
            {unreadMessages > 0 && (
              <span className="ml-1.5 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {unreadMessages}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setRightTab("questions")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors relative ${
              rightTab === "questions" ? "border-white text-white" : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            Questions
            {!wbSession.handRaiseEnabled ? (
              <span className="bg-gray-800 text-gray-400 text-[10px] px-1.5 py-0.5 rounded ml-1.5">OFF</span>
            ) : (
              handRaiseQueue.length > 0 && (
                <span className="ml-1.5 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {handRaiseQueue.length}
                </span>
              )
            )}
          </button>
        </div>

        <div className="flex-1 min-h-0 p-4 flex flex-col">
          {rightTab === "messages" ? (
            <MessagesPanel
              whiteboardSessionId={wbSession.id}
              currentUserId={currentUserId}
              role="TEACHER"
              theme="dark"
              showOwnToggle={false}
            />
          ) : (
            <HandRaisePanel
              queue={handRaiseQueue}
              onResolve={resolveHandRaise}
              enabled={wbSession.handRaiseEnabled}
            />
          )}
        </div>
      </aside>

      {/* Bottom toolbar */}
      <footer
        className="flex items-center justify-between px-6 border-t border-[#2d2e3b] bg-[#1a1b23] relative"
        style={{ gridColumn: "2", gridRow: "3" }}
      >
        {openPopup && <div className="fixed inset-0 z-30" onClick={() => setOpenPopup(null)} />}

        {/* Tools group */}
        <div className="flex items-center gap-1">
          <div className="relative">
            <ToolbarBtn
              icon="edit"
              label="Pen"
              active={tool === "pen"}
              onClick={() => {
                setTool("pen");
                setOpenPopup((p) => (p === "pen" ? null : "pen"));
              }}
            />
            {openPopup === "pen" && (
              <div className="absolute bottom-full left-0 mb-2 z-40 bg-[#1a1b23] border border-[#2d2e3b] rounded-lg p-3 shadow-2xl flex flex-row gap-3 min-w-max">
                <div className="flex gap-2 items-center border-r border-gray-700 pr-3">
                  {PEN_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full border shadow-sm ${
                        color === c ? "ring-2 ring-white border-transparent" : "border-transparent hover:border-white"
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  {SIZE_PRESETS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => setSize(s.value)}
                      className={`w-6 h-6 rounded border text-xs flex items-center justify-center transition-colors ${
                        size === s.value ? "bg-gray-700 border-gray-500 text-white" : "border-gray-600 text-gray-300 hover:bg-gray-800"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <ToolbarBtn
              icon="border_color"
              label="Highlight"
              active={tool === "highlighter"}
              onClick={() => {
                setTool("highlighter");
                setOpenPopup((p) => (p === "highlight" ? null : "highlight"));
              }}
            />
            {openPopup === "highlight" && (
              <div className="absolute bottom-full left-0 mb-2 z-40 bg-[#1a1b23] border border-[#2d2e3b] rounded-lg p-3 shadow-2xl flex flex-row gap-2 min-w-max">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full border shadow-sm ${
                      color === c ? "ring-2 ring-white border-transparent" : "border-gray-600 hover:border-white"
                    }`}
                    style={{ backgroundColor: c, opacity: 0.65 }}
                    title={c}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <ToolbarBtn
              icon="ink_eraser"
              label="Eraser"
              active={tool === "stroke-eraser" || tool === "object-eraser"}
              onClick={() => setOpenPopup((p) => (p === "eraser" ? null : "eraser"))}
            />
            {openPopup === "eraser" && (
              <div className="absolute bottom-full left-0 mb-2 z-40 bg-[#1a1b23] border border-[#2d2e3b] rounded-lg p-1 shadow-2xl w-44 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setTool("stroke-eraser");
                    setOpenPopup(null);
                  }}
                  className={`flex items-center gap-3 p-2 rounded text-sm text-left transition-colors ${
                    tool === "stroke-eraser" ? "bg-blue-900/20 text-blue-400" : "text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  <span className="material-symbols-outlined text-base w-4">ink_eraser</span> Stroke Eraser
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTool("object-eraser");
                    setOpenPopup(null);
                  }}
                  className={`flex items-center gap-3 p-2 rounded text-sm text-left transition-colors ${
                    tool === "object-eraser" ? "bg-blue-900/20 text-blue-400" : "text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  <span className="material-symbols-outlined text-base w-4">delete_sweep</span> Object Eraser
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            <ToolbarBtn
              icon="square"
              label="Shapes"
              active={SHAPE_TOOLS.some((s) => s.id === tool)}
              onClick={() => setOpenPopup((p) => (p === "shapes" ? null : "shapes"))}
            />
            {openPopup === "shapes" && (
              <div className="absolute bottom-full left-0 mb-2 z-40 bg-[#1a1b23] border border-[#2d2e3b] rounded-lg p-1 shadow-2xl w-40 flex flex-col gap-1">
                {SHAPE_TOOLS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setTool(s.id);
                      setOpenPopup(null);
                    }}
                    className={`flex items-center gap-3 p-2 rounded text-sm text-left transition-colors ${
                      tool === s.id ? "bg-blue-900/20 text-blue-400" : "text-gray-300 hover:bg-gray-800"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base w-4">{s.icon}</span> {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-[#2d2e3b] mx-2" />

          <button
            type="button"
            onClick={() => setTool("select")}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
              tool === "select" ? "text-blue-400 bg-blue-900/30" : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
            title="Select / Move"
          >
            <span className="material-symbols-outlined text-lg">arrow_selector_tool</span>
          </button>
          <button
            type="button"
            disabled={!engineRef.current?.canUndo()}
            onClick={() => {
              engineRef.current?.undo();
              setUndoRedoTick((t) => t + 1);
            }}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 transition-colors"
            title="Undo"
          >
            <span className="material-symbols-outlined text-lg">undo</span>
          </button>
          <button
            type="button"
            disabled={!engineRef.current?.canRedo()}
            onClick={() => {
              engineRef.current?.redo();
              setUndoRedoTick((t) => t + 1);
            }}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 transition-colors"
            title="Redo"
          >
            <span className="material-symbols-outlined text-lg">redo</span>
          </button>
          <button
            type="button"
            onClick={() => engineRef.current?.clearInk()}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            title="Clear page"
          >
            <span className="material-symbols-outlined text-lg">layers_clear</span>
          </button>
        </div>

        {/* Navigation group */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canGoPrev}
            onClick={() => switchToPage(wbSession.activePageNumber - 1)}
            className="text-gray-400 hover:text-white p-2 rounded hover:bg-gray-800 disabled:opacity-30 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">chevron_left</span>
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenPopup((p) => (p === "pages" ? null : "pages"))}
              className="flex items-center gap-2 bg-[#10131b] px-4 py-1.5 rounded-lg border border-[#2d2e3b] mx-1 hover:border-gray-500 transition-colors"
            >
              <span className="material-symbols-outlined text-gray-400 text-xs">layers</span>
              <span className="text-sm font-medium">
                {wbSession.activePageNumber} <span className="text-gray-500 font-normal">/</span> {wbSession.pages.length}
              </span>
            </button>
            {openPopup === "pages" && (
              <div className="absolute bottom-full left-0 mb-2 z-40 bg-[#1a1b23] border border-[#2d2e3b] rounded-lg p-1.5 shadow-2xl max-h-56 overflow-y-auto flex flex-col gap-1 min-w-[9rem]">
                {wbSession.pages.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      switchToPage(p.pageNumber);
                      setOpenPopup(null);
                    }}
                    className={`px-3 py-1.5 rounded text-sm text-left transition-colors ${
                      p.pageNumber === wbSession.activePageNumber
                        ? "bg-blue-900/20 text-blue-400"
                        : "text-gray-300 hover:bg-gray-800"
                    }`}
                  >
                    Page {p.pageNumber}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={!canGoNext}
            onClick={() => switchToPage(wbSession.activePageNumber + 1)}
            className="text-gray-400 hover:text-white p-2 rounded hover:bg-gray-800 disabled:opacity-30 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">chevron_right</span>
          </button>
          <div className="w-px h-6 bg-[#2d2e3b] mx-2" />
          <ToolbarBtn icon="add" label="Add" onClick={addPage} />
          <ToolbarBtn
            icon="delete"
            label="Delete"
            onClick={deleteCurrentPage}
            disabled={wbSession.pages.length <= 1}
            className="hover:text-red-400"
          />
        </div>

        {/* Action group */}
        <div className="flex items-center gap-1">
          <ToolbarBtn icon="poll" label="Poll" active={pollActive} onClick={() => setPollOpen(true)} />

          <div className="relative">
            <ToolbarBtn icon="zoom_in" label="Zoom" onClick={() => setOpenPopup((p) => (p === "zoom" ? null : "zoom"))} />
            {openPopup === "zoom" && (
              <div className="absolute bottom-full right-0 mb-2 z-40 flex items-center gap-1 bg-[#1a1b23] border border-[#2d2e3b] rounded-full shadow-2xl px-1.5 py-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 10) / 10))}
                  disabled={zoom <= MIN_ZOOM}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-800 text-gray-300 disabled:opacity-30 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">remove</span>
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="px-2 text-xs text-gray-300 hover:text-white w-12 text-center"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 10) / 10))}
                  disabled={zoom >= MAX_ZOOM}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-800 text-gray-300 disabled:opacity-30 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">add</span>
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            <ToolbarBtn icon="more_horiz" label="More" onClick={() => setOpenPopup((p) => (p === "more" ? null : "more"))} />
            {openPopup === "more" && (
              <div className="absolute bottom-full right-0 mb-2 z-40 w-64 bg-[#1a1b23] border border-[#2d2e3b] rounded-lg p-3 grid grid-cols-2 gap-2 shadow-2xl origin-bottom-right">
                <MoreGridBtn
                  icon={uploadingBackground ? "hourglass_empty" : "image"}
                  label={uploadingBackground ? "Uploading…" : "Upload File"}
                  disabled={uploadingBackground}
                  onClick={() => {
                    setOpenPopup(null);
                    backgroundFileInputRef.current?.click();
                  }}
                />
                <MoreGridBtn
                  icon="palette"
                  label="Slide theme"
                  onClick={() => {
                    setOpenPopup(null);
                    setThemeModalOpen(true);
                  }}
                />
                <MoreGridBtn icon="light_mode" label="Light Mode" onClick={() => setSlideTheme("light")} />
                <MoreGridBtn icon="fullscreen" label="Full screen" shortcutHint="F" onClick={toggleFullscreen} />
              </div>
            )}
          </div>
        </div>
      </footer>

      {settingsOpen && (
        <SettingsModal
          activeTab={settingsTab}
          setActiveTab={setSettingsTab}
          onClose={() => setSettingsOpen(false)}
          wbSession={wbSession}
          onToggleChat={toggleChatEnabled}
          onToggleHandRaise={toggleHandRaiseEnabled}
          togglingChat={togglingChat}
          togglingHandRaise={togglingHandRaise}
          settingsPortalRef={settingsPortalRef}
        />
      )}

      {themeModalOpen && (
        <ThemeModal
          current={currentPage?.background}
          onSelect={setSlideTheme}
          onClose={() => setThemeModalOpen(false)}
        />
      )}

      {pollOpen && (
        <PollModal
          onClose={() => setPollOpen(false)}
          activeQuiz={activeQuiz}
          quizMetrics={quizMetrics}
          form={quizForm}
          setForm={setQuizForm}
          error={quizError}
          launching={launchingQuiz}
          onLaunch={launchQuiz}
          onReveal={revealQuiz}
          onClose2={closeQuiz}
        />
      )}
    </div>
  );
}

function ToolbarBtn({
  icon,
  label,
  active,
  onClick,
  disabled,
  className = "",
  title,
}: {
  icon: string;
  label?: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className={`flex flex-col items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] min-w-[52px] transition-colors disabled:opacity-30 ${
        active ? "text-blue-400 bg-blue-900/30" : "text-gray-400 hover:text-white hover:bg-gray-800"
      } ${className}`}
    >
      <span className="material-symbols-outlined text-lg">{icon}</span>
      {label && <span>{label}</span>}
    </button>
  );
}

function MoreGridBtn({
  icon,
  label,
  onClick,
  disabled,
  shortcutHint,
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  shortcutHint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center justify-center p-4 rounded-lg bg-[#10131b] border border-[#2d2e3b] hover:border-gray-500 hover:bg-gray-800 text-sm gap-3 transition-colors relative disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-2xl text-gray-300">{icon}</span>
      <span className="font-medium text-gray-300">{label}</span>
      {shortcutHint && <span className="absolute top-2 right-3 text-xs text-gray-500 font-mono">{shortcutHint}</span>}
    </button>
  );
}

function SaveIndicator({ state }: { state: "saved" | "saving" | "offline" }) {
  const config = {
    saved: { dot: "bg-green-500", text: "Saved" },
    saving: { dot: "bg-blue-500 animate-pulse", text: "Saving…" },
    offline: { dot: "bg-red-500", text: "Offline — will retry" },
  }[state];
  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-400">
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      {config.text}
    </span>
  );
}

function HandRaisePanel({
  queue,
  onResolve,
  enabled,
}: {
  queue: HandRaiseQueueItem[];
  onResolve: (id: string) => void;
  enabled: boolean;
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {!enabled && (
        <p className="text-xs text-gray-500 bg-[#10131b] border border-[#2d2e3b] rounded-lg px-3 py-2 mb-3">
          Questions are turned off — students can&apos;t raise their hand right now. Turn it back on in Class
          Settings → Chat &amp; Poll controls.
        </p>
      )}
      {queue.length === 0 ? (
        <p className="text-sm text-gray-500 text-center mt-8">No raised hands right now.</p>
      ) : (
        <ul className="space-y-2">
          {queue.map((h, i) => (
            <li
              key={h.id}
              className="flex items-center justify-between bg-[#10131b] border border-[#2d2e3b] rounded-lg px-3 py-2"
            >
              <div>
                <span className="text-[10px] font-bold text-blue-400 mr-1.5">#{i + 1}</span>
                <span className="text-sm font-medium text-gray-200">{h.studentName}</span>
              </div>
              <button type="button" onClick={() => onResolve(h.id)} className="text-sm text-blue-400 hover:underline">
                Clear
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <p className="text-sm font-medium text-gray-200">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={`w-11 h-6 rounded-full relative transition-colors shrink-0 disabled:opacity-50 ${
          checked ? "bg-blue-600" : "bg-gray-700"
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function SettingsModal({
  activeTab,
  setActiveTab,
  onClose,
  wbSession,
  onToggleChat,
  onToggleHandRaise,
  togglingChat,
  togglingHandRaise,
  settingsPortalRef,
}: {
  activeTab: SettingsTab;
  setActiveTab: (t: SettingsTab) => void;
  onClose: () => void;
  wbSession: WhiteboardSession;
  onToggleChat: () => void;
  onToggleHandRaise: () => void;
  togglingChat: boolean;
  togglingHandRaise: boolean;
  settingsPortalRef: React.RefObject<HTMLDivElement>;
}) {
  const TABS: { id: SettingsTab; label: string }[] = [
    { id: "audio", label: "Audio & Video" },
    { id: "chatpoll", label: "Chat & Poll controls" },
    { id: "broadcast", label: "YouTube Live Broadcast" },
    { id: "shortcuts", label: "Shortcuts" },
  ];

  const [ytLink, setYtLink] = useState("");
  const [ytSaving, setYtSaving] = useState(false);
  const [ytMessage, setYtMessage] = useState<string | null>(null);

  async function handleSaveYouTubeBroadcast() {
    if (!ytLink.trim()) return;
    setYtSaving(true);
    setYtMessage(null);
    try {
      const res = await fetch(`/api/team/live-class/${wbSession.id}/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeVideoId: ytLink.trim(),
          videoTransport: "YOUTUBE",
          livePhase: "LIVE",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setYtMessage("YouTube stream configured & set to LIVE!");
      } else {
        setYtMessage(data.error || "Failed to update broadcast.");
      }
    } catch {
      setYtMessage("Network error saving broadcast.");
    } finally {
      setYtSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1b23] w-full max-w-3xl rounded-xl shadow-2xl flex flex-col md:flex-row overflow-hidden border border-[#2d2e3b] h-[500px] max-h-[90vh]">
        <div className="w-full md:w-1/3 bg-[#1e1f2b] p-6 border-r border-[#2d2e3b] flex flex-col shrink-0">
          <div className="flex items-center gap-3 mb-8">
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
            <h2 className="text-lg font-semibold">Class Settings</h2>
          </div>
          <nav className="space-y-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                  activeTab === t.id
                    ? "bg-blue-900/20 text-blue-400 border border-blue-800/50"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white border border-transparent"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="w-full md:w-2/3 p-8 overflow-y-auto">
          {activeTab === "audio" && (
            <div>
              <h3 className="text-base font-semibold mb-1">Audio &amp; Video</h3>
              <p className="text-xs text-gray-400 mb-4">
                Choose your preferred microphone and camera — changes apply live to the class.
              </p>
              <div ref={settingsPortalRef} className="space-y-6 max-w-xs" />
            </div>
          )}
          {activeTab === "chatpoll" && (
            <div>
              <h3 className="text-base font-semibold mb-1">Chat &amp; Poll controls</h3>
              <p className="text-xs text-gray-400 mb-4">
                Turn features on or off for students. You can always send messages and see raised hands as the
                teacher, regardless of these switches.
              </p>
              <div className="divide-y divide-[#2d2e3b]">
                <ToggleRow
                  label="Student chat"
                  description="Let students send messages in the Messages tab."
                  checked={wbSession.chatEnabled}
                  onChange={onToggleChat}
                  disabled={togglingChat}
                />
                <ToggleRow
                  label="Questions (hand raise)"
                  description="Let students raise their hand to ask a question."
                  checked={wbSession.handRaiseEnabled}
                  onChange={onToggleHandRaise}
                  disabled={togglingHandRaise}
                />
              </div>
            </div>
          )}
          {activeTab === "broadcast" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold mb-1">YouTube Live Broadcast</h3>
                <p className="text-xs text-gray-400 mb-3">
                  Broadcast this class to students via an Unlisted YouTube live stream. Students will watch the stream embedded directly in the Atomic OPS classroom with synchronized chat &amp; polls.
                </p>
              </div>

              <div className="space-y-2 bg-[#12131a] p-4 rounded-xl border border-[#2d2e3b]">
                <label className="text-xs font-semibold text-gray-300 block">
                  YouTube Video / Live Stream ID or URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://youtube.com/live/... or Video ID"
                    value={ytLink}
                    onChange={(e) => setYtLink(e.target.value)}
                    className="flex-1 bg-[#1e1f2b] border border-[#2d2e3b] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    disabled={ytSaving || !ytLink.trim()}
                    onClick={handleSaveYouTubeBroadcast}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
                  >
                    {ytSaving ? "Saving..." : "Go Live on YouTube"}
                  </button>
                </div>
                {ytMessage && (
                  <p className="text-xs text-blue-400 mt-1">{ytMessage}</p>
                )}
              </div>

              <div className="text-xs text-gray-400 space-y-1 bg-[#10131b]/60 p-3 rounded-lg border border-[#2d2e3b]/50">
                <p className="font-semibold text-gray-300">Streaming Instructions:</p>
                <p>1. In YouTube Studio, create a new stream set to <strong>Unlisted</strong>.</p>
                <p>2. Paste your live stream URL or video ID above and click <strong>Go Live on YouTube</strong>.</p>
                <p>3. Start streaming from OBS or your encoder. Students will see the live video stream instantly.</p>
              </div>
            </div>
          )}
          {activeTab === "shortcuts" && (
            <div>
              <h3 className="text-base font-semibold mb-3">Keyboard shortcuts</h3>
              <div className="space-y-2">
                {SHORTCUTS.map((s) => (
                  <div key={s.combo} className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">{s.label}</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-[#10131b] border border-[#2d2e3b] text-[10px] font-mono text-gray-300">
                      {s.combo}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const THEME_PRESETS: {
  id: SlideTheme;
  label: string;
  preview: React.CSSProperties;
  overlay?: boolean;
}[] = [
  { id: "light", label: "Light", preview: { backgroundColor: "#ffffff" } },
  { id: "dark", label: "Dark", preview: { backgroundColor: "#1a1b23" } },
  {
    id: "grid",
    label: "Grid",
    preview: {
      backgroundColor: "#ffffff",
      backgroundImage:
        "linear-gradient(#9ca3af 1px, transparent 1px), linear-gradient(90deg, #9ca3af 1px, transparent 1px)",
      backgroundSize: "15px 15px",
    },
  },
  {
    id: "coordinate",
    label: "Coordinate Plane",
    preview: {
      backgroundColor: "#ffffff",
      backgroundImage:
        "linear-gradient(#d1d5db 1px, transparent 1px), linear-gradient(90deg, #d1d5db 1px, transparent 1px)",
      backgroundSize: "15px 15px",
      backgroundPosition: "center center",
    },
    overlay: true,
  },
  {
    id: "dotted",
    label: "Dotted Grid",
    preview: {
      backgroundColor: "#ffffff",
      backgroundImage: "radial-gradient(#9ca3af 1.5px, transparent 1.5px)",
      backgroundSize: "15px 15px",
    },
  },
];

function ThemeModal({
  current,
  onSelect,
  onClose,
}: {
  current: string | undefined;
  onSelect: (t: SlideTheme) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1b23] w-full max-w-2xl rounded-xl shadow-2xl flex flex-col overflow-hidden border border-[#2d2e3b] max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-[#2d2e3b] bg-[#1e1f2b]">
          <div>
            <h2 className="text-lg font-semibold">Choose your slide theme</h2>
            <p className="text-xs text-gray-400 mt-1">You can change this anytime from More on the toolbar.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white bg-[#10131b] p-2 rounded-md border border-[#2d2e3b]"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
        <div className="p-8 grid grid-cols-2 md:grid-cols-3 gap-6 overflow-y-auto">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onSelect(p.id);
                onClose();
              }}
              className="flex flex-col items-center gap-3 group"
            >
              <div
                className={`w-full aspect-video rounded-lg shadow-sm relative overflow-hidden border-2 transition-colors ${
                  current === p.id ? "border-blue-500" : "border-transparent group-hover:border-blue-500"
                }`}
                style={p.preview}
              >
                {p.overlay && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-[2px] bg-blue-500" />
                    <div className="absolute h-full w-[2px] bg-blue-500" />
                  </div>
                )}
              </div>
              <span className="text-sm font-medium text-gray-300">{p.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PollModal({
  onClose,
  activeQuiz,
  quizMetrics,
  form,
  setForm,
  error,
  launching,
  onLaunch,
  onReveal,
  onClose2,
}: {
  onClose: () => void;
  activeQuiz: ActiveQuiz | null;
  quizMetrics: { counts: Record<string, number>; totalResponses: number } | null;
  form: {
    isQuickQuiz: boolean;
    questionText: string;
    options: string[];
    correctOption: string;
    timeLimitSec: number;
  };
  setForm: (
    updater: (prev: {
      isQuickQuiz: boolean;
      questionText: string;
      options: string[];
      correctOption: string;
      timeLimitSec: number;
    }) => typeof form
  ) => void;
  error: string | null;
  launching: boolean;
  onLaunch: () => void;
  onReveal: () => void;
  onClose2: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1b23] w-full max-w-md rounded-xl shadow-2xl border border-[#2d2e3b] flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-5 border-b border-[#2d2e3b] shrink-0">
          <h2 className="text-base font-semibold">Poll</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
        <div className="p-5 overflow-y-auto">
          <QuizPanel
            activeQuiz={activeQuiz}
            quizMetrics={quizMetrics}
            form={form}
            setForm={setForm}
            error={error}
            launching={launching}
            onLaunch={onLaunch}
            onReveal={onReveal}
            onClose={onClose2}
          />
        </div>
      </div>
    </div>
  );
}

function QuizPanel({
  activeQuiz,
  quizMetrics,
  form,
  setForm,
  error,
  launching,
  onLaunch,
  onReveal,
  onClose,
}: {
  activeQuiz: ActiveQuiz | null;
  quizMetrics: { counts: Record<string, number>; totalResponses: number } | null;
  form: {
    isQuickQuiz: boolean;
    questionText: string;
    options: string[];
    correctOption: string;
    timeLimitSec: number;
  };
  setForm: (
    updater: (prev: {
      isQuickQuiz: boolean;
      questionText: string;
      options: string[];
      correctOption: string;
      timeLimitSec: number;
    }) => typeof form
  ) => void;
  error: string | null;
  launching: boolean;
  onLaunch: () => void;
  onReveal: () => void;
  onClose: () => void;
}) {
  if (activeQuiz && activeQuiz.status !== "CLOSED") {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-200">
          {activeQuiz.questionText || "Quick Quiz (board-driven)"}
        </p>
        <ul className="space-y-1.5">
          {activeQuiz.options.map((o) => {
            const count = quizMetrics?.counts[o.key] ?? 0;
            const total = quizMetrics?.totalResponses ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const isCorrect = activeQuiz.status === "REVEALED" && activeQuiz.correctOption === o.key;
            return (
              <li key={o.key} className="relative overflow-hidden rounded-lg border border-[#2d2e3b]">
                <div
                  className={`absolute inset-y-0 left-0 ${isCorrect ? "bg-green-500/20" : "bg-blue-500/10"}`}
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex items-center justify-between px-3 py-2 text-sm">
                  <span className={isCorrect ? "text-green-400 font-medium" : "text-gray-200"}>
                    {o.key}. {o.label}
                  </span>
                  <span className="text-gray-500">
                    {count} {total > 0 ? `(${pct}%)` : ""}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-gray-500">
          {quizMetrics?.totalResponses ?? 0} response{(quizMetrics?.totalResponses ?? 0) === 1 ? "" : "s"}
        </p>
        {activeQuiz.status === "ACTIVE" ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onReveal}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Reveal Answer
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <p className="text-sm text-green-400 font-medium">Revealed to the class.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-400">{error}</p>}
      <label className="flex items-center gap-2 text-sm text-gray-400">
        <input
          type="checkbox"
          checked={form.isQuickQuiz}
          onChange={(e) => setForm((f) => ({ ...f, isQuickQuiz: e.target.checked }))}
        />
        Quick Quiz (skip typing a question — poll on whatever&apos;s on the board)
      </label>
      {!form.isQuickQuiz && (
        <textarea
          rows={2}
          placeholder="Question text"
          value={form.questionText}
          onChange={(e) => setForm((f) => ({ ...f, questionText: e.target.value }))}
          className="w-full rounded-lg border border-[#2d2e3b] bg-[#10131b] text-white py-2 px-3 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      )}
      <div className="space-y-1.5">
        {form.options.map((val, i) => {
          const key = String.fromCharCode(65 + i);
          return (
            <div key={key} className="flex items-center gap-2">
              <input
                type="radio"
                name="correctOption"
                checked={form.correctOption === key}
                onChange={() => setForm((f) => ({ ...f, correctOption: key }))}
                title="Mark as correct answer"
              />
              <span className="text-sm text-gray-400 w-4">{key}</span>
              <input
                className="flex-1 rounded-lg border border-[#2d2e3b] bg-[#10131b] text-white py-1.5 px-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder={`Option ${key}`}
                value={val}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    options: f.options.map((o, idx) => (idx === i ? e.target.value : o)),
                  }))
                }
              />
            </div>
          );
        })}
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-400">
        Time limit
        <input
          type="number"
          min={5}
          max={300}
          value={form.timeLimitSec}
          onChange={(e) => setForm((f) => ({ ...f, timeLimitSec: Number(e.target.value) }))}
          className="w-16 rounded-lg border border-[#2d2e3b] bg-[#10131b] text-white py-1 px-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
        sec
      </label>
      <button
        type="button"
        disabled={launching}
        onClick={onLaunch}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60 transition-colors"
      >
        {launching ? "Launching…" : "Launch Quiz"}
      </button>
    </div>
  );
}
