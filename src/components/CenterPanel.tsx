import { BarChart3, Box, ChevronDown, ChevronRight, Eye, EyeOff, Loader2, Network } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';

import type { ConceptTopographyReport, Link, Node } from '../types';
import { cn } from '../lib/cn';
import { GraphView } from './GraphView';
import { Topography3DView } from './Topography3DView';
import { TimelineView } from './TimelineView';

interface CenterPanelProps {
  mode: 'graph' | 'timeline' | 'topography';
  onModeChange: (mode: 'graph' | 'timeline' | 'topography') => void;
  nodes: Node[];
  links: Link[];
  conceptTopographyReport: ConceptTopographyReport;
  loading?: boolean;
  selectedNodeId?: string;
  selectedLinkId?: string;
  onNodeSelect: (node: Node) => void;
  onLinkSelect: (link: Link) => void;
}

interface TraditionScope {
  id: string;
  label: string;
  nodeIds: Set<string>;
  nodeCount: number;
}

function normalizeTypeLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  const map: Record<string, string> = {
    'direct-citation': 'Direct Citation',
    allusion: 'Allusion',
    'conceptual-development': 'Conceptual Development',
    'translation-interpretation': 'Translation / Interpretation',
    inversion: 'Inversion',
    parallel: 'Parallel / Resonance',
    'inferred-sequence': 'Inferred Sequence',
  };
  if (map[normalized]) {
    return map[normalized];
  }
  const fallback = value.replace(/[_-]+/g, ' ').trim();
  if (!fallback) {
    return 'Conceptual Development';
  }
  return fallback
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function buildConnectedComponentScopes(nodes: Node[], links: Link[]): TraditionScope[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const adjacency = new Map<string, Set<string>>();
  for (const node of nodes) {
    adjacency.set(node.id, new Set());
  }
  for (const link of links) {
    if (!nodeIds.has(link.source) || !nodeIds.has(link.target)) {
      continue;
    }
    adjacency.get(link.source)?.add(link.target);
    adjacency.get(link.target)?.add(link.source);
  }

  const visited = new Set<string>();
  const scopes: TraditionScope[] = [];

  for (const node of nodes) {
    if (visited.has(node.id)) {
      continue;
    }

    const queue = [node.id];
    const component: string[] = [];
    visited.add(node.id);

    while (queue.length > 0) {
      const current = queue.shift() as string;
      component.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (visited.has(neighbor)) {
          continue;
        }
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }

    const componentSet = new Set(component);
    const sourceCounts = nodes
      .filter((entry) => componentSet.has(entry.id))
      .reduce<Record<string, number>>((acc, entry) => {
        acc[entry.source] = (acc[entry.source] ?? 0) + 1;
        return acc;
      }, {});

    const dominant = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Mixed';
    const root = component.slice().sort()[0] ?? `scope-${scopes.length + 1}`;
    scopes.push({
      id: `scope-${root}`,
      label: `${dominant} Tradition (${component.length} nodes)`,
      nodeIds: componentSet,
      nodeCount: component.length,
    });
  }

  return scopes.sort((a, b) => b.nodeCount - a.nodeCount || a.label.localeCompare(b.label));
}

function buildTaggedTraditionScopes(nodes: Node[]): TraditionScope[] {
  const grouped = new Map<string, { label: string; nodeIds: Set<string>; independence?: string }>();
  const unclassified = new Set<string>();

  for (const node of nodes) {
    const tag = node.tradition;
    if (!tag?.id || !tag.label) {
      unclassified.add(node.id);
      continue;
    }
    const existing = grouped.get(tag.id);
    if (existing) {
      existing.nodeIds.add(node.id);
      continue;
    }
    grouped.set(tag.id, {
      label: tag.label,
      nodeIds: new Set([node.id]),
      independence: tag.independence,
    });
  }

  if (grouped.size < 2) {
    return [];
  }

  const scopes: TraditionScope[] = Array.from(grouped.entries()).map(([id, entry]) => ({
    id: `tradition-${id}`,
    label: `${entry.label}${entry.independence ? ` (${entry.independence})` : ''} (${entry.nodeIds.size} nodes)`,
    nodeIds: entry.nodeIds,
    nodeCount: entry.nodeIds.size,
  }));

  if (unclassified.size > 0) {
    scopes.push({
      id: 'tradition-unclassified',
      label: `Unclassified (${unclassified.size} nodes)`,
      nodeIds: unclassified,
      nodeCount: unclassified.size,
    });
  }

  return scopes.sort((a, b) => b.nodeCount - a.nodeCount || a.label.localeCompare(b.label));
}

