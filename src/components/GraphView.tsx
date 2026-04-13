import * as d3 from 'd3';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, Maximize2, Search, ZoomIn, ZoomOut } from 'lucide-react';

import type { AppLanguage, Link, Node, SourceType } from '../types';
import { lineTypeLabel } from '../lib/i18n';

interface GraphViewProps {
  language: AppLanguage;
  nodes: Node[];
  links: Link[];
  selectedNodeId?: string;
  selectedLinkId?: string;
  showLinkLabels?: boolean;
  showLinkDescriptions?: boolean;
  onNodeSelect: (node: Node) => void;
  onLinkSelect: (link: Link) => void;
}

type SimNode = Node & d3.SimulationNodeDatum;
type SimEndpoint = string | number | SimNode;
type SimLink = d3.SimulationLinkDatum<SimNode> &
  Omit<Link, 'source' | 'target'> & {
    source: SimEndpoint;
    target: SimEndpoint;
  };

const sourceColor: Record<SourceType, string> = {
  ANE: '#7c3f2a',
  OT: '#9f5f25',
  STP: '#6a7b3f',
  NT: '#1f4f7a',
  Hellenistic: '#59407a',
  Manuscript: '#78716c',
};

function resolvedLinkId(link: Pick<Link, 'source' | 'target' | 'type'>): string {
  return `${link.source}::${link.target}::${link.type}`;
}

function endpointId(endpoint: SimEndpoint): string {
  if (typeof endpoint === 'object') {
    return endpoint.id;
  }

  return String(endpoint);
}

function endpointCoord(endpoint: SimEndpoint, axis: 'x' | 'y'): number {
  if (typeof endpoint === 'object') {
    return endpoint[axis] ?? 0;
  }

  return 0;
}

function isPlaceholderDescription(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return true;
  }
  return /^(?:no description provided|no description|none|n\/a|not provided|unknown|tbd)\.?$/i.test(
    normalized,
  );
}

function relationPhraseForType(type: string, language: AppLanguage): string {
  const zh = language === 'zh-Hant';
  switch (type.trim().toLowerCase()) {
    case 'direct-citation':
      return zh ? '直接引用' : 'directly cites';
    case 'allusion':
      return zh ? '暗引' : 'alludes to';
    case 'translation-interpretation':
      return zh ? '翻譯／詮釋' : 'translates/interprets';
    case 'inversion':
      return zh ? '反轉' : 'inverts';
    case 'parallel':
      return zh ? '平行共鳴' : 'resonates with';
    case 'inferred-sequence':
      return zh ? '先於' : 'precedes';
    case 'conceptual-development':
    default:
      return zh ? '概念演進至' : 'develops toward';
  }
}

function fallbackDescription(link: SimLink, language: AppLanguage): string {
  const source = endpointId(link.source);
  const target = endpointId(link.target);
  if (language === 'zh-Hant') {
    return `${source} 與 ${target} 之間呈現「${relationPhraseForType(link.type, language)}」關係。`;
  }
  return `${source} ${relationPhraseForType(link.type, language)} ${target}.`;
}

function effectiveDescription(link: SimLink, language: AppLanguage): string {
  const raw = link.description ?? '';
  if (isPlaceholderDescription(raw)) {
    return fallbackDescription(link, language);
  }
  return raw;
}

function hashColor(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 45%, 45%)`;
}

function lineDash(type: string): string | null {
  const normalized = type.toLowerCase();
  if (normalized.includes('translation')) {
    return '6 3';
  }
  if (normalized.includes('inversion') || normalized.includes('rupture')) {
    return '2 4';
  }
  if (normalized.includes('allusion') || normalized.includes('parallel')) {
    return '3 3';
  }
  if (normalized.includes('inferred')) {
    return '4 4';
  }
  return null;
}

function lineColor(type: string): string {
  const normalized = type.toLowerCase();
  if (normalized === 'direct-citation') {
    return '#0f766e';
  }
  if (normalized === 'allusion') {
    return '#0369a1';
  }
  if (normalized === 'conceptual-development') {
    return '#1f4f7a';
  }
  if (normalized === 'translation-interpretation') {
    return '#7c3aed';
  }
  if (normalized === 'inversion') {
    return '#be123c';
  }
  if (normalized === 'parallel') {
    return '#4d7c0f';
  }
  if (normalized === 'inferred-sequence') {
    return '#64748b';
  }
  return hashColor(type);
}

function truncateText(value: string, max = 44): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 3)}...`;
}

