import { Eye, EyeOff, Grid3X3, Link2, Orbit, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { ConceptTopographyReport, Link, Node, SourceType } from '../types';

interface Topography3DViewProps {
  report: ConceptTopographyReport;
  nodes: Node[];
  links: Link[];
  selectedNodeId?: string;
  onNodeSelect: (node: Node) => void;
}

const sourceColor: Record<SourceType, string> = {
  OT: '#9f5f25',
  STP: '#6a7b3f',
  NT: '#1f4f7a',
  Hellenistic: '#59407a',
  Manuscript: '#78716c',
};

type Point3D = {
  id: string;
  label: string;
  source: SourceType;
  x: number;
  y: number;
  z: number;
  drift: number;
};

type ProjectedPoint = Point3D & {
  px: number;
  py: number;
  depth: number;
  scale: number;
  radius: number;
};

type ProjectedLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  opacity: number;
};

type ProjectedRelationship = {
  key: string;
  sourceId: string;
  targetId: string;
  type: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  midX: number;
  midY: number;
  opacity: number;
  width: number;
  highlighted: boolean;
};

function normalizeToUnit(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return 0;
  }
  const ratio = (value - min) / (max - min);
  return ratio * 2 - 1;
}

function rotatePoint(point: { x: number; y: number; z: number }, yaw: number, pitch: number) {
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);

  const x1 = point.x * cosYaw + point.z * sinYaw;
  const z1 = -point.x * sinYaw + point.z * cosYaw;
  const y1 = point.y * cosPitch - z1 * sinPitch;
  const z2 = point.y * sinPitch + z1 * cosPitch;
  return { x: x1, y: y1, z: z2 };
}

