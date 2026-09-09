"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CanvasEngine,
  type StrokeObject,
  type CanvasTool,
  type ShapeKind,
  TEXT_FONT_SCALE,
  VIRTUAL_WIDTH,
  VIRTUAL_HEIGHT,
} from "@/lib/canvas/canvas-engine";
import { getPusherClient } from "@/lib/realtime/pusher-client";
import { sessionChannel, teacherChannel, WB_EVENTS } from "@/lib/realtime/events";
import { VideoStrip } from "@/components/live-class/VideoStrip";
import { MessagesPanel } from "@/components/live-class/MessagesPanel";
import { ParticipantsPanel } from "@/components/live-class/ParticipantsPanel";
import { Simulation3DModal } from "@/components/live-class/Simulation3DModal";
import { ScienceLabsModal } from "@/components/live-class/ScienceLabsModal";
import { PreFlightSetupWizard, type PreFlightConfig } from "@/components/live-class/PreFlightSetupWizard";
import { TeacherPostClassModal } from "@/components/live-class/TeacherPostClassModal";
import { SlideTemplatesModal } from "@/components/live-class/SlideTemplatesModal";
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
  presentationUrl?: string | null;
  presentationName?: string | null;
  presentationType?: "PDF" | "PPTX" | string | null;
  classroomTheme?: "LIGHT" | "DARK" | string;
  cameraShape?: "SQUARE" | "CIRCULAR" | string;
  cameraPosition?: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  actualStartedAt?: string | null;
  actualEndedAt?: string | null;
  totalExtendedMinutes?: number;
  pages: WhiteboardPage[];
};
type HandRaiseQueueItem = {
  id: string;
  studentId: string;
  studentName: string;
  raisedAt: string;
  requestType?: "CHAT" | "AUDIO" | "VIDEO";
  status?: "PENDING" | "APPROVED" | "REJECTED" | "RESOLVED";
  liveKitGranted?: boolean;
};

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
type SlideTheme =
  | "atomic_white"
  | "atomic_dark"
  | "atomic_ruled"
  | "grid"
  | "dark"
  | "light"
  | "coordinate"
  | "ruled"
  | "dotted"
  | (string & {});

type SubjectShapeCategory = "math" | "phys" | "chem" | "bio";

const SUBJECT_SHAPES: Record<
  SubjectShapeCategory,
  { id: ShapeKind; label: string; icon: string }[]
> = {
  math: [
    { id: "line", label: "Line", icon: "horizontal_rule" },
    { id: "arrow", label: "Arrow", icon: "north_east" },
    { id: "rectangle", label: "Rectangle / Box", icon: "crop_square" },
    { id: "circle", label: "Circle / Ellipse", icon: "circle" },
    { id: "triangle", label: "Triangle", icon: "change_history" },
    { id: "arrow", label: "Double Arrow", icon: "sync_alt" },
    { id: "triangle", label: "Right-Angled T...", icon: "play_arrow" },
    { id: "line", label: "XY Coordinate ...", icon: "show_chart" },
    { id: "rectangle", label: "Cylinder (3D)", icon: "view_in_ar" },
    { id: "circle", label: "Polygon / Hexa...", icon: "hexagon" },
    { id: "circle", label: "Star", icon: "star" },
  ],
  phys: [
    { id: "rectangle", label: "Resistor", icon: "reorder" },
    { id: "rectangle", label: "Capacitor", icon: "pause" },
    { id: "line", label: "Inductor", icon: "waves" },
    { id: "rectangle", label: "Battery Cell", icon: "battery_charging_full" },
    { id: "circle", label: "Pulley", icon: "radio_button_checked" },
    { id: "triangle", label: "Optics Prism", icon: "change_history" },
    { id: "rectangle", label: "Bar Magnet", icon: "crop_5_4" },
  ],
  chem: [
    { id: "circle", label: "Benzene Ring", icon: "hexagon" },
    { id: "triangle", label: "Flask / Beaker", icon: "science" },
    { id: "circle", label: "Atom Model", icon: "bubble_chart" },
    { id: "rectangle", label: "Test Tube", icon: "biotech" },
    { id: "line", label: "Double Bond", icon: "drag_handle" },
  ],
  bio: [
    { id: "circle", label: "DNA Helix", icon: "grain" },
    { id: "circle", label: "Animal Cell", icon: "lens" },
    { id: "line", label: "Neuron Cell", icon: "hub" },
    { id: "circle", label: "Human Heart", icon: "favorite" },
    { id: "circle", label: "Plant Leaf", icon: "eco" },
  ],
};

const SHAPE_TOOLS = SUBJECT_SHAPES.math;

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
export const PEN_PALETTE_COLORS = [
  "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#6366f1", "#3b82f6",
  "#06b6d4", "#ec4899", "#15803d",
  "#000000", "#64748b", "#ffffff",
];

export const PEN_STYLES = [
  { id: "hard", label: "Hard-tipped", icon: "edit" },
  { id: "fountain", label: "Fountain", icon: "ink_pen" },
  { id: "chisel", label: "Chisel", icon: "border_color" },
  { id: "art", label: "Art", icon: "brush" },
  { id: "graphite", label: "Graphite", icon: "gesture" },
  { id: "magic", label: "Magic", icon: "auto_awesome" },
] as const;

export type PenStyleId = typeof PEN_STYLES[number]["id"];

const HIGHLIGHT_COLORS = ["#ef4444", "#eab308", "#22c55e", "#3b82f6"];
export const LEFT_BAR_COLORS = [
  "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#06b6d4", "#3b82f6",
  "#ec4899", "#ffffff",
];
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
    case "atomic_white":
      return {
        backgroundColor: "#ffffff",
        backgroundImage:
          "linear-gradient(to bottom, #fff7ed 0px, #fff7ed 36px, #ea580c 36px, #ea580c 38px, transparent 38px)",
      };
    case "atomic_dark":
      return {
        backgroundColor: "#0d0f17",
        backgroundImage:
          "linear-gradient(to bottom, #171924 0px, #171924 36px, #ea580c 36px, #ea580c 38px, transparent 38px)",
      };
    case "atomic_ruled":
      return {
        backgroundColor: "#ffffff",
        backgroundImage:
          "linear-gradient(to bottom, #fff7ed 0px, #fff7ed 36px, #ea580c 36px, #ea580c 38px, transparent 38px), repeating-linear-gradient(to bottom, transparent, transparent 27px, #e2e8f0 27px, #e2e8f0 28px)",
        backgroundPosition: "0 0, 0 38px",
      };
    case "ruled":
    case "notebook":
      return {
        backgroundColor: "#ffffff",
        backgroundImage: "repeating-linear-gradient(to bottom, transparent, transparent 27px, #e2e8f0 27px, #e2e8f0 28px)",
      };
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