function buildTraditionScopes(nodes: Node[], links: Link[]): TraditionScope[] {
  const tagged = buildTaggedTraditionScopes(nodes);
  if (tagged.length > 0) {
    return tagged;
  }
  return buildConnectedComponentScopes(nodes, links);
}

export function CenterPanel({
  mode,
  onModeChange,
  nodes,
  links,
  conceptTopographyReport,
  loading = false,
  selectedNodeId,
  selectedLinkId,
  onNodeSelect,
  onLinkSelect,
}: CenterPanelProps) {
  const [scopeId, setScopeId] = useState<string>('all');
  const [activeLinkTypes, setActiveLinkTypes] = useState<string[]>([]);
  const [showLinkLabels, setShowLinkLabels] = useState(true);
  const [showLinkDescriptions, setShowLinkDescriptions] = useState(false);
  const [showTraditionControls, setShowTraditionControls] = useState(false);
  const [showLineControls, setShowLineControls] = useState(false);
  const sourceLegend = [
    { source: 'OT', color: '#9f5f25' },
    { source: 'STP', color: '#6a7b3f' },
    { source: 'NT', color: '#1f4f7a' },
    { source: 'Hellenistic', color: '#59407a' },
    { source: 'Manuscript', color: '#78716c' },
  ] as const;

  const traditionScopes = useMemo(() => buildTraditionScopes(nodes, links), [nodes, links]);

  useEffect(() => {
    if (scopeId === 'all') {
      return;
    }
    if (!traditionScopes.some((scope) => scope.id === scopeId)) {
      setScopeId('all');
    }
  }, [scopeId, traditionScopes]);

  const visibleNodes = useMemo(() => {
    if (scopeId === 'all') {
      return nodes;
    }
    const scope = traditionScopes.find((entry) => entry.id === scopeId);
    if (!scope) {
      return nodes;
    }
    return nodes.filter((node) => scope.nodeIds.has(node.id));
  }, [nodes, scopeId, traditionScopes]);

  const visibleNodeSet = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const scopedLinks = useMemo(
    () =>
      links.filter((link) => visibleNodeSet.has(link.source) && visibleNodeSet.has(link.target)),
    [links, visibleNodeSet],
  );

  const availableLinkTypes = useMemo(
    () => Array.from(new Set(scopedLinks.map((link) => link.type))).sort((a, b) => a.localeCompare(b)),
    [scopedLinks],
  );

  useEffect(() => {
    setActiveLinkTypes((prev) => prev.filter((type) => availableLinkTypes.includes(type)));
  }, [availableLinkTypes]);

  const activeLinkTypeSet = useMemo(() => new Set(activeLinkTypes), [activeLinkTypes]);
  const visibleLinks = useMemo(() => {
    if (activeLinkTypes.length === 0) {
      return scopedLinks;
    }
    return scopedLinks.filter((link) => activeLinkTypeSet.has(link.type));
  }, [activeLinkTypeSet, activeLinkTypes.length, scopedLinks]);

  const sourceCounts = visibleNodes.reduce<Record<string, number>>((acc, node) => {
    acc[node.source] = (acc[node.source] ?? 0) + 1;
    return acc;
  }, {});

  const linkTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const link of scopedLinks) {
      counts[link.type] = (counts[link.type] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [scopedLinks]);

  return (
    <section className="flex h-[56vh] w-full flex-col p-4 xl:h-screen xl:min-w-0 xl:flex-1 xl:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-olive">Research Space</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {visibleNodes.length}/{nodes.length} nodes • {visibleLinks.length}/{links.length} links
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-white/70 p-1">
          <button
            onClick={() => onModeChange('graph')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold',
              mode === 'graph' ? 'bg-deepSea text-white' : 'text-slate-600',
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <Network className="h-3.5 w-3.5" /> Graph
            </span>
          </button>
          <button
            onClick={() => onModeChange('timeline')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold',
              mode === 'timeline' ? 'bg-deepSea text-white' : 'text-slate-600',
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> Timeline
            </span>
          </button>
          <button
            onClick={() => onModeChange('topography')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold',
              mode === 'topography' ? 'bg-deepSea text-white' : 'text-slate-600',
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <Box className="h-3.5 w-3.5" /> 3D Map
            </span>
          </button>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        {sourceLegend.map((item) => (
          <span
            key={item.source}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white/80 px-2.5 py-1 text-xs text-slate-700"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.source} ({sourceCounts[item.source] ?? 0})
          </span>
        ))}
      </div>

      <div className="mb-2 rounded-xl border border-amber-200 bg-white/75 p-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowTraditionControls((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
          >
            {showTraditionControls ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Traditions & Scope
          </button>
          <button
            onClick={() => setShowLineControls((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
          >
            {showLineControls ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Line Semantics
          </button>
          <button
            onClick={() => setScopeId('all')}
            className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
          >
            Reset Scope
          </button>
          <button
            onClick={() => setActiveLinkTypes([])}
            className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
          >
            Reset Line Types
          </button>
        </div>

        {showTraditionControls ? (
          <div className="mt-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Traditions & Scope
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setScopeId('all')}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs font-semibold',
                  scopeId === 'all'
                    ? 'border-deepSea bg-deepSea text-white'
                    : 'border-amber-200 bg-white text-slate-700',
                )}
              >
                Show All Traditions
              </button>
              {traditionScopes.map((scope) => (
                <button
                  key={scope.id}
                  onClick={() => setScopeId(scope.id)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs font-semibold',
                    scopeId === scope.id
                      ? 'border-deepSea bg-deepSea text-white'
                      : 'border-amber-200 bg-white text-slate-700',
                  )}
                >
                  {scope.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {showLineControls ? (
          <div className="mt-2">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Line Semantics
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowLinkLabels((prev) => !prev)}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
                >
                  {showLinkLabels ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {showLinkLabels ? 'Hide Types' : 'Show Types'}
                </button>
                <button
                  onClick={() => setShowLinkDescriptions((prev) => !prev)}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
                >
                  {showLinkDescriptions ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {showLinkDescriptions ? 'Hide Descriptions' : 'Show Descriptions'}
                </button>
              </div>
            </div>
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setActiveLinkTypes([])}
                className={cn(
                  'rounded-md border px-2 py-1 text-[11px] font-semibold',
                  activeLinkTypes.length === 0
                    ? 'border-deepSea bg-deepSea text-white'
                    : 'border-amber-200 bg-white text-slate-700',
                )}
              >
                Show All Line Types
              </button>
              {linkTypeCounts.map(([type, count]) => {
                const selected = activeLinkTypeSet.has(type);
                return (
                  <button
                    key={`type-filter-${type}`}
                    onClick={() =>
                      setActiveLinkTypes((prev) =>
                        prev.includes(type) ? prev.filter((entry) => entry !== type) : [...prev, type],
                      )
                    }
                    className={cn(
                      'rounded-md border px-2 py-1 text-[11px] font-semibold',
                      selected
                        ? 'border-deepSea bg-deepSea text-white'
                        : 'border-amber-200 bg-white text-slate-700',
                    )}
                  >
                    {normalizeTypeLabel(type)} ({count})
                  </button>
                );
              })}
            </div>
            {linkTypeCounts.length === 0 ? (
              <span className="text-xs text-slate-500">No link types in current scope.</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="relative h-full min-h-0">
        <AnimatePresence mode="wait" initial={false}>
          {mode === 'graph' ? (
            <motion.div
              key="graph"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full min-h-0"
            >
              <GraphView
                nodes={visibleNodes}
                links={visibleLinks}
                selectedNodeId={selectedNodeId}
                selectedLinkId={selectedLinkId}
                showLinkLabels={showLinkLabels}
                showLinkDescriptions={showLinkDescriptions}
                onNodeSelect={onNodeSelect}
                onLinkSelect={onLinkSelect}
              />
            </motion.div>
          ) : mode === 'timeline' ? (
            <motion.div
              key="timeline"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full min-h-0"
            >
              <TimelineView
                nodes={visibleNodes}
                selectedNodeId={selectedNodeId}
                onNodeSelect={onNodeSelect}
              />
            </motion.div>
          ) : (
            <motion.div
              key="topography"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full min-h-0"
            >
              <Topography3DView
                report={{
                  ...conceptTopographyReport,
                  entries: conceptTopographyReport.entries.filter((entry) =>
                    visibleNodeSet.has(entry.nodeId),
                  ),
                }}
                nodes={visibleNodes}
                links={visibleLinks}
                selectedNodeId={selectedNodeId}
                onNodeSelect={onNodeSelect}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/65 backdrop-blur-[1px]">
            <p className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-deepSea" />
              Generating structural graph...
            </p>
          </div>
        ) : null}

        {!loading && visibleNodes.length === 0 ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl border border-dashed border-amber-300 bg-white/60">
            <p className="text-sm text-slate-600">Run a research trace to generate the graph.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