export function GraphView({
  language,
  nodes,
  links,
  selectedNodeId,
  selectedLinkId,
  showLinkLabels = true,
  showLinkDescriptions = false,
  onNodeSelect,
  onLinkSelect,
}: GraphViewProps) {
  const zh = language === 'zh-Hant';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const svgSelectionRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
  const fitToGraphRef = useRef<(() => void) | null>(null);
  const nodePositionRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const onNodeSelectRef = useRef(onNodeSelect);
  const onLinkSelectRef = useRef(onLinkSelect);
  const [size, setSize] = useState({ width: 900, height: 700 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const graphRenderSignature = useMemo(() => {
    const nodePart = nodes
      .map((node) => `${node.id}|${node.label}|${node.source}`)
      .sort()
      .join('~');
    const linkPart = links
      .map((link) => `${link.source}|${link.target}|${link.type}|${link.label}|${link.description}`)
      .sort()
      .join('~');
    return `${nodePart}__${linkPart}`;
  }, [links, nodes]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const { width, height } = entry.contentRect;
      setSize({ width: Math.max(width, 320), height: Math.max(height, 360) });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const selectedLinkKey = useMemo(() => selectedLinkId ?? '', [selectedLinkId]);

  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);

  useEffect(() => {
    onLinkSelectRef.current = onLinkSelect;
  }, [onLinkSelect]);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) {
      return;
    }

    const { width, height } = size;
    const svg = d3.select(svgRef.current);
    svgSelectionRef.current = svg;
    svg.selectAll('*').remove();
    setZoomLevel(1);

    const simNodes: SimNode[] = nodes.map((node) => {
      const cached = nodePositionRef.current.get(node.id);
      if (!cached) {
        return { ...node };
      }
      return { ...node, x: cached.x, y: cached.y };
    });
    const simLinks: SimLink[] = links.map((link) => ({ ...link }));
    const viewport = svg.append('g').attr('class', 'graph-viewport');

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(130)
          .strength(0.7),
      )
      .force('charge', d3.forceManyBody().strength(-280))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(46))
      .alphaDecay(0.08)
      .velocityDecay(0.42);

    const linkGroup = viewport.append('g').attr('stroke-linecap', 'round');
    const linkSelection = linkGroup
      .selectAll<SVGLineElement, SimLink>('line')
      .data(simLinks)
      .join('line')
      .attr('class', 'link-line')
      .attr('data-link-id', (d) =>
        resolvedLinkId({
          source: endpointId(d.source),
          target: endpointId(d.target),
          type: d.type,
        }),
      )
      .attr('stroke', (d) =>
        resolvedLinkId({
          source: endpointId(d.source),
          target: endpointId(d.target),
          type: d.type,
        }) === selectedLinkKey
          ? '#a855f7'
          : lineColor(d.type),
      )
      .attr('stroke-opacity', 0.7)
      .attr('stroke-width', (d) =>
        resolvedLinkId({
          source: endpointId(d.source),
          target: endpointId(d.target),
          type: d.type,
        }) === selectedLinkKey
          ? 3.2
          : 1.7,
      )
      .attr('stroke-dasharray', (d) => lineDash(d.type))
      .style('cursor', 'pointer')
      .on('click', (_, d) => {
        onLinkSelectRef.current({
          source: endpointId(d.source),
          target: endpointId(d.target),
          type: d.type,
          label: d.label,
          description: d.description,
          scholarlyDebate: d.scholarlyDebate,
        });
      });

    const linkLabelSelection = showLinkLabels
      ? viewport
          .append('g')
          .selectAll<SVGTextElement, SimLink>('text')
          .data(simLinks)
          .join('text')
          .text((d) => lineTypeLabel(d.type, language))
          .attr('font-size', links.length > 18 ? '9px' : '10px')
          .attr('font-family', 'Georgia, serif')
          .attr('text-anchor', 'middle')
          .attr('fill', '#94a3b8')
          .attr('fill-opacity', 0.75)
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 2)
          .attr('paint-order', 'stroke')
          .attr('pointer-events', 'none')
      : null;

    const linkDescriptionSelection = showLinkDescriptions
      ? viewport
          .append('g')
          .selectAll<SVGTextElement, SimLink>('text')
          .data(simLinks)
          .join('text')
          .text((d) => truncateText(effectiveDescription(d, language)))
          .attr('font-size', links.length > 18 ? '8px' : '9px')
          .attr('font-family', 'Georgia, serif')
          .attr('text-anchor', 'middle')
          .attr('fill', '#cbd5e1')
          .attr('fill-opacity', 0.9)
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 2)
          .attr('paint-order', 'stroke')
          .attr('pointer-events', 'none')
      : null;

    const nodeGroup = viewport
      .append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(simNodes)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', (_, d) => onNodeSelectRef.current(d));

    nodeGroup
      .append('circle')
      .attr('class', 'node-dot')
      .attr('data-node-id', (d) => d.id)
      .attr('r', (d) => (d.id === selectedNodeId ? 25 : 21))
      .attr('fill', (d) => sourceColor[d.source])
      .attr('stroke', (d) => (d.id === selectedNodeId ? '#111827' : '#f8fafc'))
      .attr('stroke-width', (d) => (d.id === selectedNodeId ? 3 : 1.6));

    nodeGroup
      .append('text')
      .text((d) => d.label)
      .attr('x', 0)
      .attr('y', 34)
      .attr('text-anchor', 'middle')
      .attr('fill', '#1f2937')
      .attr('font-size', '11px')
      .attr('font-family', 'Georgia, serif');

    const drag = d3
      .drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) {
          simulation.alphaTarget(0.3).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) {
          simulation.alphaTarget(0);
        }
        d.fx = null;
        d.fy = null;
      });

    nodeGroup.call(drag);

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 4.5])
      .on('zoom', (event) => {
        viewport.attr('transform', event.transform.toString());
        setZoomLevel(event.transform.k);
      });

    zoomBehaviorRef.current = zoomBehavior;
    svg.call(zoomBehavior).on('dblclick.zoom', null);

    const fitToGraph = () => {
      if (!svgRef.current || !zoomBehaviorRef.current) {
        return;
      }
      const bounds = (viewport.node() as SVGGElement | null)?.getBBox();
      if (!bounds || bounds.width === 0 || bounds.height === 0) {
        return;
      }
      const pad = 56;
      const scale = Math.min(
        (width - pad * 2) / bounds.width,
        (height - pad * 2) / bounds.height,
        2.2,
      );
      const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
      const translateX = width / 2 - safeScale * (bounds.x + bounds.width / 2);
      const translateY = height / 2 - safeScale * (bounds.y + bounds.height / 2);
      const transform = d3.zoomIdentity.translate(translateX, translateY).scale(safeScale);
      svg
        .transition()
        .duration(280)
        .call(zoomBehaviorRef.current.transform, transform);
    };

    fitToGraphRef.current = fitToGraph;

    simulation.on('tick', () => {
      linkSelection
        .attr('x1', (d) => endpointCoord(d.source, 'x'))
        .attr('y1', (d) => endpointCoord(d.source, 'y'))
        .attr('x2', (d) => endpointCoord(d.target, 'x'))
        .attr('y2', (d) => endpointCoord(d.target, 'y'));

      if (linkLabelSelection) {
        linkLabelSelection
          .attr('x', (d) => (endpointCoord(d.source, 'x') + endpointCoord(d.target, 'x')) / 2)
          .attr('y', (d) => (endpointCoord(d.source, 'y') + endpointCoord(d.target, 'y')) / 2 - 4);
      }

      if (linkDescriptionSelection) {
        linkDescriptionSelection
          .attr('x', (d) => (endpointCoord(d.source, 'x') + endpointCoord(d.target, 'x')) / 2)
          .attr('y', (d) => (endpointCoord(d.source, 'y') + endpointCoord(d.target, 'y')) / 2 + 10);
      }

      nodeGroup.attr('transform', (d) => `translate(${d.x ?? 0}, ${d.y ?? 0})`);

      for (const simNode of simNodes) {
        if (Number.isFinite(simNode.x) && Number.isFinite(simNode.y)) {
          nodePositionRef.current.set(simNode.id, {
            x: simNode.x as number,
            y: simNode.y as number,
          });
        }
      }
    });

    const fitTimer = window.setTimeout(() => {
      fitToGraph();
    }, 320);

    return () => {
      window.clearTimeout(fitTimer);
      simulation.stop();
      fitToGraphRef.current = null;
    };
  }, [graphRenderSignature, language, showLinkDescriptions, showLinkLabels, size]);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg
      .selectAll<SVGCircleElement, unknown>('circle.node-dot')
      .attr('r', function () {
        const id = this.getAttribute('data-node-id') ?? '';
        return id === selectedNodeId ? 25 : 21;
      })
      .attr('stroke', function () {
        const id = this.getAttribute('data-node-id') ?? '';
        return id === selectedNodeId ? '#111827' : '#f8fafc';
      })
      .attr('stroke-width', function () {
        const id = this.getAttribute('data-node-id') ?? '';
        return id === selectedNodeId ? 3 : 1.6;
      });

    svg
      .selectAll<SVGLineElement, unknown>('line.link-line')
      .attr('stroke', function () {
        const id = this.getAttribute('data-link-id') ?? '';
        const type = id.split('::')[2] ?? 'conceptual-development';
        return id === selectedLinkKey ? '#a855f7' : lineColor(type);
      })
      .attr('stroke-width', function () {
        const id = this.getAttribute('data-link-id') ?? '';
        return id === selectedLinkKey ? 3.2 : 1.7;
      });
  }, [selectedLinkKey, selectedNodeId]);

  const zoomBy = (factor: number) => {
    if (!svgSelectionRef.current || !zoomBehaviorRef.current) {
      return;
    }
    svgSelectionRef.current
      .transition()
      .duration(180)
      .call(zoomBehaviorRef.current.scaleBy, factor);
  };

  const resetCenter = () => {
    if (!svgSelectionRef.current || !zoomBehaviorRef.current) {
      return;
    }
    svgSelectionRef.current
      .transition()
      .duration(220)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
  };

  return (
    <div ref={containerRef} className="relative h-full w-full rounded-2xl border border-amber-200 bg-white/80">
      <svg ref={svgRef} width={size.width} height={size.height} className="h-full w-full" />

      <div className="absolute right-3 top-3 flex flex-col gap-2">
        <button
          onClick={() => zoomBy(1.2)}
          className="rounded-lg border border-slate-200 bg-white/90 p-2 text-slate-700 shadow-sm hover:bg-white"
          aria-label={zh ? '放大' : 'Zoom in'}
          title={zh ? '放大' : 'Zoom in'}
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={() => zoomBy(1 / 1.2)}
          className="rounded-lg border border-slate-200 bg-white/90 p-2 text-slate-700 shadow-sm hover:bg-white"
          aria-label={zh ? '縮小' : 'Zoom out'}
          title={zh ? '縮小' : 'Zoom out'}
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={resetCenter}
          className="rounded-lg border border-slate-200 bg-white/90 p-2 text-slate-700 shadow-sm hover:bg-white"
          aria-label={zh ? '置中' : 'Center'}
          title={zh ? '置中' : 'Center'}
        >
          <LocateFixed className="h-4 w-4" />
        </button>
        <button
          onClick={() => fitToGraphRef.current?.()}
          className="rounded-lg border border-slate-200 bg-white/90 p-2 text-slate-700 shadow-sm hover:bg-white"
          aria-label={zh ? '符合視窗' : 'Fit graph'}
          title={zh ? '符合視窗' : 'Fit graph'}
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <div className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
          <Search className="mr-1 h-3 w-3" />
          {zh ? '縮放' : ''} {zoomLevel.toFixed(2)}x
        </div>
      </div>
    </div>
  );
}