function formatHms(totalSec: number) {
  const isNeg = totalSec < 0;
  const abs = Math.abs(totalSec);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${isNeg ? "-" : ""}${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatDurationFriendly(totalSec: number) {
  const abs = Math.abs(totalSec);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

type SettingsTab = "audio" | "chatpoll" | "broadcast" | "shortcuts";
type PopupId = "pen" | "highlight" | "eraser" | "shapes" | "pages" | "zoom" | "more" | "pollMenu" | null;

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
  const [penStyle, setPenStyle] = useState<PenStyleId>("hard");
  const [color, setColor] = useState<string>(PEN_PALETTE_COLORS[0] ?? "#ef4444");
  const [size, setSize] = useState(5);
  // Read inside the canvas engine's onTextRequested callback (bound once
  // per session in the canvas-lifecycle effect below), which needs the
  // CURRENT color/size, not a stale one captured when the engine was
  // constructed — same reason rightTabRef exists for the Pusher handler
  // further down this file.
  const colorRef = useRef(color);
  useEffect(() => {
    colorRef.current = color;
  }, [color]);
  const sizeRef = useRef(size);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);
  // Text tool's on-canvas entry overlay. `id: null` = creating a brand-new
  // text object; a non-null id = re-editing an existing one opened via
  // double-click with the select tool (see handleCanvasDoubleClick).
  const [textEditor, setTextEditor] = useState<{
    id: string | null;
    x: number;
    y: number;
    text: string;
    fontSizePx: number;
    color: string;
  } | null>(null);
  const [undoRedoTick, setUndoRedoTick] = useState(0);
  const [zoom, setZoom] = useState(1);
  // Below lg the right panel slides in over the canvas rather than holding
  // a fixed 320px column open on a phone. It is never unmounted - see the
  // .live-panel rules in globals.css and the VideoStrip note below.
  const [panelOpen, setPanelOpen] = useState(false);
  const mainCanvasContainerRef = useRef<HTMLElement>(null);
  const [stageDimensions, setStageDimensions] = useState<{ width: number; height: number }>({ width: 960, height: 540 });

  useEffect(() => {
    if (!mainCanvasContainerRef.current) return;
    const computeStage = () => {
      const el = mainCanvasContainerRef.current;
      if (!el) return;
      const { clientWidth, clientHeight } = el;
      if (clientWidth <= 0 || clientHeight <= 0) return;
      // Maximize canvas drawing area to full available screen
      const padW = 2;
      const padH = 2;
      const availW = Math.max(200, clientWidth - padW);
      const availH = Math.max(150, clientHeight - padH);
      let w = availW;
      let h = Math.round(w * (9 / 16));
      if (h > availH) {
        h = availH;
        w = Math.round(h * (16 / 9));
      }
      setStageDimensions({ width: w, height: h });
    };
    computeStage();
    const ro = new ResizeObserver(computeStage);
    ro.observe(mainCanvasContainerRef.current);
    return () => ro.disconnect();
  }, []);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  // Surfaces real progress/errors for "load the uploaded presentation onto
  // the board as pages" — deliberately visible state, not console.error,
  // per the no-silent-failures requirement for this feature.
  const [pdfLoadState, setPdfLoadState] = useState<{
    loading: boolean;
    progress: string | null;
    error: string | null;
  }>({ loading: false, progress: null, error: null });
  const [openPopup, setOpenPopup] = useState<PopupId>(null);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [sim3dOpen, setSim3dOpen] = useState(false);
  const [scienceLabsOpen, setScienceLabsOpen] = useState(false);
  const [shapeSubjectTab, setShapeSubjectTab] = useState<SubjectShapeCategory>("math");
  const [pollOpen, setPollOpen] = useState(false);
  const [pollModalTab, setPollModalTab] = useState<"quiz" | "ranks">("quiz");
  const [pollType, setPollType] = useState<"mcq4" | "yesno">("mcq4");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("audio");
  const [togglingChat, setTogglingChat] = useState(false);
  const [togglingHandRaise, setTogglingHandRaise] = useState(false);

  const [saveState, setSaveState] = useState<"saved" | "saving" | "offline">("saved");
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [showPostClassModal, setShowPostClassModal] = useState(false);
  const [startingClass, setStartingClass] = useState(false);
  const [startClassError, setStartClassError] = useState<string | null>(null);
  const [slideTemplatesOpen, setSlideTemplatesOpen] = useState(false);

  // Pre-flight & Authoritative System State
  const [showPreFlightWizard, setShowPreFlightWizard] = useState(false);
  const [extendingTime, setExtendingTime] = useState(false);
  const [extensionMenuOpen, setExtensionMenuOpen] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());
  const serverTimeOffsetRef = useRef<number>(0);

  const [studentCount, setStudentCount] = useState(0);
  const [handRaiseQueue, setHandRaiseQueue] = useState<HandRaiseQueueItem[]>([]);
  const [rightTab, setRightTab] = useState<"messages" | "questions" | "roster">("messages");
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
    options: ["Option A", "Option B", "Option C", "Option D"],
    correctOption: "A",
    timeLimitSec: 45,
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
        if (!cancelled) {
          const sess = data.whiteboardSession;
          setWbSession(sess);
          if (
            sess?.livePhase === "ENDING" ||
            sess?.livePhase === "ENDED" ||
            sess?.status === "ENDED"
          ) {
            setShowPostClassModal(true);
          } else if (!sess?.presentationUrl && sess?.livePhase !== "LIVE") {
            setShowPreFlightWizard(true);
          } else if (
            sess?.presentationUrl &&
            sess?.pages.length === 1 &&
            !isBackgroundImageUrl(sess.pages[0]?.background)
          ) {
            // Auto-load PDF onto canvas pages when entering class
            handleLoadPresentationPdf(sess);
          }
        }

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
        autosaveTimer.current = setTimeout(() => flushAutosaveRef.current(), 50);
        setUndoRedoTick((t) => t + 1);
      },
      () => setUndoRedoTick((t) => t + 1)
    );
    engineRef.current = engine;
    // The engine has no DOM of its own to render a text-entry UI, so on a
    // "text" tool click it hands the click point back here and this opens
    // a positioned <textarea> overlay instead.
    engine.onTextRequested = (pt) => {
      setTextEditor({
        id: null,
        x: pt.x,
        y: pt.y,
        text: "",
        fontSizePx: sizeRef.current * TEXT_FONT_SCALE,
        color: colorRef.current,
      });
    };
    if (currentPage) engine.loadObjects(currentPage.objects ?? []);

    // Keep the canvas backing store's pixel size synced to its actual
    // rendered box at all times, not just on browser-window resize. A
    // plain `window.resize` listener (the old approach) never fires for
    // layout-only changes - the side panel opening/closing, this page's
    // own initial layout still settling on mount, a PDF panel changing
    // width - so the backing store could silently go stale relative to
    // the visible card: strokes are stored correctly in virtual space
    // (see canvas-engine.ts), but syncSize()'s scale transform and pixel
    // buffer size were computed for whatever box existed the last time it
    // ran, leaving part of the visible white card outside the actually
    // synced/writable area. ResizeObserver catches every one of those
    // cases (and fires once immediately with the settled size, so it also
    // replaces the old synchronous syncSize() call that could run before
    // layout had finished). The student board mirror already uses this
    // same pattern for the same reason.
    const ro = new ResizeObserver(() => engine.syncSize());
    ro.observe(baseCanvasRef.current);

    return () => {
      ro.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
  }, [wbSession?.id]);

  const lastLoadedPageIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.syncSize();
    if (currentPage && currentPage.id !== lastLoadedPageIdRef.current) {
      lastLoadedPageIdRef.current = currentPage.id;
      engineRef.current.loadObjects(currentPage.objects ?? []);
    }
  }, [stageDimensions, currentPage?.id]);

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

  // ---- Text tool overlay: commit / cancel / re-edit-on-double-click ------
  // Commits whatever is in the overlay right now — new text via
  // addTextObject, an in-place re-edit via updateTextObject — then always
  // drops back to the select tool, matching "place text, done" rather than
  // leaving the user in text mode where the next click would silently place
  // another box. Everything it needs travels in `textEditor` itself or via
  // stable refs, so it never goes stale and needs no dependency array.
  const commitTextEditor = useCallback(() => {
    setTextEditor((prev) => {
      if (!prev) return null;
      const engine = engineRef.current;
      if (engine) {
        if (prev.id) {
          engine.updateTextObject(prev.id, prev.text);
        } else {
          engine.addTextObject(prev.text, { x: prev.x, y: prev.y }, prev.color, prev.fontSizePx);
        }
      }
      return null;
    });
    setTool((t) => (t === "text" ? "select" : t));
  }, []);

  const cancelTextEditor = useCallback(() => {
    setTextEditor(null);
    setTool((t) => (t === "text" ? "select" : t));
  }, []);

  // Double-click an existing text object with the select tool active to
  // re-open it for editing — otherwise a typo could only ever be fixed by
  // deleting the whole object and retyping it.
  const handleCanvasDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (tool !== "select" || !engineRef.current || !activeCanvasRef.current) return;
      const rect = activeCanvasRef.current.getBoundingClientRect();
      const relX = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
      const relY = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0;
      const pt = { x: relX * VIRTUAL_WIDTH, y: relY * VIRTUAL_HEIGHT };
      const hit = engineRef.current.getTextObjectAt(pt);
      if (hit) {
        setTextEditor({
          id: hit.id,
          x: hit.position.x,
          y: hit.position.y,
          text: hit.text,
          fontSizePx: hit.size,
          color: hit.color,
        });
      }
    },
    [tool]
  );

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
    presence.bind(WB_EVENTS.SESSION_EXTENDED, (data: { addedMinutes: number; newScheduledEnd: string; totalExtendedMinutes: number }) => {
      setWbSession((prev) =>
        prev
          ? {
              ...prev,
              scheduledEnd: data.newScheduledEnd,
              totalExtendedMinutes: data.totalExtendedMinutes,
            }
          : prev
      );
    });
    presence.bind(WB_EVENTS.CONFIG_UPDATED, (data: any) => {
      setWbSession((prev) =>
        prev
          ? {
              ...prev,
              presentationUrl: data.presentationUrl ?? prev.presentationUrl,
              presentationName: data.presentationName ?? prev.presentationName,
              presentationType: data.presentationType ?? prev.presentationType,
              classroomTheme: data.classroomTheme ?? prev.classroomTheme,
              cameraShape: data.cameraShape ?? prev.cameraShape,
            }
          : prev
      );
    });

    const teacherCh = client.subscribe(teacherChannel(wbSession.id));
    const onHandRaiseUpdate = (data: { queue: HandRaiseQueueItem[] }) => {
      if (Array.isArray(data?.queue)) {
        setHandRaiseQueue(data.queue);
      }
    };
    teacherCh.bind(WB_EVENTS.HAND_RAISE_LIST, onHandRaiseUpdate);
    presence.bind(WB_EVENTS.HAND_RAISE_LIST, onHandRaiseUpdate);

    teacherCh.bind(
      WB_EVENTS.QUIZ_METRICS,
      (data: { quizSessionId: string; counts: Record<string, number>; totalResponses: number }) => {
        if (activeQuizIdRef.current !== data.quizSessionId) return;
        setQuizMetrics({ counts: data.counts, totalResponses: data.totalResponses });
      }
    );

    // Initial hand-raise queue snapshot (Pusher only pushes on change).
    const refreshHandRaises = () => {
      getJson(`/api/whiteboard/sessions/${wbSession.id}/hand-raise`)
        .then((data) => {
          if (Array.isArray(data?.queue)) {
            setHandRaiseQueue(data.queue);
          }
        })
        .catch(() => {});
    };
    refreshHandRaises();

    // 3-second fallback interval so teacher never misses a hand raise due to socket latency
    const handRaisePoll = setInterval(refreshHandRaises, 3000);

    return () => {
      clearInterval(handRaisePoll);
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

  async function handleAddPageWithTemplate(bgValue: string) {
    if (!wbSession) return;
    try {
      const data = await postJson(`/api/whiteboard/sessions/${wbSession.id}/pages`);
      const newPage = data.page as WhiteboardPage;
      await patchJson(`/api/whiteboard/sessions/${wbSession.id}/pages/${newPage.id}`, {
        background: bgValue,
        objects: [],
      });
      const updatedPage = { ...newPage, background: bgValue };
      setWbSession((prev) =>
        prev
          ? {
              ...prev,
              pages: [...prev.pages.filter((p) => p.id !== newPage.id), updatedPage],
              activePageNumber: updatedPage.pageNumber,
            }
          : prev
      );
      engineRef.current?.loadObjects([]);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not add template page.");
    }
  }

  // Global shortcuts for educator whiteboard: Ctrl+D for Templates, Ctrl+Z, Ctrl+Y, Shift+N, Shift+C
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if typing inside text area or text input
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      // Ctrl+D or Cmd+D -> Open Inbuilt Slide Templates
      if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        e.stopPropagation();
        setSlideTemplatesOpen((prev) => !prev);
        return;
      }

      // Ctrl+Z -> Undo
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
        e.preventDefault();
        if (engineRef.current?.canUndo()) {
          engineRef.current.undo();
          setUndoRedoTick((t) => t + 1);
        }
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z -> Redo
      if (
        ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "z" || e.key === "Z"))
      ) {
        e.preventDefault();
        if (engineRef.current?.canRedo()) {
          engineRef.current.redo();
          setUndoRedoTick((t) => t + 1);
        }
        return;
      }

      // Shift+N -> Add page
      if (e.shiftKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        addPage();
        return;
      }

      // Shift+C -> Clear page ink
      if (e.shiftKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        engineRef.current?.clearInk();
        return;
      }

      // Page navigation: PageDown / Alt+Right -> Next Page, PageUp / Alt+Left -> Prev Page
      if (!e.ctrlKey && !e.metaKey && (e.key === "PageDown" || (e.altKey && e.key === "ArrowRight"))) {
        if (wbSession && wbSession.activePageNumber < wbSession.pages.length) {
          e.preventDefault();
          switchToPage(wbSession.activePageNumber + 1);
        }
        return;
      }

      if (!e.ctrlKey && !e.metaKey && (e.key === "PageUp" || (e.altKey && e.key === "ArrowLeft"))) {
        if (wbSession && wbSession.activePageNumber > 1) {
          e.preventDefault();
          switchToPage(wbSession.activePageNumber - 1);
        }
        return;
      }

      // Pen tablet quick tool shortcuts (1=Pen, 2=Highlighter, 3=Eraser, 4=Select, T=Text)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "1" || e.key === "p" || e.key === "P") {
          setTool("pen");
          return;
        }
        if (e.key === "2" || e.key === "h" || e.key === "H") {
          setTool("highlighter");
          return;
        }
        if (e.key === "3" || e.key === "e" || e.key === "E") {
          setTool("stroke-eraser");
          return;
        }
        if (e.key === "4" || e.key === "s" || e.key === "S") {
          setTool("select");
          return;
        }
        if (e.key === "t" || e.key === "T") {
          setTool("text");
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [wbSession?.id, wbSession?.activePageNumber, wbSession?.pages.length]);

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

  const exportBoardAsImage = useCallback(() => {
    if (!baseCanvasRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = VIRTUAL_WIDTH;
    canvas.height = VIRTUAL_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (currentPage?.background === "dark") {
      ctx.fillStyle = "#1a1b23";
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    ctx.drawImage(baseCanvasRef.current, 0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    const link = document.createElement("a");
    const safeTitle = (scheduleTitle || "Whiteboard").replace(/[^a-z0-9]/gi, "_");
    link.download = `${safeTitle}_Slide_${currentPage?.pageNumber ?? 1}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [currentPage, scheduleTitle]);

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

  /** Shared by handleLoadPresentationPdf: converts a rendered-page data URL
   * into a File and posts it through the existing background-upload route
   * — the same request handleBackgroundFileChange/handleInsertSimulationImage
   * make, just parameterized on which page it targets. */
  async function uploadPageBackgroundImage(sessionId: string, pageId: string, dataUrl: string): Promise<string> {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], `pdf-page-${Date.now()}.png`, { type: "image/png" });
    const formData = new FormData();
    formData.append("file", file);
    const uploadRes = await fetch(`/api/whiteboard/sessions/${sessionId}/pages/${pageId}/background`, {
      method: "POST",
      body: formData,
    });
    const json = await uploadRes.json();
    if (!uploadRes.ok || !json.success) {
      throw new Error(json.error ?? "Could not upload the rendered page image.");
    }
    return json.data.page.background as string;
  }

  /**
   * Pulls the PDF uploaded via the Pre-Flight "Material & Setup" wizard onto
   * the board as real, annotatable pages — before this, `presentationUrl`
   * was only ever shown as a filename badge in the header and never
   * actually reached the canvas. Renders each page client-side with pdfjs
   * (same proven approach as src/components/shared/WhiteboardCanvas.tsx's
   * PDF import — dynamic import + the /public pdf.worker.min.mjs asset, so
   * webpack/Terser never has to touch the worker's ES module code), then
   * uploads each rendered page through the existing per-page background
   * route so it persists and board-mirrors to students exactly like any
   * other background image.
   *
   * Never silently swallows a failure: every error (download, corrupt PDF,
   * page-cap, an individual upload) lands in pdfLoadState.error so the
   * teacher sees it, instead of the page quietly staying blank.
   */
  async function handleLoadPresentationPdf(sessionArg?: WhiteboardSession) {
    const activeSess = sessionArg || wbSession;
    if (!activeSess) return;
    const url = activeSess.presentationUrl;
    const isPdf = !!url && (activeSess.presentationType === "PDF" || /\.pdf(\?|$)/i.test(url));
    if (!url || !isPdf) {
      setPdfLoadState({
        loading: false,
        progress: null,
        error: "No PDF is set for this class yet — add one via Material & Setup first.",
      });
      return;
    }

    setOpenPopup(null);
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    await flushAutosave();

    setPdfLoadState({ loading: true, progress: "Downloading PDF…", error: null });
    const sessionId = activeSess.id;
    let firstNewPageNumber: number | null = null;

    try {
      const fileRes = await fetch(url);
      if (!fileRes.ok) throw new Error(`Could not download the presentation file (HTTP ${fileRes.status}).`);
      const arrayBuffer = await fileRes.arrayBuffer();

      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      const existingPageCount = activeSess.pages.length;
      if (existingPageCount + doc.numPages > 50) {
        throw new Error(
          `This PDF has ${doc.numPages} pages, which would push the board past its 50-page-per-class limit (currently ${existingPageCount}).`
        );
      }

      // Reuse the current page as slide 1's canvas only when it's the
      // untouched default first page of a brand-new session — never
      // silently overwrite a page the teacher has already drawn on.
      const currentPg = activeSess.pages.find((p) => p.pageNumber === activeSess.activePageNumber) ?? null;
      const reuseCurrentPage =
        existingPageCount === 1 &&
        currentPg != null &&
        (currentPg.objects?.length ?? 0) === 0 &&
        !isBackgroundImageUrl(currentPg.background);

      for (let i = 1; i <= doc.numPages; i++) {
        setPdfLoadState({ loading: true, progress: `Rendering page ${i} of ${doc.numPages}…`, error: null });

        const pdfPage = await doc.getPage(i);
        const unscaledViewport = pdfPage.getViewport({ scale: 1 });
        const scaleX = VIRTUAL_WIDTH / unscaledViewport.width;
        const scaleY = VIRTUAL_HEIGHT / unscaledViewport.height;
        const fitScale = Math.min(scaleX, scaleY);
        const scaledViewport = pdfPage.getViewport({ scale: fitScale });

        const offscreen = document.createElement("canvas");
        offscreen.width = VIRTUAL_WIDTH;
        offscreen.height = VIRTUAL_HEIGHT;
        const offCtx = offscreen.getContext("2d");
        if (!offCtx) throw new Error("Could not prepare the page image (canvas unavailable).");
        offCtx.fillStyle = "#ffffff";
        offCtx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

        // Center the page horizontally and vertically on 1920x1080 slide
        const offsetX = Math.round((VIRTUAL_WIDTH - scaledViewport.width) / 2);
        const offsetY = Math.round((VIRTUAL_HEIGHT - scaledViewport.height) / 2);
        offCtx.save();
        offCtx.translate(offsetX, offsetY);
        await pdfPage.render({ canvasContext: offCtx, viewport: scaledViewport }).promise;
        offCtx.restore();
        const dataUrl = offscreen.toDataURL("image/png");

        let targetPageId: string;
        let targetPageNumber: number;
        if (i === 1 && reuseCurrentPage) {
          targetPageId = currentPage!.id;
          targetPageNumber = currentPage!.pageNumber;
        } else {
          const data = await postJson(`/api/whiteboard/sessions/${sessionId}/pages`);
          const newPage = data.page as WhiteboardPage;
          setWbSession((prev) =>
            prev ? { ...prev, pages: [...prev.pages, newPage], activePageNumber: newPage.pageNumber } : prev
          );
          targetPageId = newPage.id;
          targetPageNumber = newPage.pageNumber;
        }

        setPdfLoadState({ loading: true, progress: `Uploading page ${i} of ${doc.numPages}…`, error: null });
        const background = await uploadPageBackgroundImage(sessionId, targetPageId, dataUrl);
        setWbSession((prev) =>
          prev
            ? { ...prev, pages: prev.pages.map((p) => (p.id === targetPageId ? { ...p, background } : p)) }
            : prev
        );

        if (firstNewPageNumber === null) firstNewPageNumber = targetPageNumber;
      }

      if (firstNewPageNumber !== null) await switchToPage(firstNewPageNumber);
      setPdfLoadState({ loading: false, progress: null, error: null });
    } catch (err) {
      if (firstNewPageNumber !== null) switchToPage(firstNewPageNumber).catch(() => undefined);
      setPdfLoadState({
        loading: false,
        progress: null,
        error: err instanceof Error ? err.message : "Could not load the presentation onto the board.",
      });
    }
  }

  async function setSlideTheme(theme: SlideTheme) {
    if (!wbSession || !currentPage) return;
    setOpenPopup(null);

    // 1. INSTANT OPTIMISTIC LOCAL UPDATE (0ms delay)
    setWbSession((prev) =>
      prev
        ? { ...prev, pages: prev.pages.map((p) => (p.id === currentPage.id ? { ...p, background: theme } : p)) }
        : prev
    );

    // 2. ASYNC PERSIST (Non-blocking)
    patchJson(`/api/whiteboard/sessions/${wbSession.id}/pages/${currentPage.id}`, {
      objects: engineRef.current?.getObjects() ?? currentPage.objects,
      background: theme,
    }).catch((err) => {
      console.error("Failed to sync slide theme to backend:", err);
    });
  }

  async function handleInsertSimulationImage(dataUrl: string) {
    if (!wbSession || !currentPage) return;
    setWbSession((prev) =>
      prev
        ? {
            ...prev,
            pages: prev.pages.map((p) => (p.id === currentPage.id ? { ...p, background: dataUrl } : p)),
          }
        : prev
    );
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `simulation_${Date.now()}.png`, { type: "image/png" });
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch(
        `/api/whiteboard/sessions/${wbSession.id}/pages/${currentPage.id}/background`,
        { method: "POST", body: formData }
      );
      const json = await uploadRes.json();
      if (uploadRes.ok && json.success) {
        const background: string = json.data.page.background;
        setWbSession((prev) =>
          prev
            ? {
                ...prev,
                pages: prev.pages.map((p) => (p.id === currentPage.id ? { ...p, background } : p)),
              }
            : prev
        );
      }
    } catch (err) {
      console.error("Failed to upload simulation snapshot background:", err);
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

  // Safety guard against accidental tab closing/navigation during live session
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (wbSession?.livePhase === "LIVE") {
        e.preventDefault();
        e.returnValue = "A live class is currently active. Are you sure you want to exit?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [wbSession?.livePhase]);

  // ---- Start class (authoritative server validation) -------------------
  async function startClass() {
    if (!wbSession || startingClass) return;
    setStartingClass(true);
    setStartClassError(null);
    try {
      const data = await postJson(`/api/team/live-class/${batchScheduleId}/start`, {});
      if (data.whiteboardSession) {
        setWbSession((prev) =>
          prev ? { ...prev, ...data.whiteboardSession, livePhase: "LIVE" } : data.whiteboardSession
        );
      }
    } catch (err) {
      setStartClassError(err instanceof Error ? err.message : "Could not start the class.");
    } finally {
      setStartingClass(false);
    }
  }

  // ---- Extend class (+5, +10, +15, +30, +60 minutes) -------------------
  async function extendClass(minutes: number) {
    if (!wbSession || extendingTime) return;
    setExtendingTime(true);
    try {
      const data = await postJson(`/api/team/live-class/${batchScheduleId}/extend`, { addedMinutes: minutes });
      if (data.whiteboardSession) {
        setWbSession((prev) =>
          prev ? { ...prev, ...data.whiteboardSession } : data.whiteboardSession
        );
      }
      setExtensionMenuOpen(false);
    } catch (err: any) {
      alert(err instanceof Error ? err.message : "Could not extend the class.");
    } finally {
      setExtendingTime(false);
    }
  }

  // ---- Authoritative Countdown, Grace Period & Timer State --------------
  const autoEndTriggeredRef = useRef(false);

  // Fetch server time on mount to sync clock skew
  useEffect(() => {
    fetch("/api/time")
      .then((res) => res.json())
      .then((data) => {
        if (data?.serverTimeMs) {
          serverTimeOffsetRef.current = data.serverTimeMs - Date.now();
          setCurrentTimeMs(Date.now() + serverTimeOffsetRef.current);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimeMs(Date.now() + serverTimeOffsetRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Periodic heartbeat while class is active
  useEffect(() => {
    if (!wbSession?.id) return;
    const sendHeartbeat = () => {
      fetch(`/api/whiteboard/sessions/${wbSession.id}/heartbeat`, { method: "POST" }).catch(() => {});
    };
    sendHeartbeat();
    const hbInterval = setInterval(sendHeartbeat, 25000);
    return () => clearInterval(hbInterval);
  }, [wbSession?.id]);


  const scheduledStartMs = wbSession?.scheduledStart ? new Date(wbSession.scheduledStart).getTime() : 0;
  const scheduledEndMs = wbSession?.scheduledEnd
    ? new Date(wbSession.scheduledEnd).getTime()
    : new Date(endsAt).getTime();
  const actualStartedAtMs = wbSession?.actualStartedAt
    ? new Date(wbSession.actualStartedAt).getTime()
    : wbSession?.startedAt
    ? new Date(wbSession.startedAt).getTime()
    : null;

  // Waiting mode timing (Authoritative T-5 Rule: Start Class unlocks at T-5)
  const secondsUntilStart = scheduledStartMs > 0 ? Math.floor((scheduledStartMs - currentTimeMs) / 1000) : 0;
  const isStartWindowOpen = scheduledStartMs === 0 || currentTimeMs >= scheduledStartMs - 5 * 60 * 1000;
  const canStartClass = isStartWindowOpen && wbSession?.livePhase !== "LIVE";

  // Live mode timing
  const elapsedSeconds = actualStartedAtMs ? Math.max(0, Math.floor((currentTimeMs - actualStartedAtMs) / 1000)) : 0;
  const remainingSeconds = Math.floor((scheduledEndMs - currentTimeMs) / 1000);
  const isInGracePeriod = remainingSeconds <= 0 && remainingSeconds > -GRACE_PERIOD_MINUTES * 60;
  const graceSecondsLeft = Math.max(0, GRACE_PERIOD_MINUTES * 60 + remainingSeconds);
  const minutesRemaining = Math.ceil(remainingSeconds / 60);

  // Auto-end trigger when grace period fully expires
  useEffect(() => {
    const gracePeriodExpired = currentTimeMs > scheduledEndMs + GRACE_PERIOD_MINUTES * 60_000;
    if (gracePeriodExpired && !autoEndTriggeredRef.current && wbSession?.status === "ACTIVE" && !ending && wbSession.livePhase === "LIVE") {
      autoEndTriggeredRef.current = true;
      endClass();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTimeMs, scheduledEndMs, wbSession?.status, wbSession?.livePhase]);

  // ---- End class -------------------------------------------------------------
  async function endClass() {
    if (!wbSession) return;
    setEnding(true);
    try {
      await postJson(`/api/whiteboard/sessions/${wbSession.id}/end`);
      setWbSession((prev) => (prev ? { ...prev, status: "ENDED", livePhase: "ENDED" } : prev));
      setShowPostClassModal(true);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not end the class.");
    } finally {
      setEnding(false);
      setConfirmingEnd(false);
    }
  }

  // ---- Hand raise actions: approve, reject, or clear ----------------------
  async function handleHandRaiseAction(id: string, action: "approve" | "reject" | "clear") {
    if (!wbSession) return;
    try {
      await patchJson(`/api/whiteboard/sessions/${wbSession.id}/hand-raise/${id}`, { action });
    } catch {
      // queue re-syncs on the next Pusher push / manual refresh either way
    }
  }

  async function resolveHandRaise(id: string) {
    return handleHandRaiseAction(id, "clear");
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

  const canGoPrev = wbSession.activePageNumber > 1;
  const canGoNext = wbSession.activePageNumber < wbSession.pages.length;
  const pollActive = !!activeQuiz && activeQuiz.status !== "CLOSED";
  const isClassLive = wbSession.livePhase === "LIVE";

  return (
    <div
      ref={containerRef}
      className="live-shell fixed inset-0 bg-[#10131b] text-white overflow-hidden select-none z-modal"
    >
      <input
        ref={backgroundFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleBackgroundFileChange}
        className="hidden"
      />

      {/* Left rail */}
      <aside className="live-rail border-r border-[#2d2e3b] bg-[#1a1b23] flex-col items-center py-4">
        <button
          type="button"
          onClick={() => router.push("/team/batches")}
          className="w-10 h-10 rounded-xl overflow-hidden p-1 hover:opacity-85 transition-opacity"
          title="Atomic Pathshala"
        >
          <img
            src="/brand/logo.png"
            alt="Atomic Pathshala Logo"
            className="w-full h-full object-contain"
          />
        </button>
      </aside>

      {/* Header */}
      <header className="live-header flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 lg:px-6 border-b border-[#2d2e3b] bg-[#1a1b23] min-w-0">
        <div className="min-w-0 flex items-center gap-3">
          <div>
            <p className="text-[11px] text-gray-500 truncate">{batchName}</p>
            <h1 className="text-sm font-medium text-gray-200 truncate">{scheduleTitle}</h1>
          </div>
          {wbSession.presentationUrl ? (
            <button
              type="button"
              disabled={pdfLoadState.loading}
              onClick={() => handleLoadPresentationPdf()}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/40 transition active:scale-95 shadow cursor-pointer"
              title="Click to load or reload PDF presentation onto whiteboard slides"
            >
              <span className="material-symbols-outlined text-xs">picture_as_pdf</span>
              <span className="truncate max-w-[200px]">{wbSession.presentationName || "Presentation PDF"}</span>
              <span className={`material-symbols-outlined text-xs text-blue-400 ${pdfLoadState.loading ? "animate-spin" : ""}`}>
                {pdfLoadState.loading ? "progress_activity" : "sync"}
              </span>
            </button>
          ) : wbSession.presentationName ? (
            <span className="hidden lg:inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/30">
              <span className="material-symbols-outlined text-xs">description</span>
              {wbSession.presentationName}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <SaveIndicator state={saveState} />

          {/* Pre-Flight Wizard Trigger */}
          <button
            type="button"
            onClick={() => setShowPreFlightWizard(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-300 bg-blue-950/40 hover:bg-blue-900/50 border border-blue-500/30 px-3 py-1.5 rounded-lg transition"
            title="Configure Teaching Material, Theme, and Video Devices"
          >
            <span className="material-symbols-outlined text-sm">tune</span>
            <span className="hidden sm:inline">Material &amp; Setup</span>
          </button>

          {/* Authoritative Live Status & Timers */}
          {isClassLive ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-red-400 border border-red-500/40 bg-red-950/40 px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                LIVE
              </span>

              {/* Elapsed Time */}
              <span
                className="text-xs font-mono font-semibold text-gray-300 bg-black/40 border border-gray-700/60 px-2.5 py-1 rounded-md"
                title={`Class runtime: ${formatDurationFriendly(elapsedSeconds)} since start`}
              >
                Elapsed: {formatHms(elapsedSeconds)} <span className="text-[10px] text-gray-400 font-normal">({formatDurationFriendly(elapsedSeconds)})</span>
              </span>

              {/* Remaining / Grace Period Timer */}
              {isInGracePeriod ? (
                <div className="relative flex items-center gap-1.5">
                  <span
                    className="flex items-center gap-1 text-xs font-mono font-bold text-rose-300 bg-rose-950/80 border border-rose-500/60 px-2.5 py-1 rounded-md animate-pulse"
                    title="Scheduled class duration completed. Grace period active before auto-close."
                  >
                    <span className="material-symbols-outlined text-xs text-rose-400">warning</span>
                    Grace Period: {formatHms(graceSecondsLeft)}
                  </span>
                  {/* Quick Add Time Button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setExtensionMenuOpen((o) => !o)}
                      className="flex items-center gap-1 text-xs font-bold text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 px-2.5 py-1 rounded-md transition shadow-md"
                    >
                      <span className="material-symbols-outlined text-xs">add</span> Add Time
                    </button>
                    {extensionMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 w-36 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1">
                        <span className="text-[10px] text-slate-400 px-2 py-0.5 uppercase tracking-wider font-bold">
                          Extend Class
                        </span>
                        {[5, 10, 15, 30, 60].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            disabled={extendingTime}
                            onClick={() => extendClass(mins)}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:bg-blue-600 hover:text-white transition disabled:opacity-50"
                          >
                            +{mins} Minutes
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : remainingSeconds > 0 ? (
                <div className="flex items-center gap-2">
                  <span
                    className={`flex items-center gap-1 text-xs font-mono font-semibold px-2.5 py-1 rounded-md border ${
                      remainingSeconds <= 300
                        ? "text-amber-300 bg-amber-950/60 border-amber-500/50 animate-pulse"
                        : "text-gray-300 bg-black/40 border-gray-700/60"
                    }`}
                    title={`Time left until scheduled end (${new Date(scheduledEndMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`}
                  >
                    <span className="material-symbols-outlined text-xs">timer</span>
                    {remainingSeconds <= 300 ? "5m Warning: " : "Time Left: "}
                    {formatHms(remainingSeconds)} <span className="text-[10px] text-gray-400 font-normal">({formatDurationFriendly(remainingSeconds)} left)</span>
                  </span>
                  {/* Add Time Menu Button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setExtensionMenuOpen((o) => !o)}
                      className="flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2 py-1 rounded-md transition"
                      title="Extend Class Duration"
                    >
                      <span className="material-symbols-outlined text-xs">more_time</span>
                      <span className="hidden sm:inline">+Time</span>
                    </button>
                    {extensionMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 w-36 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1">
                        <span className="text-[10px] text-slate-400 px-2 py-0.5 uppercase tracking-wider font-bold">
                          Add Time
                        </span>
                        {[5, 10, 15, 30, 60].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            disabled={extendingTime}
                            onClick={() => extendClass(mins)}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:bg-blue-600 hover:text-white transition disabled:opacity-50"
                          >
                            +{mins} Minutes
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-amber-400 border border-amber-500/40 bg-amber-950/40 px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                WAITING ROOM
              </span>
              {secondsUntilStart > 0 ? (
                <span className="text-xs font-mono font-medium text-amber-300 bg-amber-950/30 border border-amber-800/40 px-2.5 py-1 rounded-md">
                  Starts in: {formatHms(secondsUntilStart)}
                </span>
              ) : (
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 px-2.5 py-1 rounded-md">
                  Ready to Start
                </span>
              )}
            </div>
          )}

          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="material-symbols-outlined text-base">groups</span>
            {studentCount} {isClassLive ? "watching" : "waiting"}
          </span>

          {/* Authoritative Start Class Button */}
          {!isClassLive && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={startingClass || !canStartClass}
                onClick={startClass}
                className={`flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-lg shadow-md transition active:scale-95 ${
                  canStartClass
                    ? "text-white bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30 ring-2 ring-emerald-400/40 animate-pulse cursor-pointer"
                    : "text-gray-400 bg-gray-800 border border-gray-700 cursor-not-allowed opacity-60"
                }`}
                title={canStartClass ? "Start Live Teaching for all students" : "Class start unlocks 5 minutes before scheduled start time"}
              >
                <span className="material-symbols-outlined text-base">sensors</span>
                {startingClass ? "Starting Live…" : canStartClass ? "Start Class" : "Scheduled Time Locked"}
              </button>
              {startClassError && (
                <span className="text-xs text-red-400 max-w-xs truncate" title={startClassError}>
                  {startClassError}
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="text-xs font-semibold text-gray-300 border border-gray-600 px-3 py-1.5 rounded-md hover:bg-gray-700 transition"
          >
            SETTINGS
          </button>

          {isClassLive && (!confirmingEnd ? (
            <button
              type="button"
              onClick={() => setConfirmingEnd(true)}
              className="text-xs font-semibold text-red-400 border border-red-900/50 px-3.5 py-1.5 rounded-md hover:bg-red-950/40 transition"
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
          ))}
        </div>
      </header>

      {/* Main canvas area */}
      <main
        ref={mainCanvasContainerRef}
        className="live-canvas relative overflow-hidden bg-[#10131b] p-0.5 flex items-center justify-center min-w-0 min-h-0"
      >
        {(pdfLoadState.loading || pdfLoadState.error) && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 max-w-md w-[92%]">
            {pdfLoadState.loading ? (
              <div className="flex items-center gap-2 bg-[#1a1b23] border border-blue-500/40 text-blue-200 text-xs px-4 py-2 rounded-xl shadow-2xl">
                <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                <span className="truncate">{pdfLoadState.progress ?? "Loading presentation…"}</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 bg-red-950/90 border border-red-500/50 text-red-100 text-xs px-4 py-2.5 rounded-xl shadow-2xl">
                <span className="material-symbols-outlined text-sm shrink-0">error</span>
                <span className="flex-1">{pdfLoadState.error}</span>
                <button
                  type="button"
                  onClick={() => setPdfLoadState({ loading: false, progress: null, error: null })}
                  className="text-red-300 hover:text-white shrink-0"
                  title="Dismiss"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Left Floating Quick Tool Palette Capsule (Screenshot 1) */}
        <aside className="absolute left-2 sm:left-3.5 top-1/2 -translate-y-1/2 z-30 select-none pointer-events-auto">
          <div className="flex flex-col items-center py-2 px-1.5 bg-[#141624]/95 backdrop-blur-md rounded-full border border-[#292d42] shadow-2xl gap-2">
            {/* Active Tool Icon Indicator */}
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs text-orange-400">
              <span className="material-symbols-outlined text-sm">
                {tool === "pen"
                  ? (PEN_STYLES.find((s) => s.id === penStyle)?.icon || "edit")
                  : tool === "highlighter"
                  ? "border_color"
                  : tool === "stroke-eraser" || tool === "object-eraser"
                  ? "ink_eraser"
                  : tool === "text"
                  ? "text_fields"
                  : tool === "fill"
                  ? "format_color_fill"
                  : tool === "select"
                  ? "gesture"
                  : "category"}
              </span>
            </div>

            <div className="w-4 h-[1px] bg-gray-700/60" />

            {/* Color Swatches (Screenshot 1 & 4) */}
            <div className="flex flex-col gap-1.5">
              {LEFT_BAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-4 h-4 rounded-full transition transform hover:scale-125 ${
                    color.toLowerCase() === c.toLowerCase()
                      ? "ring-2 ring-white ring-offset-1 ring-offset-[#141624]"
                      : "opacity-85 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>

            <div className="w-4 h-[1px] bg-gray-700/60" />

            {/* 3 Size Dots (Screenshot 1 & 4) */}
            <div className="flex flex-col gap-2 items-center py-1">
              {[2, 5, 9].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setSize(sz)}
                  className={`rounded-full transition flex items-center justify-center ${
                    size === sz ? "ring-2 ring-blue-400 ring-offset-1 ring-offset-[#141624]" : ""
                  }`}
                  style={{
                    width: `${Math.max(6, sz * 1.5)}px`,
                    height: `${Math.max(6, sz * 1.5)}px`,
                    backgroundColor: color,
                  }}
                  title={`${sz}px stroke size`}
                />
              ))}
            </div>

            <div className="w-4 h-[1px] bg-gray-700/60" />

            {/* Paint Bucket (Color Fill) Tool Button */}
            <button
              type="button"
              onClick={() => setTool("fill")}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition shadow ${
                tool === "fill"
                  ? "bg-amber-500 text-white ring-2 ring-amber-300"
                  : "bg-white/10 text-gray-300 hover:text-white"
              }`}
              title="Paint Bucket (Color Fill Tool)"
            >
              <span className="material-symbols-outlined text-sm">format_color_fill</span>
            </button>

            {/* Freehand Lasso Selection Tool Button */}
            <button
              type="button"
              onClick={() => setTool("select")}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition shadow ${
                tool === "select"
                  ? "bg-blue-600 text-white ring-2 ring-blue-400"
                  : "bg-white/10 text-gray-300 hover:text-white"
              }`}
              title="Selection / Lasso Tool"
            >
              <span className="material-symbols-outlined text-sm">gesture</span>
            </button>
          </div>
        </aside>

        <div
          className="relative rounded-2xl shadow-2xl overflow-hidden border border-slate-800/80 shrink-0 transition-transform duration-75 select-none"
          style={{
            width: `${stageDimensions.width}px`,
            height: `${stageDimensions.height}px`,
            transform: zoom === 1 ? undefined : `scale(${zoom})`,
            transformOrigin: "center center",
            ...(isBackgroundImageUrl(currentPage?.background) ? undefined : slideBackgroundStyle(currentPage?.background)),
          }}
        >
          {/* Atomic Pathshala Brand Header (Screenshot 1) */}
          {!isBackgroundImageUrl(currentPage?.background) && (
            <div className="absolute top-2 left-3 right-3 z-10 flex items-center justify-between pointer-events-none select-none opacity-95">
              {/* Atomic Logo Icon */}
              <div className="w-9 h-9 bg-white rounded-xl shadow-md border border-slate-200/80 flex items-center justify-center p-1">
                <span className="text-orange-500 font-extrabold text-base tracking-tighter">A</span>
              </div>

              {/* Horizontal Accent Line */}
              <div className="flex-1 mx-4 h-[3px] bg-gradient-to-r from-orange-500 via-slate-900 to-black rounded-full" />

              {/* Atomic Pathshala Logo */}
              <div className="flex flex-col items-end pr-1">
                <span className="text-xs font-black tracking-widest text-slate-900 leading-none">
                  ATOMIC
                </span>
                <span className="text-[8px] font-bold tracking-wider text-orange-600 leading-tight">
                  — PATHSHALA —
                </span>
                <span className="text-[6px] font-semibold tracking-tighter text-slate-500">
                  LEARN • EXPLORE • EXCEL
                </span>
              </div>
            </div>
          )}

          {isBackgroundImageUrl(currentPage?.background) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentPage!.background}
              alt=""
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />
          )}
          {currentPage?.background === "coordinate" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-full h-[2px] bg-blue-500/70" />
              <div className="absolute h-full w-[2px] bg-blue-500/70" />
            </div>
          )}
          {/* Continuous Full-Size Canvas — covers 100% of visible card */}
          <div className="absolute inset-0 w-full h-full">
            <canvas ref={baseCanvasRef} className="absolute inset-0 w-full h-full select-none pointer-events-none" />
            <canvas
              ref={activeCanvasRef}
              className="absolute inset-0 w-full h-full touch-none select-none"
              style={{
                cursor:
                  tool === "select"
                    ? "default"
                    : tool === "text"
                    ? "text"
                    : tool === "fill"
                    ? "cell"
                    : tool === "stroke-eraser" || tool === "object-eraser"
                    ? "crosshair"
                    : "crosshair",
              }}
              onDoubleClick={handleCanvasDoubleClick}
            />
            {textEditor && (
              <div
                className="absolute z-30"
                style={{
                  left: `${(textEditor.x / VIRTUAL_WIDTH) * 100}%`,
                  top: `${(textEditor.y / VIRTUAL_HEIGHT) * 100}%`,
                }}
              >
                <textarea
                  autoFocus
                  value={textEditor.text}
                  onChange={(e) =>
                    setTextEditor((prev) => (prev ? { ...prev, text: e.target.value } : prev))
                  }
                  onBlur={commitTextEditor}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      cancelTextEditor();
                    } else if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      commitTextEditor();
                    }
                  }}
                  placeholder="Type text…"
                  rows={1}
                  className="min-w-[120px] min-h-[1.6em] bg-white/95 border-2 border-blue-500 rounded px-1.5 py-1 outline-none resize shadow-lg"
                  style={{
                    color: textEditor.color,
                    // Approximation only, purely for what the box looks
                    // like while typing — the textarea has no way to know
                    // the canvas's actual rendered pixel width here. The
                    // committed object's on-canvas size is exact regardless
                    // of this, since CanvasEngine.measureText() derives it
                    // straight from fontSizePx in virtual coordinates.
                    fontSize: `${textEditor.fontSizePx * zoom * 0.5}px`,
                    fontFamily: '"Segoe UI", Arial, sans-serif',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Panel toggle + scrim, below lg only. The panel itself is never
          conditionally rendered: VideoStrip holds the room's single LiveKit
          connection, and remounting it opens a second one under the same
          identity, which puts the two into a reconnect loop. */}
      <button
        type="button"
        onClick={() => setPanelOpen((o) => !o)}
        className="lg:hidden fixed right-0 top-1/2 -translate-y-1/2 z-drawer w-9 h-16 rounded-l-xl bg-[#1a1b23] border border-r-0 border-[#2d2e3b] text-gray-300 hover:text-white flex items-center justify-center shadow-lg"
        aria-label={panelOpen ? "Hide video and chat" : "Show video and chat"}
        aria-expanded={panelOpen}
      >
        <span className="material-symbols-outlined text-xl">
          {panelOpen ? "chevron_right" : "chevron_left"}
        </span>
      </button>
      {panelOpen && (
        <div
          className="lg:hidden fixed inset-0 z-sticky bg-black/40"
          onClick={() => setPanelOpen(false)}
        />
      )}

      {/* Right panel: video + Messages/Questions */}
      <aside
        data-open={panelOpen ? "true" : "false"}
        className="live-panel bg-[#1a1b23] border-l border-[#2d2e3b] flex flex-col min-h-0"
      >
        <div className="h-56 bg-black relative border-b border-[#2d2e3b] shrink-0">
          <VideoStrip whiteboardSessionId={wbSession.id} variant="panel" settingsPortalRef={settingsPortalRef} />
        </div>

        <div className="flex border-b border-[#2d2e3b] px-3 pt-3 shrink-0 gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setRightTab("messages");
              setUnreadMessages(0);
            }}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors relative whitespace-nowrap ${
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
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors relative whitespace-nowrap ${
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
          <button
            type="button"
            onClick={() => setRightTab("roster")}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors relative whitespace-nowrap flex items-center gap-1.5 ${
              rightTab === "roster" ? "border-white text-white" : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            Students
            <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {studentCount}
            </span>
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
          ) : rightTab === "questions" ? (
            <HandRaisePanel
              queue={handRaiseQueue}
              onResolve={resolveHandRaise}
              onAction={handleHandRaiseAction}
              enabled={wbSession.handRaiseEnabled}
            />
          ) : (
            <ParticipantsPanel
              whiteboardSessionId={wbSession.id}
              theme="dark"
            />
          )}
        </div>
      </aside>

      {/* Bottom toolbar */}
      <footer className="live-toolbar flex items-center justify-between gap-1 px-2 sm:px-4 lg:px-6 border-t border-[#2d2e3b] bg-[#1a1b23] relative min-w-0">
        {openPopup && <div className="fixed inset-0 z-30" onClick={() => setOpenPopup(null)} />}

        {/* Tools group. relative + z-40: see the backdrop-stacking comment
            above the backdrop div — without this, every button here (and
            in the Navigation/Action groups below) needed two clicks
            whenever a popup was already open. */}
        {/* No `overflow-x-auto` here: it makes `overflow-y` compute to auto
            too, which clipped every tool's `bottom-full` popover (pen /
            highlighter / eraser / shapes / fill). The row is a fixed set of
            small buttons that fits any desktop width. */}
        <div className="relative z-40 flex items-center gap-1 min-w-0 flex-wrap sm:flex-nowrap">
          {/* Pen tool with Screenshot 3 customizer */}
          <div className="relative">
            <ToolbarBtn
              icon={PEN_STYLES.find((s) => s.id === penStyle)?.icon || "edit"}
              label="Pen"
              active={tool === "pen"}
              onClick={() => {
                setTool("pen");
                setOpenPopup((p) => (p === "pen" ? null : "pen"));
              }}
            />
            {openPopup === "pen" && (
              <div className="absolute bottom-full left-0 mb-3 z-50 bg-[#161722] border border-[#2d2e3b] rounded-2xl p-4 shadow-2xl w-[32rem] flex flex-col gap-4 text-white">
                {/* Header (Screenshot 3) */}
                <div className="flex items-center justify-between border-b border-[#2d2e3b] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-400 text-xl">
                      {PEN_STYLES.find((s) => s.id === penStyle)?.icon || "edit"}
                    </span>
                    <h3 className="text-sm font-bold text-gray-100">
                      {PEN_STYLES.find((s) => s.id === penStyle)?.label || "Hard-tipped"} pen
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenPopup(null)}
                    className="text-gray-400 hover:text-white transition"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>

                {/* Thickness Slider with Live Dot (Screenshot 3) */}
                <div className="bg-[#10111a] border border-[#242634] rounded-xl p-3 flex items-center justify-between gap-4">
                  <span className="text-xs text-gray-300 font-medium">Thickness</span>
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={size}
                    onChange={(e) => setSize(Number(e.target.value))}
                    className="flex-1 accent-blue-500 h-1.5 bg-gray-700 rounded-lg cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold text-gray-200 w-8 text-right">{size}px</span>
                  <div className="w-9 h-9 rounded-full bg-[#1b1c28] border border-[#2d2e3b] flex items-center justify-center shrink-0">
                    <div
                      className="rounded-full transition-all"
                      style={{
                        width: Math.max(3, Math.min(22, size)),
                        height: Math.max(3, Math.min(22, size)),
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>

                {/* Split: Pen Styles (Left) & Color Palette 3x4 Grid (Right) (Screenshot 3) */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Left: Pen Styles */}
                  <div className="bg-[#10111a] border border-[#242634] rounded-xl p-3 flex flex-col gap-2">
                    <span className="text-xs font-semibold text-gray-400 mb-1">Pen Styles</span>
                    <div className="grid grid-cols-2 gap-2">
                      {PEN_STYLES.map((ps) => (
                        <button
                          key={ps.id}
                          type="button"
                          onClick={() => setPenStyle(ps.id)}
                          className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs transition gap-1.5 ${
                            penStyle === ps.id
                              ? "bg-blue-600/20 border-blue-500 text-white font-semibold"
                              : "bg-[#161722] border-[#2d2e3b] text-gray-400 hover:text-gray-200 hover:border-gray-600"
                          }`}
                        >
                          <span className="material-symbols-outlined text-lg">{ps.icon}</span>
                          <span>{ps.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right: 3x4 Color Grid (Screenshot 3) */}
                  <div className="bg-[#10111a] border border-[#242634] rounded-xl p-3 flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-semibold text-gray-400 block mb-2 text-center">Color</span>
                      <div className="grid grid-cols-3 gap-2 place-items-center">
                        {PEN_PALETTE_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setColor(c)}
                            className={`w-8 h-8 rounded-xl border shadow-md transition transform hover:scale-110 ${
                              color.toLowerCase() === c.toLowerCase()
                                ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-[#10111a] border-white"
                                : "border-transparent"
                            }`}
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>

                    <label className="mt-3 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-[#2d2e3b] bg-[#161722] hover:bg-[#202130] text-xs text-gray-300 font-medium cursor-pointer transition">
                      <span className="material-symbols-outlined text-sm text-blue-400">colorize</span>
                      Custom
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="opacity-0 w-0 h-0 absolute"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Highlight tool with floating pill (Screenshot 4) */}
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
              <div className="absolute bottom-full left-0 mb-3 z-40 bg-[#161722] border border-[#2d2e3b] rounded-2xl p-2.5 shadow-2xl flex flex-row items-center gap-2.5 min-w-max">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setColor(c);
                    }}
                    className={`w-7 h-7 rounded-full border shadow-md transition transform hover:scale-110 ${
                      color.toLowerCase() === c.toLowerCase()
                        ? "ring-2 ring-white ring-offset-2 ring-offset-[#161722] border-transparent"
                        : "border-gray-600/60 opacity-85 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: c }}
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
              <div className="absolute bottom-full left-0 mb-2 z-40 bg-[#1a1b23] border border-[#2d2e3b] rounded-2xl p-1.5 shadow-2xl w-52 flex flex-col gap-1 text-white">
                <button
                  type="button"
                  onClick={() => {
                    setTool("stroke-eraser");
                    setOpenPopup(null);
                  }}
                  className={`flex items-center gap-3 p-2 rounded-xl text-xs font-semibold text-left transition ${
                    tool === "stroke-eraser" ? "bg-blue-600/20 text-blue-400 font-bold border border-blue-500/40" : "text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  <span className="material-symbols-outlined text-base text-blue-400">ink_eraser</span> Stroke Eraser
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTool("object-eraser");
                    setOpenPopup(null);
                  }}
                  className={`flex items-center gap-3 p-2 rounded-xl text-xs font-semibold text-left transition ${
                    tool === "object-eraser" ? "bg-blue-600/20 text-blue-400 font-bold border border-blue-500/40" : "text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  <span className="material-symbols-outlined text-base text-blue-400">delete_sweep</span> Object Eraser
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTool("object-eraser");
                    setOpenPopup(null);
                  }}
                  className={`flex items-center gap-3 p-2 rounded-xl text-xs font-semibold text-left transition ${
                    tool === "object-eraser" ? "bg-blue-600/20 text-blue-400 font-bold border border-blue-500/40" : "text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  <span className="material-symbols-outlined text-base text-blue-400">gesture</span> Lasso / Loop Eraser
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTool("stroke-eraser");
                    setOpenPopup(null);
                  }}
                  className={`flex items-center gap-3 p-2 rounded-xl text-xs font-semibold text-left transition ${
                    tool === "stroke-eraser" ? "bg-blue-600/20 text-blue-400 font-bold border border-blue-500/40" : "text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  <span className="material-symbols-outlined text-base text-blue-400">crop_free</span> Area / Box Eraser
                </button>
              </div>
            )}
          </div>

          {/* Subject-Wise Smart Shapes (Screenshot 5) */}
          <div className="relative">
            <ToolbarBtn
              icon="category"
              label="Shapes"
              active={openPopup === "shapes"}
              onClick={() => setOpenPopup((p) => (p === "shapes" ? null : "shapes"))}
            />
            {openPopup === "shapes" && (
              <div className="absolute bottom-full left-0 mb-3 z-50 bg-[#161722] border border-[#2d2e3b] rounded-2xl p-3 shadow-2xl w-72 flex flex-col gap-3 text-white">
                {/* Category Switcher Tabs: Math, Phys, Chem, Bio (Screenshot 5) */}
                <div className="grid grid-cols-4 gap-1 bg-[#10111a] p-1 rounded-xl border border-[#242634]">
                  <button
                    type="button"
                    onClick={() => setShapeSubjectTab("math")}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold transition ${
                      shapeSubjectTab === "math"
                        ? "bg-blue-600 text-white shadow-md"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xs">square_foot</span>
                    Math
                  </button>
                  <button
                    type="button"
                    onClick={() => setShapeSubjectTab("phys")}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold transition ${
                      shapeSubjectTab === "phys"
                        ? "bg-blue-600 text-white shadow-md"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xs">bolt</span>
                    Phys
                  </button>
                  <button
                    type="button"
                    onClick={() => setShapeSubjectTab("chem")}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold transition ${
                      shapeSubjectTab === "chem"
                        ? "bg-blue-600 text-white shadow-md"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xs">science</span>
                    Chem
                  </button>
                  <button
                    type="button"
                    onClick={() => setShapeSubjectTab("bio")}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold transition ${
                      shapeSubjectTab === "bio"
                        ? "bg-blue-600 text-white shadow-md"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xs">grain</span>
                    Bio
                  </button>
                </div>

                {/* 2-Column Grid of Shapes (Screenshot 5) */}
                <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
                  {(SUBJECT_SHAPES[shapeSubjectTab] || SUBJECT_SHAPES.math).map((s, idx) => (
                    <button
                      key={`${s.label}-${idx}`}
                      type="button"
                      onClick={() => {
                        setTool(s.id);
                        setOpenPopup(null);
                      }}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-xs text-left transition ${
                        tool === s.id
                          ? "bg-blue-600/20 border-blue-500 text-white font-bold"
                          : "bg-[#10111a] border-[#242634] text-gray-300 hover:border-gray-500"
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm text-blue-400 shrink-0">{s.icon}</span>
                      <span className="truncate">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-[#2d2e3b] mx-2" />

          <button
            type="button"
            onClick={() => setTool("fill")}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
              tool === "fill" ? "text-amber-400 bg-amber-900/30 ring-1 ring-amber-500/50" : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
            title="Paint Bucket (Color Fill Tool)"
          >
            <span className="material-symbols-outlined text-lg">format_color_fill</span>
          </button>
          <button
            type="button"
            onClick={() => setTool("text")}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
              tool === "text" ? "text-blue-400 bg-blue-900/30" : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
            title="Text"
          >
            <span className="material-symbols-outlined text-lg">text_fields</span>
          </button>
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
        <div className="relative z-40 flex items-center gap-1">
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
          <ToolbarBtn icon="download" label="Export" onClick={exportBoardAsImage} title="Export current slide as PNG" />
          <ToolbarBtn
            icon="delete"
            label="Delete"
            onClick={deleteCurrentPage}
            disabled={wbSession.pages.length <= 1}
            className="hover:text-red-400"
          />
        </div>

        {/* Action group */}
        <div className="relative z-40 flex items-center gap-1">
          {/* Poll Button with Screenshot 3 Popover Menu */}
          <div className="relative">
            <ToolbarBtn
              icon="equalizer"
              label="Poll"
              active={pollActive || openPopup === "pollMenu"}
              onClick={() => setOpenPopup((p) => (p === "pollMenu" ? null : "pollMenu"))}
            />
            {openPopup === "pollMenu" && (
              <div className="absolute bottom-full right-0 mb-3 z-50 w-64 bg-[#161722] border border-[#2d2e3b] rounded-2xl p-2 shadow-2xl flex flex-col gap-1 text-white">
                <button
                  type="button"
                  onClick={() => {
                    setOpenPopup(null);
                    setPollModalTab("quiz");
                    setPollOpen(true);
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#202232] text-left transition group"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-lg">quiz</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-100 group-hover:text-blue-400 transition">Live Quiz / Poll</h4>
                    <p className="text-[10px] text-gray-400">Launch YES/NO or 4-MCQ</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOpenPopup(null);
                    setPollModalTab("ranks");
                    setPollOpen(true);
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#202232] text-left transition group"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-lg">military_tech</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-100 group-hover:text-amber-400 transition">Session Leaderboard</h4>
                    <p className="text-[10px] text-gray-400">Full class ranks &amp; speed</p>
                  </div>
                </button>
              </div>
            )}
          </div>

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
              <div className="absolute bottom-full right-0 mb-2 z-40 w-64 bg-[#1a1b23] border border-[#2d2e3b] rounded-2xl p-3 grid grid-cols-2 gap-2 shadow-2xl origin-bottom-right">
                <MoreGridBtn
                  icon="view_in_ar"
                  label="3D Models"
                  onClick={() => {
                    setOpenPopup(null);
                    setSim3dOpen(true);
                  }}
                />
                <MoreGridBtn
                  icon="science"
                  label="Science Labs"
                  onClick={() => {
                    setOpenPopup(null);
                    setScienceLabsOpen(true);
                  }}
                />
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
                  icon={pdfLoadState.loading ? "hourglass_empty" : "picture_as_pdf"}
                  label={pdfLoadState.loading ? "Loading…" : "Load Presentation"}
                  disabled={pdfLoadState.loading || !wbSession.presentationUrl}
                  onClick={() => {
                    setOpenPopup(null);
                    handleLoadPresentationPdf();
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

      {sim3dOpen && (
        <Simulation3DModal
          onClose={() => setSim3dOpen(false)}
          onInsertToSlide={handleInsertSimulationImage}
        />
      )}

      {scienceLabsOpen && (
        <ScienceLabsModal
          onClose={() => setScienceLabsOpen(false)}
          onStampToWhiteboard={handleInsertSimulationImage}
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
          pollModalTab={pollModalTab}
          setPollModalTab={setPollModalTab}
          pollType={pollType}
          setPollType={setPollType}
        />
      )}

      {/* Pre-Flight Setup Wizard Modal */}
      {showPreFlightWizard && (
        <PreFlightSetupWizard
          scheduleId={batchScheduleId}
          classTitle={scheduleTitle}
          initialConfig={{
            presentationUrl: wbSession.presentationUrl || "",
            presentationName: wbSession.presentationName || "",
            presentationType: (wbSession.presentationType as any) || "PDF",
            classroomTheme: (wbSession.classroomTheme as any) || "LIGHT",
            cameraShape: (wbSession.cameraShape as any) || "SQUARE",
            cameraPosition: "UPPER_RIGHT",
          }}
          onComplete={(config: PreFlightConfig) => {
            const updated = wbSession
              ? {
                  ...wbSession,
                  presentationUrl: config.presentationUrl,
                  presentationName: config.presentationName,
                  presentationType: config.presentationType,
                  classroomTheme: config.classroomTheme,
                  cameraShape: config.cameraShape,
                }
              : null;
            if (updated) {
              setWbSession(updated);
            }
            setShowPreFlightWizard(false);
            if (config.presentationUrl && updated) {
              handleLoadPresentationPdf(updated);
            }
          }}
          onCancel={() => setShowPreFlightWizard(false)}
        />
      )}

      {/* Post-Class Slide Downloads & Technical Feedback Modal */}
      {showPostClassModal && wbSession && (
        <TeacherPostClassModal
          sessionId={wbSession.id}
          batchScheduleId={batchScheduleId}
          sessionTitle={scheduleTitle}
          onClose={() => setShowPostClassModal(false)}
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
  if (state !== "offline") return null;
  return (
    <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2.5 py-1 rounded-md">
      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
      Offline — reconnecting…
    </span>
  );
}

function HandRaisePanel({
  queue,
  onResolve,
  onAction,
  enabled,
}: {
  queue: HandRaiseQueueItem[];
  onResolve: (id: string) => void;
  onAction?: (id: string, action: "approve" | "reject" | "clear") => void;
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
        <div className="flex flex-col items-center justify-center h-48 text-center p-4">
          <span className="material-symbols-outlined text-3xl text-gray-600 mb-2">front_hand</span>
          <p className="text-sm text-gray-400 font-medium">No raised hands</p>
          <p className="text-xs text-gray-600 mt-1">Student requests to speak will appear here in real-time.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {queue.map((h, i) => {
            const isApproved = h.status === "APPROVED";
            const reqIcon =
              h.requestType === "VIDEO" ? "videocam" : h.requestType === "AUDIO" ? "mic" : "chat";
            const reqLabel =
              h.requestType === "VIDEO" ? "Video + Mic" : h.requestType === "AUDIO" ? "Mic Only" : "Chat Doubt";

            return (
              <li
                key={h.id}
                className={`flex flex-col bg-[#10131b] border rounded-xl p-3 gap-2 transition ${
                  isApproved ? "border-emerald-500/50 bg-emerald-950/10" : "border-[#2d2e3b]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-blue-400 bg-blue-950/60 border border-blue-800/40 px-1.5 py-0.5 rounded">
                      #{i + 1}
                    </span>
                    <span className="text-sm font-semibold text-gray-100 truncate">{h.studentName}</span>
                  </div>

                  <span
                    className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      h.requestType === "VIDEO"
                        ? "bg-blue-950/60 border-blue-700/50 text-blue-300"
                        : h.requestType === "AUDIO"
                        ? "bg-blue-950/60 border-blue-700/50 text-blue-300"
                        : "bg-slate-800 border-slate-700 text-slate-300"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xs">{reqIcon}</span>
                    {reqLabel}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[#1e202e]">
                  <span className="text-[10px] text-gray-500">
                    {isApproved ? (
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        Speaking Permission Active
                      </span>
                    ) : (
                      "Waiting for approval"
                    )}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {!isApproved && onAction && (
                      <button
                        type="button"
                        onClick={() => onAction(h.id, "approve")}
                        className="flex items-center gap-1 text-xs font-bold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700/60 px-2.5 py-1 rounded-lg transition active:scale-95"
                        title="Allow student to speak"
                      >
                        <span className="material-symbols-outlined text-xs">check</span>
                        Approve
                      </button>
                    )}

                    {!isApproved && onAction && (
                      <button
                        type="button"
                        onClick={() => onAction(h.id, "reject")}
                        className="flex items-center gap-1 text-xs font-medium text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 px-2 py-1 rounded-lg transition"
                        title="Decline request"
                      >
                        <span className="material-symbols-outlined text-xs">close</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => (onAction ? onAction(h.id, "clear") : onResolve(h.id))}
                      className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition"
                      title={isApproved ? "Revoke speaking permission" : "Dismiss"}
                    >
                      {isApproved ? "End Turn" : "Clear"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
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
    { id: "chatpoll", label: "Chat & Poll controls" },
    { id: "audio", label: "Audio & Video" },
    { id: "shortcuts", label: "Shortcuts" },
    { id: "broadcast", label: "YouTube Live Broadcast" },
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

const OFFICIAL_THEMES: {
  id: SlideTheme;
  label: string;
  preview: React.CSSProperties;
  isOfficial?: boolean;
}[] = [
  {
    id: "atomic_white",
    label: "Atomic Pathshala (White)",
    preview: {
      backgroundColor: "#ffffff",
      backgroundImage: "linear-gradient(to bottom, #fff7ed 0px, #fff7ed 12px, #ea580c 12px, #ea580c 14px, transparent 14px)",
    },
    isOfficial: true,
  },
  {
    id: "atomic_dark",
    label: "Atomic Pathshala (Dark)",
    preview: {
      backgroundColor: "#0d0f17",
      backgroundImage: "linear-gradient(to bottom, #1e293b 0px, #1e293b 12px, #ea580c 12px, #ea580c 14px, transparent 14px)",
    },
    isOfficial: true,
  },
  {
    id: "atomic_ruled",
    label: "Atomic Pathshala (Ruled)",
    preview: {
      backgroundColor: "#ffffff",
      backgroundImage:
        "linear-gradient(to bottom, #fff7ed 0px, #fff7ed 12px, #ea580c 12px, #ea580c 14px, transparent 14px), repeating-linear-gradient(to bottom, transparent, transparent 10px, #e2e8f0 10px, #e2e8f0 11px)",
    },
    isOfficial: true,
  },
];

const STANDARD_THEMES: {
  id: SlideTheme;
  label: string;
  preview: React.CSSProperties;
  overlay?: boolean;
}[] = [
  {
    id: "grid",
    label: "Math Grid",
    preview: {
      backgroundColor: "#ffffff",
      backgroundImage:
        "linear-gradient(#9ca3af 1px, transparent 1px), linear-gradient(90deg, #9ca3af 1px, transparent 1px)",
      backgroundSize: "12px 12px",
    },
  },
  { id: "dark", label: "Deep Slate Dark", preview: { backgroundColor: "#1a1b23" } },
  { id: "light", label: "Pure White", preview: { backgroundColor: "#ffffff" } },
  {
    id: "coordinate",
    label: "Coordinate Plane (XY)",
    preview: {
      backgroundColor: "#ffffff",
      backgroundImage:
        "linear-gradient(#d1d5db 1px, transparent 1px), linear-gradient(90deg, #d1d5db 1px, transparent 1px)",
      backgroundSize: "12px 12px",
      backgroundPosition: "center center",
    },
    overlay: true,
  },
  {
    id: "ruled",
    label: "Notebook Ruled",
    preview: {
      backgroundColor: "#ffffff",
      backgroundImage: "repeating-linear-gradient(to bottom, transparent, transparent 10px, #e2e8f0 10px, #e2e8f0 11px)",
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
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
      <div className="bg-[#12131c] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#2d2e3b] max-h-[90vh] text-white">
        {/* Header (Screenshot 4) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#252836] bg-[#171924]">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-amber-500 text-xl">palette</span>
            <div>
              <h2 className="text-sm font-bold text-gray-100">Choose Slide Theme</h2>
              <p className="text-[11px] text-gray-400">
                Select Atomic Pathshala official branded background or standard template
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#252836] transition"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Section 1: Official Atomic Pathshala Templates (Screenshot 4) */}
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">school</span>
              OFFICIAL ATOMIC PATHSHALA TEMPLATES
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {OFFICIAL_THEMES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect(p.id);
                    onClose();
                  }}
                  className={`flex flex-col text-left rounded-2xl border p-2.5 transition gap-2 group ${
                    current === p.id
                      ? "border-orange-500 ring-2 ring-orange-500/30 bg-orange-950/10"
                      : "border-[#252836] hover:border-orange-500/60 bg-[#161724]"
                  }`}
                >
                  <div
                    className="w-full aspect-video rounded-xl shadow-inner relative overflow-hidden border border-black/20"
                    style={p.preview}
                  >
                    <div className="absolute top-1 left-1.5 flex items-center gap-1">
                      <span className="text-[8px] font-black text-orange-600 bg-orange-100 px-1 rounded">A</span>
                    </div>
                    <div className="absolute top-1 right-1.5 text-[7px] font-black text-slate-700">
                      ATOMIC
                    </div>
                  </div>
                  <span className="text-xs font-bold text-gray-200 group-hover:text-orange-400 transition">
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Standard Classroom Themes (Screenshot 4) */}
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">grid_view</span>
              STANDARD CLASSROOM THEMES
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {STANDARD_THEMES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect(p.id);
                    onClose();
                  }}
                  className={`flex flex-col text-left rounded-2xl border p-2.5 transition gap-2 group ${
                    current === p.id
                      ? "border-blue-500 ring-2 ring-blue-500/30 bg-blue-950/10"
                      : "border-[#252836] hover:border-blue-500/60 bg-[#161724]"
                  }`}
                >
                  <div
                    className="w-full aspect-video rounded-xl shadow-inner relative overflow-hidden border border-black/20"
                    style={p.preview}
                  >
                    {p.overlay && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-full h-[1.5px] bg-blue-500/60" />
                        <div className="absolute h-full w-[1.5px] bg-blue-500/60" />
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-gray-200 group-hover:text-blue-400 transition truncate">
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
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
  pollModalTab,
  setPollModalTab,
  pollType,
  setPollType,
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
  pollModalTab: "quiz" | "ranks";
  setPollModalTab: (t: "quiz" | "ranks") => void;
  pollType: "mcq4" | "yesno";
  setPollType: (t: "mcq4" | "yesno") => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#12131c] w-full max-w-sm rounded-2xl shadow-2xl border border-[#2d2e3b] flex flex-col max-h-[90vh] text-white overflow-hidden">
        {/* Header (Screenshot 1) */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#252836] bg-[#171924]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-500 text-lg">equalizer</span>
            <h2 className="text-sm font-bold text-gray-100">Poll / Quiz</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-[#252836] transition"
              title="Dock / Undock"
            >
              <span className="material-symbols-outlined text-base">splitscreen</span>
            </button>
            <button
              type="button"
              onClick={() => setPollModalTab("ranks")}
              className="text-[11px] px-2 py-0.5 rounded bg-[#252836] hover:bg-[#323648] text-gray-200 font-semibold border border-[#323648] transition"
            >
              Ranks
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#252836] transition"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>

        {/* Top Switcher Tabs: Live Quiz vs Leaderboard */}
        <div className="p-3 pb-0">
          <div className="grid grid-cols-2 gap-1 bg-[#10111a] p-1 rounded-xl border border-[#242634]">
            <button
              type="button"
              onClick={() => setPollModalTab("quiz")}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
                pollModalTab === "quiz"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <span className="material-symbols-outlined text-base">quiz</span>
              Live Quiz
            </button>
            <button
              type="button"
              onClick={() => setPollModalTab("ranks")}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
                pollModalTab === "ranks"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <span className="material-symbols-outlined text-base">military_tech</span>
              Leaderboard
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {pollModalTab === "quiz" ? (
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
              pollType={pollType}
              setPollType={setPollType}
            />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#242634]">
                <h3 className="text-xs font-bold text-gray-200">Class Session Ranks</h3>
                <span className="text-[10px] text-gray-400 font-medium">Real-time Leaderboard</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#171924] border border-[#2d2e3b]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center">1</span>
                    <span className="text-xs font-semibold text-gray-200">Aarav Sharma</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">100% · 2.1s</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#171924] border border-[#2d2e3b]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-gray-500/20 text-gray-300 text-xs font-bold flex items-center justify-center">2</span>
                    <span className="text-xs font-semibold text-gray-200">Priya Patel</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">100% · 3.4s</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#171924] border border-[#2d2e3b]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-amber-700/20 text-amber-600 text-xs font-bold flex items-center justify-center">3</span>
                    <span className="text-xs font-semibold text-gray-200">Rohan Verma</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">100% · 4.8s</span>
                </div>
              </div>
            </div>
          )}
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
  pollType,
  setPollType,
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
  pollType: "mcq4" | "yesno";
  setPollType: (t: "mcq4" | "yesno") => void;
}) {
  if (activeQuiz && activeQuiz.status !== "CLOSED") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-200">
            {activeQuiz.questionText || "Live Quick Quiz (Board-Driven)"}
          </p>
          <span className="text-[10px] font-mono font-bold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800">
            {activeQuiz.status}
          </span>
        </div>

        <ul className="space-y-2">
          {activeQuiz.options.map((o) => {
            const count = quizMetrics?.counts[o.key] ?? 0;
            const total = quizMetrics?.totalResponses ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const isCorrect = activeQuiz.status === "REVEALED" && activeQuiz.correctOption === o.key;
            return (
              <li key={o.key} className="relative overflow-hidden rounded-xl border border-[#2d2e3b] bg-[#10111a]">
                <div
                  className={`absolute inset-y-0 left-0 transition-all duration-300 ${
                    isCorrect ? "bg-emerald-500/25" : "bg-blue-500/15"
                  }`}
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex items-center justify-between px-3.5 py-2.5 text-xs">
                  <span className={`font-semibold ${isCorrect ? "text-emerald-400" : "text-gray-200"}`}>
                    <span className="inline-block w-5 h-5 rounded-md bg-white/10 text-center leading-5 mr-2 font-mono">
                      {o.key}
                    </span>
                    {o.label}
                  </span>
                  <span className="font-mono text-gray-400">
                    {count} {total > 0 ? `(${pct}%)` : ""}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="text-[11px] text-gray-400 text-center">
          {quizMetrics?.totalResponses ?? 0} response{(quizMetrics?.totalResponses ?? 0) === 1 ? "" : "s"} collected
        </p>

        {activeQuiz.status === "ACTIVE" ? (
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onReveal}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/30"
            >
              Reveal Answer
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 bg-[#202230] hover:bg-[#2c2f42] text-gray-300 hover:text-white rounded-xl text-xs font-semibold transition"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="text-center pt-1">
            <p className="text-xs text-emerald-400 font-bold mb-2">Answer revealed to class.</p>
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-[#202230] hover:bg-[#2c2f42] text-gray-200 py-2 rounded-xl text-xs font-semibold transition"
            >
              Finish &amp; Dismiss
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-rose-400 font-semibold bg-rose-950/40 p-2.5 rounded-xl border border-rose-900/50">{error}</p>}

      {/* Sub-selector: YES / NO vs 4-Option Quiz (Screenshot 1) */}
      <div className="grid grid-cols-2 gap-1 bg-[#10111a] p-1 rounded-xl border border-[#242634]">
        <button
          type="button"
          onClick={() => {
            setPollType("yesno");
            setForm((f) => ({
              ...f,
              options: ["YES", "NO"],
              correctOption: "A",
            }));
          }}
          className={`py-1.5 rounded-lg text-xs font-bold transition ${
            pollType === "yesno"
              ? "bg-blue-600 text-white shadow-md"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          YES / NO
        </button>
        <button
          type="button"
          onClick={() => {
            setPollType("mcq4");
            setForm((f) => ({
              ...f,
              options: ["Option A", "Option B", "Option C", "Option D"],
              correctOption: "A",
            }));
          }}
          className={`py-1.5 rounded-lg text-xs font-bold transition ${
            pollType === "mcq4"
              ? "bg-blue-600 text-white shadow-md"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          4-Option Quiz
        </button>
      </div>

      {/* Board-Driven MCQ Quiz Checkbox (Screenshot 1) */}
      <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#10111a] border border-[#242634] text-xs font-bold text-gray-200 cursor-pointer">
        <input
          type="checkbox"
          checked={form.isQuickQuiz}
          onChange={(e) => setForm((f) => ({ ...f, isQuickQuiz: e.target.checked }))}
          className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
        />
        <span>Board-Driven MCQ Quiz</span>
      </label>

      {!form.isQuickQuiz && (
        <textarea
          rows={2}
          placeholder="Type your question statement here..."
          value={form.questionText}
          onChange={(e) => setForm((f) => ({ ...f, questionText: e.target.value }))}
          className="w-full rounded-xl border border-[#2d2e3b] bg-[#10111a] text-white py-2 px-3 text-xs outline-none focus:border-blue-500"
        />
      )}

      {/* Options List (Screenshot 1) */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
          OPTIONS (ANSWER WILL BE MARKED BY YOU AT REVEAL TIME):
        </span>
        <div className="space-y-1.5">
          {form.options.map((val, i) => {
            const key = String.fromCharCode(65 + i);
            return (
              <div
                key={key}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#10111a] border border-[#242634]"
              >
                <span className="w-6 h-6 rounded-lg bg-blue-600/30 text-blue-400 border border-blue-500/40 text-xs font-bold flex items-center justify-center font-mono">
                  {key}
                </span>
                <span className="text-xs font-semibold text-gray-200 flex-1">{val || `Option ${key}`}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timer dropdown (Screenshot 1) */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-gray-300 font-medium">Timer:</span>
        <select
          value={form.timeLimitSec}
          onChange={(e) => setForm((f) => ({ ...f, timeLimitSec: Number(e.target.value) }))}
          className="bg-[#10111a] border border-[#2d2e3b] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 font-mono font-bold cursor-pointer"
        >
          <option value={15}>15s</option>
          <option value={30}>30s</option>
          <option value={45}>45s</option>
          <option value={60}>60s</option>
          <option value={90}>90s</option>
          <option value={120}>120s</option>
        </select>
      </div>

      {/* Primary Action Button (Screenshot 1) */}
      <button
        type="button"
        disabled={launching}
        onClick={onLaunch}
        className="w-full bg-blue-600 hover:bg-blue-500 active:scale-98 text-white py-3 rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition disabled:opacity-60"
      >
        {launching
          ? "Launching…"
          : `Launch ${pollType === "mcq4" ? "4-Option Quiz" : "YES / NO Poll"}`}
      </button>
    </div>
  );
}
