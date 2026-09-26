import React from "react";
import {
  CamDrawDocument,
  CamDrawElement,
  AtomElement,
  BondElement,
  RingElement,
  ReactionArrowElement,
  CurvedArrowElement,
  PhysicsSymbolElement,
  BioShapeElement,
  TextAnnotationElement,
  MathPlotElement,
  ConnectorElement,
  FreehandElement,
} from "./types";

export interface CamDrawRendererProps {
  document: CamDrawDocument | string | null | undefined;
  className?: string;
  theme?: "light" | "dark" | "print";
  maxWidth?: number | string;
  maxHeight?: number | string;
  interactive?: boolean;
  selectedElementId?: string | null;
  onElementClick?: (elementId: string) => void;
}

/**
 * Safely parses string or object to CamDrawDocument
 */
export function parseCamDrawDocument(
  data: CamDrawDocument | string | null | undefined
): CamDrawDocument | null {
  if (!data) return null;
  if (typeof data === "object" && data.elements && Array.isArray(data.elements)) {
    return data as CamDrawDocument;
  }
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      if (parsed && Array.isArray(parsed.elements)) {
        return parsed as CamDrawDocument;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function CamDrawRenderer({
  document: docProp,
  className = "",
  theme = "light",
  maxWidth = "100%",
  maxHeight = "auto",
  interactive = false,
  selectedElementId = null,
  onElementClick,
}: CamDrawRendererProps) {
  const doc = parseCamDrawDocument(docProp);

  if (!doc || !doc.elements || doc.elements.length === 0) {
    return null;
  }

  const { width = 800, height = 500, background = "transparent" } = doc.canvas || {};
  const isDark = theme === "dark";
  const isPrint = theme === "print";

  const defaultStroke = isPrint ? "#000000" : isDark ? "#f8fafc" : "#1e293b";
  const defaultFill = isPrint ? "#000000" : isDark ? "#f8fafc" : "#0f172a";
  const defaultBg = isPrint ? "#ffffff" : isDark ? "#0f172a" : background;

  return (
    <div
      className={`inline-block select-none overflow-hidden relative ${className}`}
      style={{ maxWidth, maxHeight }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto block"
        style={{
          maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight,
          backgroundColor: defaultBg,
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Reaction Arrowhead marker */}
          <marker
            id={`arr-head-${theme}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill={defaultStroke} />
          </marker>

          {/* Curved Electron Arrowhead marker */}
          <marker
            id={`curved-head-${theme}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 2 L 8 5 L 0 8 z" fill="#dc2626" />
          </marker>

          {/* Vector arrowhead */}
          <marker
            id={`vec-head-${theme}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill={defaultStroke} />
          </marker>
        </defs>

        {/* Render Elements by Layer */}
        {doc.elements.map((el) => (
          <RenderElement
            key={el.id}
            element={el}
            theme={theme}
            defaultStroke={defaultStroke}
            defaultFill={defaultFill}
            interactive={interactive}
            isSelected={selectedElementId === el.id}
            onClick={() => onElementClick && onElementClick(el.id)}
          />
        ))}
      </svg>
    </div>
  );
}

function RenderElement({
  element,
  theme,
  defaultStroke,
  defaultFill,
  interactive,
  isSelected,
  onClick,
}: {
  element: CamDrawElement;
  theme: "light" | "dark" | "print";
  defaultStroke: string;
  defaultFill: string;
  interactive: boolean;
  isSelected: boolean;
  onClick?: () => void;
}) {
  const isDark = theme === "dark";
  const strokeColor = element.color || defaultStroke;
  const fillColor = element.color || defaultFill;

  const selectionOutline = isSelected ? (
    <rect
      x="-8"
      y="-8"
      width="16"
      height="16"
      fill="none"
      stroke="#3b82f6"
      strokeWidth="2"
      strokeDasharray="3,3"
    />
  ) : null;

  switch (element.type) {
    case "atom": {
      const atom = element as AtomElement;
      const fontSize = atom.fontSize || 18;

      // Parse subscript numbers like H3, O2, etc.
      const formattedSymbol = formatChemicalFormula(atom.symbol);

      return (
        <g
          id={atom.id}
          transform={`translate(${atom.x}, ${atom.y})`}
          className={interactive ? "cursor-pointer hover:opacity-80" : ""}
          onClick={onClick}
        >
          {selectionOutline}
          {/* Background circle to mask out intersecting bonds */}
          <circle r={fontSize * 0.75} fill={theme === "dark" ? "#0f172a" : "#ffffff"} />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={fontSize}
            fontWeight="bold"
            fontFamily="system-ui, -apple-system, sans-serif"
            fill={fillColor}
          >
            {formattedSymbol}
          </text>
          {/* Formal Charge Badge */}
          {atom.charge && (
            <text
              x={fontSize * 0.7}
              y={-fontSize * 0.5}
              fontSize={fontSize * 0.65}
              fontWeight="black"
              fill="#dc2626"
            >
              {atom.charge}
            </text>
          )}
          {/* Lone Pairs */}
          {atom.lonePairs ? renderLonePairs(atom.lonePairs, fontSize, fillColor) : null}
        </g>
      );
    }

    case "bond": {
      const bond = element as BondElement;
      const thickness = bond.thickness || 2.2;
      const { start, end, bondType } = bond;

      return (
        <g
          id={bond.id}
          className={interactive ? "cursor-pointer hover:opacity-80" : ""}
          onClick={onClick}
        >
          {renderBond(start, end, bondType, thickness, strokeColor, isSelected)}
        </g>
      );
    }

    case "ring": {
      const ring = element as RingElement;
      const { cx, cy, radius = 55, ringType, aromaticCircle, rotation = 0 } = ring;
      const sides =
        ringType === "cyclopentane" || ringType === "pyrrole" || ringType === "furan"
          ? 5
          : ringType === "cyclobutane"
          ? 4
          : ringType === "cyclopropane"
          ? 3
          : 6;

      const points = [];
      const angleStep = (Math.PI * 2) / sides;
      const startAngle = (rotation * Math.PI) / 180 - Math.PI / 2;

      for (let i = 0; i < sides; i++) {
        const angle = startAngle + i * angleStep;
        const px = cx + radius * Math.cos(angle);
        const py = cy + radius * Math.sin(angle);
        points.push(`${px},${py}`);
      }

      const pointsStr = points.join(" ");

      return (
        <g
          id={ring.id}
          className={interactive ? "cursor-pointer hover:opacity-80" : ""}
          onClick={onClick}
        >
          <polygon
            points={pointsStr}
            fill="none"
            stroke={isSelected ? "#3b82f6" : strokeColor}
            strokeWidth={isSelected ? 3.5 : 2.2}
            strokeLinejoin="round"
          />
          {aromaticCircle && (
            <circle
              cx={cx}
              cy={cy}
              r={radius * 0.55}
              fill="none"
              stroke={strokeColor}
              strokeWidth={1.8}
            />
          )}
        </g>
      );
    }

    case "reaction_arrow": {
      const arrow = element as ReactionArrowElement;
      const { start, end, topReagents, bottomConditions, arrowStyle } = arrow;
      const thickness = arrow.thickness || 2.2;
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;

      return (
        <g
          id={arrow.id}
          className={interactive ? "cursor-pointer hover:opacity-80" : ""}
          onClick={onClick}
        >
          {/* Reaction Arrow Line with Marker */}
          <line
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke={isSelected ? "#3b82f6" : strokeColor}
            strokeWidth={thickness}
            markerEnd={`url(#arr-head-${theme})`}
          />

          {/* Reagents / Catalyst above arrow */}
          {topReagents && (
            <text
              x={midX}
              y={midY - 10}
              textAnchor="middle"
              fontSize={14}
              fontWeight="600"
              fontFamily="system-ui, -apple-system, sans-serif"
              fill={fillColor}
            >
              {topReagents}
            </text>
          )}

          {/* Conditions / Temperature below arrow */}
          {bottomConditions && (
            <text
              x={midX}
              y={midY + 22}
              textAnchor="middle"
              fontSize={13}
              fontStyle="italic"
              fontFamily="system-ui, -apple-system, sans-serif"
              fill={isDark ? "#94a3b8" : "#475569"}
            >
              {bottomConditions}
            </text>
          )}
        </g>
      );
    }

    case "curved_arrow": {
      const curved = element as CurvedArrowElement;
      const { start, control, end, thickness = 2 } = curved;
      const pathData = `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;

      return (
        <g
          id={curved.id}
          className={interactive ? "cursor-pointer hover:opacity-80" : ""}
          onClick={onClick}
        >
          <path
            d={pathData}
            fill="none"
            stroke={isSelected ? "#3b82f6" : "#dc2626"}
            strokeWidth={thickness}
            markerEnd={`url(#curved-head-${theme})`}
          />
        </g>
      );
    }

    case "physics_symbol": {
      const phys = element as PhysicsSymbolElement;
      return renderPhysicsSymbol(phys, strokeColor, fillColor, isDark, isSelected, onClick);
    }

    case "bio_shape": {
      const bio = element as BioShapeElement;
      return renderBioShape(bio, strokeColor, fillColor, isDark, isSelected, onClick);
    }

    case "math_plot": {
      const math = element as MathPlotElement;
      return renderMathPlot(math, strokeColor, fillColor, isDark, isSelected, onClick);
    }

    case "text": {
      const txt = element as TextAnnotationElement;
      return (
        <g
          id={txt.id}
          transform={`translate(${txt.x}, ${txt.y})`}
          className={interactive ? "cursor-pointer hover:opacity-80" : ""}
          onClick={onClick}
        >
          <text
            textAnchor="start"
            dominantBaseline="auto"
            fontSize={txt.fontSize || 16}
            fontWeight={txt.fontWeight || "normal"}
            fontStyle={txt.italic ? "italic" : "normal"}
            fontFamily="system-ui, -apple-system, sans-serif"
            fill={fillColor}
          >
            {txt.text}
          </text>
        </g>
      );
    }

    case "connector": {
      const conn = element as ConnectorElement;
      const points = conn.points || [];
      if (points.length < 2) return null;
      const pathD = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

      return (
        <g id={conn.id} onClick={onClick}>
          <path
            d={pathD}
            fill="none"
            stroke={isSelected ? "#3b82f6" : strokeColor}
            strokeWidth={2}
            strokeDasharray={
              conn.style === "dashed" ? "5,5" : conn.style === "dotted" ? "2,3" : undefined
            }
            markerEnd={conn.arrowEnd ? `url(#vec-head-${theme})` : undefined}
          />
        </g>
      );
    }

    case "freehand": {
      const free = element as FreehandElement;
      const points = free.points || [];
      if (points.length < 2) return null;
      const pathD = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

      return (
        <path
          key={free.id}
          d={pathD}
          fill="none"
          stroke={isSelected ? "#3b82f6" : strokeColor}
          strokeWidth={free.strokeWidth || 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    }

    default:
      return null;
  }
}

/**
 * Renders bonds (Single, Double, Triple, Wedge, Dash, Aromatic)
 */
function renderBond(
  start: { x: number; y: number },
  end: { x: number; y: number },
  bondType: string,
  thickness: number,
  strokeColor: string,
  isSelected: boolean
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;

  const nx = -dy / len;
  const ny = dx / len;
  const offset = 4;

  if (bondType === "double") {
    return (
      <g>
        <line
          x1={start.x + nx * offset}
          y1={start.y + ny * offset}
          x2={end.x + nx * offset}
          y2={end.y + ny * offset}
          stroke={isSelected ? "#3b82f6" : strokeColor}
          strokeWidth={thickness}
        />
        <line
          x1={start.x - nx * offset}
          y1={start.y - ny * offset}
          x2={end.x - nx * offset}
          y2={end.y - ny * offset}
          stroke={isSelected ? "#3b82f6" : strokeColor}
          strokeWidth={thickness}
        />
      </g>
    );
  }

  if (bondType === "triple") {
    return (
      <g>
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={isSelected ? "#3b82f6" : strokeColor}
          strokeWidth={thickness}
        />
        <line
          x1={start.x + nx * (offset * 1.5)}
          y1={start.y + ny * (offset * 1.5)}
          x2={end.x + nx * (offset * 1.5)}
          y2={end.y + ny * (offset * 1.5)}
          stroke={isSelected ? "#3b82f6" : strokeColor}
          strokeWidth={thickness}
        />
        <line
          x1={start.x - nx * (offset * 1.5)}
          y1={start.y - ny * (offset * 1.5)}
          x2={end.x - nx * (offset * 1.5)}
          y2={end.y - ny * (offset * 1.5)}
          stroke={isSelected ? "#3b82f6" : strokeColor}
          strokeWidth={thickness}
        />
      </g>
    );
  }

  if (bondType === "wedge") {
    const wedgeW = 7;
    const p1 = `${start.x},${start.y}`;
    const p2 = `${end.x + nx * wedgeW},${end.y + ny * wedgeW}`;
    const p3 = `${end.x - nx * wedgeW},${end.y - ny * wedgeW}`;
    return <polygon points={`${p1} ${p2} ${p3}`} fill={isSelected ? "#3b82f6" : strokeColor} />;
  }

  if (bondType === "dash") {
    return (
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={isSelected ? "#3b82f6" : strokeColor}
        strokeWidth={thickness}
        strokeDasharray="4,4"
      />
    );
  }

  // Single bond default
  return (
    <line
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      stroke={isSelected ? "#3b82f6" : strokeColor}
      strokeWidth={thickness}
      strokeLinecap="round"
    />
  );
}

/**
 * Format chemical formula into JSX with subscripts
 */
function formatChemicalFormula(formula: string): React.ReactNode[] {
  if (!formula) return [];
  const parts = formula.split(/(\d+)/g);
  return parts.map((part, idx) => {
    if (/^\d+$/.test(part)) {
      return (
        <tspan key={idx} dy="4" fontSize="75%">
          {part}
        </tspan>
      );
    }
    return (
      <tspan key={idx} dy="0">
        {part}
      </tspan>
    );
  });
}

/**
 * Render electron lone pairs around an atom
 */
function renderLonePairs(count: number, fontSize: number, color: string) {
  const dots = [];
  const r = 2;
  const dist = fontSize * 0.75;

  if (count >= 1) {
    // Top pair
    dots.push(<circle key="lp1" cx={-4} cy={-dist} r={r} fill={color} />);
    dots.push(<circle key="lp2" cx={4} cy={-dist} r={r} fill={color} />);
  }
  if (count >= 2) {
    // Bottom pair
    dots.push(<circle key="lp3" cx={-4} cy={dist} r={r} fill={color} />);
    dots.push(<circle key="lp4" cx={4} cy={dist} r={r} fill={color} />);
  }
  if (count >= 3) {
    // Right pair
    dots.push(<circle key="lp5" cx={dist} cy={-4} r={r} fill={color} />);
    dots.push(<circle key="lp6" cx={dist} cy={4} r={r} fill={color} />);
  }

  return <g>{dots}</g>;
}

/**
 * Render Physics schematic elements
 */
function renderPhysicsSymbol(
  symbol: PhysicsSymbolElement,
  strokeColor: string,
  fillColor: string,
  isDark: boolean,
  isSelected: boolean,
  onClick?: () => void
) {
  const { x, y, width, height, symbolType, label, rotation = 0 } = symbol;

  return (
    <g
      id={symbol.id}
      transform={`translate(${x}, ${y}) rotate(${rotation})`}
      onClick={onClick}
    >
      {symbolType === "resistor" && (
        <path
          d={`M ${-width / 2} 0 L ${-width / 3} 0 L ${-width / 4} ${-height / 2} L ${-width / 8} ${
            height / 2
          } L 0 ${-height / 2} L ${width / 8} ${height / 2} L ${width / 4} ${
            -height / 2
          } L ${width / 3} 0 L ${width / 2} 0`}
          fill="none"
          stroke={isSelected ? "#3b82f6" : strokeColor}
          strokeWidth={2.2}
        />
      )}

      {symbolType === "capacitor" && (
        <g>
          <line x1={-width / 2} y1={0} x2={-4} y2={0} stroke={strokeColor} strokeWidth={2} />
          <line x1={-4} y1={-height / 2} x2={-4} y2={height / 2} stroke={strokeColor} strokeWidth={2.5} />
          <line x1={4} y1={-height / 2} x2={4} y2={height / 2} stroke={strokeColor} strokeWidth={2.5} />
          <line x1={4} y1={0} x2={width / 2} y2={0} stroke={strokeColor} strokeWidth={2} />
        </g>
      )}

      {symbolType === "battery" && (
        <g>
          <line x1={-width / 2} y1={0} x2={-6} y2={0} stroke={strokeColor} strokeWidth={2} />
          {/* Long plate (+) */}
          <line x1={-6} y1={-height / 2} x2={-6} y2={height / 2} stroke={strokeColor} strokeWidth={3} />
          {/* Short plate (-) */}
          <line x1={6} y1={-height / 4} x2={6} y2={height / 4} stroke={strokeColor} strokeWidth={4.5} />
          <line x1={6} y1={0} x2={width / 2} y2={0} stroke={strokeColor} strokeWidth={2} />
        </g>
      )}

      {symbolType === "convex_lens" && (
        <path
          d={`M 0 ${-height / 2} Q ${width} 0 0 ${height / 2} Q ${-width} 0 0 ${-height / 2}`}
          fill={isDark ? "rgba(59, 130, 246, 0.2)" : "rgba(191, 219, 254, 0.4)"}
          stroke={isSelected ? "#3b82f6" : "#2563eb"}
          strokeWidth={2}
        />
      )}

      {symbolType === "force_vector" && (
        <line
          x1={0}
          y1={0}
          x2={width}
          y2={0}
          stroke={isSelected ? "#3b82f6" : "#16a34a"}
          strokeWidth={3}
          markerEnd="url(#vec-head-light)"
        />
      )}

      {/* Label */}
      {label && (
        <text
          x={0}
          y={height / 2 + 16}
          textAnchor="middle"
          fontSize={13}
          fontWeight="bold"
          fontFamily="system-ui, sans-serif"
          fill={fillColor}
        >
          {label}
        </text>
      )}
    </g>
  );
}

/**
 * Render Biology shapes
 */
function renderBioShape(
  bio: BioShapeElement,
  strokeColor: string,
  fillColor: string,
  isDark: boolean,
  isSelected: boolean,
  onClick?: () => void
) {
  const { x, y, width, height, shapeType, label } = bio;

  return (
    <g id={bio.id} transform={`translate(${x}, ${y})`} onClick={onClick}>
      {shapeType === "cell_membrane" && (
        <ellipse
          cx={0}
          cy={0}
          rx={width / 2}
          ry={height / 2}
          fill={isDark ? "rgba(30, 41, 59, 0.5)" : "rgba(241, 245, 249, 0.7)"}
          stroke={isSelected ? "#3b82f6" : strokeColor}
          strokeWidth={2.5}
        />
      )}

      {shapeType === "nucleus" && (
        <g>
          <ellipse
            cx={0}
            cy={0}
            rx={width / 2}
            ry={height / 2}
            fill={isDark ? "rgba(99, 102, 241, 0.3)" : "rgba(224, 231, 255, 0.8)"}
            stroke={isSelected ? "#3b82f6" : "#6366f1"}
            strokeWidth={2}
          />
          {/* Nucleolus */}
          <circle cx={0} cy={0} r={width * 0.18} fill="#4f46e5" />
        </g>
      )}

      {shapeType === "mitochondria" && (
        <g>
          <ellipse
            cx={0}
            cy={0}
            rx={width / 2}
            ry={height / 2}
            fill={isDark ? "rgba(245, 158, 11, 0.2)" : "rgba(254, 243, 199, 0.8)"}
            stroke="#d97706"
            strokeWidth={2}
          />
          {/* Inner cristae fold */}
          <path
            d={`M ${-width * 0.3} 0 Q 0 ${-height * 0.3} ${width * 0.3} 0`}
            fill="none"
            stroke="#d97706"
            strokeWidth={1.5}
          />
        </g>
      )}

      {label && (
        <text
          x={0}
          y={height / 2 + 14}
          textAnchor="middle"
          fontSize={12}
          fontWeight="600"
          fontFamily="system-ui, sans-serif"
          fill={fillColor}
        >
          {label}
        </text>
      )}
    </g>
  );
}

/**
 * Render Math plots (Axes, Parabola, Functions)
 */
function renderMathPlot(
  math: MathPlotElement,
  strokeColor: string,
  fillColor: string,
  isDark: boolean,
  isSelected: boolean,
  onClick?: () => void
) {
  const { cx, cy, width, height, plotType, xLabel, yLabel, label } = math;

  return (
    <g id={math.id} transform={`translate(${cx}, ${cy})`} onClick={onClick}>
      {plotType === "axes" && (
        <g>
          {/* X Axis */}
          <line
            x1={-width / 2}
            y1={0}
            x2={width / 2}
            y2={0}
            stroke={strokeColor}
            strokeWidth={2}
            markerEnd="url(#vec-head-light)"
          />
          {/* Y Axis */}
          <line
            x1={0}
            y1={height / 2}
            x2={0}
            y2={-height / 2}
            stroke={strokeColor}
            strokeWidth={2}
            markerEnd="url(#vec-head-light)"
          />
          {xLabel && (
            <text
              x={width / 2 - 10}
              y={20}
              textAnchor="end"
              fontSize={13}
              fontWeight="bold"
              fill={fillColor}
            >
              {xLabel}
            </text>
          )}
          {yLabel && (
            <text
              x={15}
              y={-height / 2 + 15}
              textAnchor="start"
              fontSize={13}
              fontWeight="bold"
              fill={fillColor}
            >
              {yLabel}
            </text>
          )}
        </g>
      )}

      {plotType === "parabola" && (
        <path
          d={`M ${-width / 2} ${-height / 2} Q 0 0 ${width / 2} ${-height / 2}`}
          fill="none"
          stroke={isSelected ? "#3b82f6" : "#2563eb"}
          strokeWidth={2.5}
        />
      )}

      {label && (
        <text
          x={width / 4}
          y={-height / 3}
          fontSize={14}
          fontWeight="bold"
          fontStyle="italic"
          fill={fillColor}
        >
          {label}
        </text>
      )}
    </g>
  );
}

/**
 * Export CamDraw document to standalone SVG string for PDF or image rendering
 */
export function exportCamDrawToSvgString(
  doc: CamDrawDocument,
  optionsOrTheme?: "light" | "dark" | "print" | { theme?: "light" | "dark" | "print"; responsive?: boolean }
): string {
  const options =
    typeof optionsOrTheme === "string"
      ? { theme: optionsOrTheme }
      : optionsOrTheme || {};
  const theme = options.theme || "light";
  const width = doc.canvas?.width || 800;
  const height = doc.canvas?.height || 500;
  const bg = theme === "print" ? "#ffffff" : theme === "dark" ? "#0f172a" : doc.canvas?.background || "transparent";

  // Quick serialized SVG header
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background-color: ${bg}; font-family: system-ui, -apple-system, sans-serif;">\n`;

  // Defs with markers
  svg += `  <defs>
    <marker id="arr-head-svg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#1e293b" />
    </marker>
    <marker id="curved-head-svg" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 2 L 8 5 L 0 8 z" fill="#dc2626" />
    </marker>
  </defs>\n`;

  for (const el of doc.elements) {
    if (el.type === "atom") {
      const a = el as AtomElement;
      svg += `  <g transform="translate(${a.x}, ${a.y})">
    <circle r="${(a.fontSize || 18) * 0.75}" fill="#ffffff" />
    <text text-anchor="middle" dominant-baseline="central" font-size="${a.fontSize || 18}" font-weight="bold" fill="${a.color || "#0f172a"}">${a.symbol}</text>
  </g>\n`;
    } else if (el.type === "bond") {
      const b = el as BondElement;
      svg += `  <line x1="${b.start.x}" y1="${b.start.y}" x2="${b.end.x}" y2="${b.end.y}" stroke="${b.color || "#1e293b"}" stroke-width="${b.thickness || 2.2}" stroke-linecap="round" />\n`;
    } else if (el.type === "reaction_arrow") {
      const r = el as ReactionArrowElement;
      svg += `  <line x1="${r.start.x}" y1="${r.start.y}" x2="${r.end.x}" y2="${r.end.y}" stroke="${r.color || "#0284c7"}" stroke-width="${r.thickness || 2.5}" marker-end="url(#arr-head-svg)" />\n`;
      if (r.topReagents) {
        svg += `  <text x="${(r.start.x + r.end.x) / 2}" y="${(r.start.y + r.end.y) / 2 - 10}" text-anchor="middle" font-size="14" font-weight="600" fill="#0f172a">${r.topReagents}</text>\n`;
      }
    } else if (el.type === "ring") {
      const ring = el as RingElement;
      const sides = ring.ringType === "cyclopentane" ? 5 : 6;
      const points = [];
      for (let i = 0; i < sides; i++) {
        const ang = (i * 2 * Math.PI) / sides - Math.PI / 2;
        points.push(`${ring.cx + ring.radius * Math.cos(ang)},${ring.cy + ring.radius * Math.sin(ang)}`);
      }
      svg += `  <polygon points="${points.join(" ")}" fill="none" stroke="${ring.color || "#1e293b"}" stroke-width="2.2" stroke-linejoin="round" />\n`;
      if (ring.aromaticCircle) {
        svg += `  <circle cx="${ring.cx}" cy="${ring.cy}" r="${ring.radius * 0.55}" fill="none" stroke="${ring.color || "#1e293b"}" stroke-width="1.8" />\n`;
      }
    }
  }

  svg += `</svg>`;
  return svg;
}