export function Topography3DView({
  report,
  nodes,
  links,
  selectedNodeId,
  onNodeSelect,
}: Topography3DViewProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 900, height: 700 });
  const [yaw, setYaw] = useState(-0.35);
  const [pitch, setPitch] = useState(0.2);
  const [zoom, setZoom] = useState(1);
  const [showRelationships, setShowRelationships] = useState(true);
  const [showRelationshipLabels, setShowRelationshipLabels] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setSize({
        width: Math.max(320, entry.contentRect.width),
        height: Math.max(320, entry.contentRect.height),
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const pointIdSet = useMemo(
    () => new Set(report.entries.map((entry) => entry.nodeId)),
    [report.entries],
  );
  const reportLinks = useMemo(
    () => links.filter((link) => pointIdSet.has(link.source) && pointIdSet.has(link.target)),
    [links, pointIdSet],
  );

  const yearBounds = useMemo(() => {
    if (report.entries.length === 0) {
      return { minYear: -700, maxYear: 100 };
    }
    const years = report.entries.map((entry) => entry.estimatedYear);
    return {
      minYear: Math.min(...years),
      maxYear: Math.max(...years),
    };
  }, [report.entries]);

  const points = useMemo<Point3D[]>(() => {
    if (report.entries.length === 0) {
      return [];
    }

    return report.entries.map((entry) => ({
      id: entry.nodeId,
      label: entry.label,
      source: entry.source,
      x: normalizeToUnit(entry.estimatedYear, yearBounds.minYear, yearBounds.maxYear),
      y: normalizeToUnit(entry.semanticDensity, 0, 1),
      z: normalizeToUnit(entry.institutionalPower, 0, 1),
      drift: entry.driftScore,
    }));
  }, [report.entries, yearBounds.maxYear, yearBounds.minYear]);

  const projectionConfig = useMemo(() => {
    const centerX = size.width / 2;
    const centerY = size.height / 2;
    const baseScale = Math.min(size.width, size.height) * 0.26 * zoom;
    const camera = 3.2;
    return { centerX, centerY, baseScale, camera };
  }, [size.height, size.width, zoom]);

  const projectWorldPoint = (
    point: { x: number; y: number; z: number },
    config: { centerX: number; centerY: number; baseScale: number; camera: number },
  ) => {
    const r = rotatePoint(point, yaw, pitch);
    const perspective = config.camera / (config.camera - r.z * 1.2);
    const px = config.centerX + r.x * config.baseScale * perspective;
    const py = config.centerY - r.y * config.baseScale * perspective;
    return {
      x: px,
      y: py,
      depth: (r.z + 1) / 2,
      scale: Math.max(0.4, perspective),
    };
  };

  const projected = useMemo<ProjectedPoint[]>(() => {
    return points
      .map((point) => {
        const projectedPoint = projectWorldPoint(point, projectionConfig);
        const radius = (4 + point.drift * 6) * projectedPoint.scale;
        return {
          ...point,
          px: projectedPoint.x,
          py: projectedPoint.y,
          depth: projectedPoint.depth,
          scale: projectedPoint.scale,
          radius,
        };
      })
      .sort((a, b) => a.depth - b.depth);
  }, [pitch, points, projectionConfig, yaw]);
  const projectedById = useMemo(
    () => new Map(projected.map((entry) => [entry.id, entry])),
    [projected],
  );

  const relationshipSegments = useMemo<ProjectedRelationship[]>(() => {
    if (!showRelationships || reportLinks.length === 0) {
      return [];
    }
    return reportLinks
      .map((link) => {
        const source = projectedById.get(link.source);
        const target = projectedById.get(link.target);
        if (!source || !target) {
          return null;
        }
        const highlighted =
          selectedNodeId === source.id ||
          selectedNodeId === target.id ||
          hoveredPointId === source.id ||
          hoveredPointId === target.id;
        const averageDepth = (source.depth + target.depth) / 2;
        return {
          key: `${link.source}::${link.target}::${link.type}`,
          sourceId: link.source,
          targetId: link.target,
          type: link.type,
          x1: source.px,
          y1: source.py,
          x2: target.px,
          y2: target.py,
          midX: (source.px + target.px) / 2,
          midY: (source.py + target.py) / 2,
          opacity: highlighted ? 0.68 : 0.18 + averageDepth * 0.35,
          width: highlighted ? 2 : 1.2,
          highlighted,
        };
      })
      .filter((entry): entry is ProjectedRelationship => entry !== null);
  }, [hoveredPointId, projectedById, reportLinks, selectedNodeId, showRelationships]);

  const axisLines = useMemo(() => {
    const project = (p: { x: number; y: number; z: number }) => projectWorldPoint(p, projectionConfig);
    return {
      origin: project({ x: 0, y: 0, z: 0 }),
      x: project({ x: 1, y: 0, z: 0 }),
      xNeg: project({ x: -1, y: 0, z: 0 }),
      y: project({ x: 0, y: 1, z: 0 }),
      yNeg: project({ x: 0, y: -1, z: 0 }),
      z: project({ x: 0, y: 0, z: 1 }),
      zNeg: project({ x: 0, y: 0, z: -1 }),
    };
  }, [pitch, projectionConfig, yaw]);

  const gridLines = useMemo<ProjectedLine[]>(() => {
    if (!showGrid) {
      return [];
    }
    const ticks = [-1, -0.5, 0, 0.5, 1];
    const lines: ProjectedLine[] = [];
    const addLine = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => {
      const p1 = projectWorldPoint(a, projectionConfig);
      const p2 = projectWorldPoint(b, projectionConfig);
      lines.push({
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        opacity: 0.12 + Math.min(p1.depth, p2.depth) * 0.18,
      });
    };

    for (const tick of ticks) {
      addLine({ x: -1, y: -1, z: tick }, { x: 1, y: -1, z: tick });
      addLine({ x: tick, y: -1, z: -1 }, { x: tick, y: -1, z: 1 });
    }
    for (const tick of [-1, 0, 1]) {
      addLine({ x: -1, y: tick, z: -1 }, { x: -1, y: tick, z: 1 });
      addLine({ x: -1, y: -1, z: tick }, { x: -1, y: 1, z: tick });
    }
    return lines;
  }, [pitch, projectionConfig, showGrid, yaw]);

  useEffect(() => {
    if (!autoRotate || isDragging) {
      return;
    }
    const id = window.setInterval(() => {
      setYaw((prev) => prev + 0.012);
    }, 24);
    return () => window.clearInterval(id);
  }, [autoRotate, isDragging]);

  const resetView = () => {
    setYaw(-0.35);
    setPitch(0.2);
    setZoom(1);
    setShowRelationshipLabels(false);
    setAutoRotate(false);
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      yaw,
      pitch,
    };
    setIsDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragStartRef.current) {
      return;
    }
    const dx = event.clientX - dragStartRef.current.x;
    const dy = event.clientY - dragStartRef.current.y;
    setYaw(dragStartRef.current.yaw + dx * 0.006);
    setPitch(Math.max(-1.2, Math.min(1.2, dragStartRef.current.pitch + dy * 0.006)));
  };

  const onPointerUp = () => {
    dragStartRef.current = null;
    setIsDragging(false);
  };

  const onWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const next = zoom + (event.deltaY > 0 ? -0.08 : 0.08);
    setZoom(Math.max(0.55, Math.min(2.2, next)));
  };

  const hoveredPoint = projected.find((entry) => entry.id === hoveredPointId) ?? null;
  const labelLimit = zoom >= 1.35 ? 18 : 10;
  const relationshipLabelCap = zoom >= 1.35 ? 18 : 8;

  return (
    <div
      ref={wrapperRef}
      className="relative h-full w-full rounded-2xl border border-amber-200 bg-[radial-gradient(circle_at_20%_10%,_#ffffff_0%,_#f8fafc_48%,_#edf2f7_100%)]"
    >
      <svg
        width={size.width}
        height={size.height}
        className={`h-full w-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        onDoubleClick={resetView}
        onWheel={onWheel}
      >
        {gridLines.map((line, index) => (
          <line
            key={`grid-${index}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="#64748b"
            strokeWidth={1}
            opacity={line.opacity}
          />
        ))}

        <line
          x1={axisLines.xNeg.x}
          y1={axisLines.xNeg.y}
          x2={axisLines.x.x}
          y2={axisLines.x.y}
          stroke="#475569"
          strokeWidth={1.8}
          opacity={0.88}
        />
        <line
          x1={axisLines.yNeg.x}
          y1={axisLines.yNeg.y}
          x2={axisLines.y.x}
          y2={axisLines.y.y}
          stroke="#475569"
          strokeWidth={1.8}
          opacity={0.88}
        />
        <line
          x1={axisLines.zNeg.x}
          y1={axisLines.zNeg.y}
          x2={axisLines.z.x}
          y2={axisLines.z.y}
          stroke="#475569"
          strokeWidth={1.8}
          opacity={0.88}
        />

        {relationshipSegments.map((segment) => (
          <line
            key={`rel-${segment.key}`}
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            stroke={segment.highlighted ? '#1e3a8a' : '#334155'}
            strokeWidth={segment.width}
            opacity={segment.opacity}
          />
        ))}

        {showRelationshipLabels && relationshipSegments.length <= relationshipLabelCap
          ? relationshipSegments.map((segment) => (
              <text
                key={`rel-label-${segment.key}`}
                x={segment.midX}
                y={segment.midY - 4}
                textAnchor="middle"
                fontSize={10}
                fill="#64748b"
                opacity={segment.highlighted ? 0.9 : 0.68}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {segment.type
                  .replace(/[_-]+/g, ' ')
                  .replace(/\b\w/g, (ch) => ch.toUpperCase())}
              </text>
            ))
          : null}

        {projected.map((point) => {
          const node = nodeById.get(point.id);
          const selected = point.id === selectedNodeId;
          const showPointLabel =
            selected ||
            hoveredPointId === point.id ||
            (showLabels && projected.length <= labelLimit);
          return (
            <g
              key={`pt-${point.id}`}
              onClick={() => node && onNodeSelect(node)}
              onMouseEnter={() => setHoveredPointId(point.id)}
              onMouseLeave={() => setHoveredPointId((prev) => (prev === point.id ? null : prev))}
              style={{ cursor: node ? 'pointer' : 'default' }}
            >
              <circle
                cx={point.px}
                cy={point.py}
                r={selected ? point.radius + 2 : point.radius}
                fill={sourceColor[point.source]}
                opacity={selected ? 1 : 0.58 + point.depth * 0.35}
                stroke={selected ? '#111827' : '#ffffff'}
                strokeWidth={selected ? 2.4 : 1.2}
              />
              {showPointLabel ? (
                <text
                  x={point.px}
                  y={point.py + point.radius + 11}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#1f2937"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {point.label.length > 34 ? `${point.label.slice(0, 31)}...` : point.label}
                </text>
              ) : null}
            </g>
          );
        })}

        <text x={axisLines.x.x + 8} y={axisLines.x.y} fontSize={11} fill="#334155">
          Time
        </text>
        <text x={axisLines.y.x + 8} y={axisLines.y.y} fontSize={11} fill="#334155">
          Semantic
        </text>
        <text x={axisLines.z.x + 8} y={axisLines.z.y} fontSize={11} fill="#334155">
          Power
        </text>
      </svg>

      <div className="absolute left-3 top-3 rounded-lg border border-amber-200 bg-white/92 px-2.5 py-1.5 text-[11px] text-slate-700 shadow-sm">
        <p>Drag rotate • Scroll zoom • Node size = drift</p>
        <p>
          Nodes {projected.length} • Relationships {reportLinks.length} • Years {Math.round(yearBounds.minYear)} to{' '}
          {Math.round(yearBounds.maxYear)}
        </p>
      </div>

      <div className="absolute right-3 top-3 flex flex-wrap items-center gap-1.5">
        <button
          onClick={() =>
            setShowRelationships((prev) => {
              const next = !prev;
              if (!next) {
                setShowRelationshipLabels(false);
              }
              return next;
            })
          }
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/92 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-white"
        >
          <Link2 className="h-3 w-3" />
          {showRelationships ? 'Lines On' : 'Lines Off'}
        </button>
        <button
          onClick={() => setShowRelationshipLabels((prev) => !prev)}
          disabled={!showRelationships}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/92 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Link2 className="h-3 w-3" />
          {showRelationshipLabels ? 'Line Labels On' : 'Line Labels Off'}
        </button>
        <button
          onClick={() => setShowLabels((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/92 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-white"
        >
          {showLabels ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {showLabels ? 'Hide Labels' : 'Show Labels'}
        </button>
        <button
          onClick={() => setShowGrid((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/92 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-white"
        >
          <Grid3X3 className="h-3 w-3" />
          {showGrid ? 'Grid On' : 'Grid Off'}
        </button>
        <button
          onClick={() => setAutoRotate((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/92 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-white"
        >
          <Orbit className="h-3 w-3" />
          {autoRotate ? 'Auto Rotate On' : 'Auto Rotate Off'}
        </button>
        <button
          onClick={resetView}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/92 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-white"
        >
          <RefreshCw className="h-3 w-3" />
          Reset
        </button>
      </div>

      <div className="absolute right-3 bottom-3 rounded-lg border border-slate-200 bg-white/90 px-2 py-1 text-[11px] text-slate-700 shadow-sm">
        Zoom {zoom.toFixed(2)}x • Semantic 0-1 • Power 0-1 {isDragging ? '• rotating' : ''}
      </div>

      <div className="absolute left-3 bottom-3 rounded-lg border border-slate-200 bg-white/92 px-2.5 py-1.5 text-[11px] text-slate-700 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(sourceColor) as SourceType[]).map((source) => (
            <span key={`legend-${source}`} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: sourceColor[source] }} />
              {source}
            </span>
          ))}
        </div>
      </div>

      {hoveredPoint ? (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[11px] text-slate-700 shadow-md"
          style={{
            left: Math.min(size.width - 220, Math.max(10, hoveredPoint.px + 10)),
            top: Math.min(size.height - 88, Math.max(10, hoveredPoint.py - 54)),
            width: 210,
          }}
        >
          <p className="font-semibold text-slate-900">
            {hoveredPoint.label.length > 56 ? `${hoveredPoint.label.slice(0, 53)}...` : hoveredPoint.label}
          </p>
          <p>
            Source: {hoveredPoint.source} • Drift: {hoveredPoint.drift.toFixed(2)}
          </p>
        </div>
      ) : null}

      {projected.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/65">
          <p className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-slate-600">
            Topography points will appear after concept-topography analysis is generated.
          </p>
        </div>
      ) : null}
    </div>
  );
}
