import {
  CartesianGrid,
  type TooltipProps,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { AppLanguage, Node } from '../types';
import { sourceLabel } from '../lib/i18n';

interface TimelineViewProps {
  language: AppLanguage;
  nodes: Node[];
  selectedNodeId?: string;
  onNodeSelect: (node: Node) => void;
}

interface TimelinePoint {
  id: string;
  node: Node;
  source: Node['source'];
  type: Node['type'];
  traditionLabel?: string;
  label: string;
  shortLabel: string;
  x: number;
  y: number;
  z: number;
  anchor: string;
}

const SOURCE_COLORS: Record<Node['source'], string> = {
  ANE: '#7c3f2a',
  OT: '#9f5f25',
  STP: '#6a7b3f',
  NT: '#1f4f7a',
  Hellenistic: '#59407a',
  Manuscript: '#78716c',
};

const SOURCE_LANES: Record<Node['source'], number> = {
  Manuscript: 1,
  NT: 2,
  Hellenistic: 3,
  STP: 4,
  OT: 5,
  ANE: 6,
};

const SOURCE_FALLBACK_YEAR: Record<Node['source'], number> = {
  ANE: -1200,
  OT: -700,
  STP: -150,
  NT: 60,
  Hellenistic: -250,
  Manuscript: 200,
};

const BOOK_YEAR: Record<string, number> = {
  genesis: -900,
  exodus: -700,
  numbers: -700,
  deuteronomy: -650,
  psalms: -500,
  isaiah: -700,
  jeremiah: -600,
  ezekiel: -590,
  daniel: -165,
  zechariah: -500,
  malachi: -430,
  matthew: 80,
  mark: 70,
  luke: 85,
  john: 95,
  acts: 90,
  romans: 57,
  '1corinthians': 54,
  '2corinthians': 56,
  galatians: 49,
  philippians: 61,
  colossians: 60,
  ephesians: 62,
  '1thessalonians': 50,
  '2thessalonians': 51,
  '1timothy': 63,
  '2timothy': 66,
  titus: 63,
  philemon: 61,
  hebrews: 70,
  james: 60,
  '1peter': 63,
  '2peter': 80,
  '1john': 95,
  '2john': 95,
  '3john': 95,
  jude: 75,
  revelation: 96,
  wisdomofsolomon: -30,
  sirach: -180,
  '1enoch': -150,
  '2enoch': 40,
  jubilees: -150,
  '4ezra': 95,
  '2baruch': 90,
  '1maccabees': -100,
  '2maccabees': -80,
};

const BOOK_ALIASES: Record<string, string> = {
  gen: 'genesis',
  exod: 'exodus',
  num: 'numbers',
  deut: 'deuteronomy',
  ps: 'psalms',
  psa: 'psalms',
  isa: 'isaiah',
  jer: 'jeremiah',
  ezek: 'ezekiel',
  dan: 'daniel',
  zech: 'zechariah',
  mal: 'malachi',
  matt: 'matthew',
  mark: 'mark',
  luke: 'luke',
  john: 'john',
  acts: 'acts',
  rom: 'romans',
  romans: 'romans',
  '1cor': '1corinthians',
  '2cor': '2corinthians',
  gal: 'galatians',
  phil: 'philippians',
  col: 'colossians',
  eph: 'ephesians',
  '1thess': '1thessalonians',
  '2thess': '2thessalonians',
  '1tim': '1timothy',
  '2tim': '2timothy',
  tit: 'titus',
  phlm: 'philemon',
  heb: 'hebrews',
  jas: 'james',
  james: 'james',
  '1pet': '1peter',
  '2pet': '2peter',
  '1jn': '1john',
  '2jn': '2john',
  '3jn': '3john',
  jude: 'jude',
  rev: 'revelation',
  wis: 'wisdomofsolomon',
  wisdom: 'wisdomofsolomon',
  wisdomofsolomon: 'wisdomofsolomon',
  sir: 'sirach',
  sirach: 'sirach',
  ecclesiasticus: 'sirach',
  '1en': '1enoch',
  '1enoch': '1enoch',
  '2en': '2enoch',
  '2enoch': '2enoch',
  jub: 'jubilees',
  jubilees: 'jubilees',
  '4ezr': '4ezra',
  '4ezra': '4ezra',
  '2bar': '2baruch',
  '2baruch': '2baruch',
  '1macc': '1maccabees',
  '2macc': '2maccabees',
};

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function shortLabel(label: string): string {
  const compact = normalizeSpaces(label);
  if (compact.length <= 32) {
    return compact;
  }
  return `${compact.slice(0, 29)}...`;
}

function formatYear(year: number): string {
  if (year < 0) {
    return `${Math.abs(Math.round(year))} BCE`;
  }
  return `${Math.round(year)} CE`;
}

function normalizeBookToken(raw: string): string | null {
  const compact = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!compact) {
    return null;
  }
  return BOOK_ALIASES[compact] ?? compact;
}

function inferYearFromCitation(citation: string): { year: number; anchor: string } | null {
  const normalized = normalizeSpaces(citation);

  const scriptureMatch = normalized
    .replace(/\b(?:LXX|MT|HB|GNT|NA28|UBS5)\b/gi, '')
    .trim()
    .match(/^([1-3]?\s*[A-Za-z. ]+)\s+\d+(?::\d+(?:-\d+)?)?$/);
  if (scriptureMatch) {
    const token = normalizeBookToken(scriptureMatch[1] ?? '');
    const year = token ? BOOK_YEAR[token] : undefined;
    if (typeof year === 'number') {
      return { year, anchor: `Inferred from citation: ${normalized}` };
    }
  }

  if (/\b(?:Josephus|Antiquities|War)\b/i.test(normalized)) {
    return { year: 90, anchor: `Inferred from citation: ${normalized}` };
  }
  if (/\bPhilo\b/i.test(normalized)) {
    return { year: 30, anchor: `Inferred from citation: ${normalized}` };
  }
  if (/\b(?:1\s*En(?:och)?\.?|Jub(?:ilees)?\.?)\b/i.test(normalized)) {
    return { year: -150, anchor: `Inferred from citation: ${normalized}` };
  }
  if (/\bSir(?:ach)?\.?/i.test(normalized)) {
    return { year: -180, anchor: `Inferred from citation: ${normalized}` };
  }
  if (/\bWis(?:dom)?(?:\s+of\s+Solomon)?\.?/i.test(normalized)) {
    return { year: -30, anchor: `Inferred from citation: ${normalized}` };
  }
  if (/\b(?:DSS|[1-9]\d?Q[A-Za-z0-9-]+)\b/i.test(normalized)) {
    return { year: -100, anchor: `Inferred from citation: ${normalized}` };
  }
  if (
    /\b(?:Enuma Elish|Atrahasis|Gilgamesh|KTU|CAT\s+\d|Ugarit|Ugaritic|Pyramid Texts?|Coffin Texts?|Avesta|Yasna|Vendidad)\b/i.test(
      normalized,
    )
  ) {
    return { year: -1200, anchor: `Inferred from citation: ${normalized}` };
  }

  return null;
}

function estimateYear(node: Node): { year: number; anchor: string } {
  for (const citation of node.citations ?? []) {
    const inferred = inferYearFromCitation(citation);
    if (inferred) {
      return inferred;
    }
  }

  return {
    year: SOURCE_FALLBACK_YEAR[node.source],
    anchor: `Fallback by source lane: ${node.source}`,
  };
}

function buildYearTicks(minYear: number, maxYear: number): number[] {
  const span = maxYear - minYear;
  const step = span > 1200 ? 200 : span > 700 ? 100 : span > 350 ? 50 : 25;
  const start = Math.floor(minYear / step) * step;
  const end = Math.ceil(maxYear / step) * step;
  const ticks: number[] = [];
  for (let year = start; year <= end; year += step) {
    ticks.push(year);
  }
  return ticks;
}

function laneLabel(value: number, language: AppLanguage): string {
  const zh = language === 'zh-Hant';
  const map: Record<number, string> = {
    1: zh ? '手稿' : 'Manuscript',
    2: zh ? '新約' : 'NT',
    3: zh ? '希臘化' : 'Hellenistic',
    4: zh ? '第二聖殿' : 'STP',
    5: zh ? '舊約' : 'OT',
    6: zh ? '古近東' : 'ANE',
  };
  return map[Math.round(value)] ?? '';
}

function TimelineTooltip({
  active,
  payload,
  language,
}: TooltipProps<number, string> & { language: AppLanguage }) {
  if (!active || !payload?.length) {
    return null;
  }
  const zh = language === 'zh-Hant';

  const point = payload[0]?.payload as TimelinePoint;
  if (!point) {
    return null;
  }

  return (
    <div className="max-w-[300px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-slate-900">{point.label}</p>
      <p className="text-slate-600">
        {sourceLabel(point.source, language)} • {point.type}
      </p>
      {point.traditionLabel ? (
        <p className="text-slate-600">{zh ? '傳統：' : 'Tradition: '} {point.traditionLabel}</p>
      ) : null}
      <p className="text-slate-700">{zh ? '推定年代：' : 'Estimated date: '} {formatYear(point.x)}</p>
      <p className="text-slate-500">{point.anchor}</p>
    </div>
  );
}

export function TimelineView({ language, nodes, selectedNodeId, onNodeSelect }: TimelineViewProps) {
  const zh = language === 'zh-Hant';
  const laneSlotCount = new Map<string, number>();

  const points: TimelinePoint[] = nodes
    .map((node) => {
      const estimate = estimateYear(node);
      return {
        node,
        id: node.id,
        source: node.source,
        type: node.type,
        traditionLabel: node.tradition?.label,
        label: node.label,
        shortLabel: shortLabel(node.label),
        x: estimate.year,
        y: SOURCE_LANES[node.source],
        z: node.id === selectedNodeId ? 360 : 180,
        anchor: estimate.anchor,
      };
    })
    .sort((a, b) => a.x - b.x || a.y - b.y)
    .map((entry) => {
      const laneKey = `${entry.y}:${Math.round(entry.x / 25)}`;
      const slot = laneSlotCount.get(laneKey) ?? 0;
      laneSlotCount.set(laneKey, slot + 1);

      const jitter = ((slot % 5) - 2) * 0.12;
      const xJitter = ((Math.floor(slot / 5) % 3) - 1) * 4;
      return {
        ...entry,
        x: entry.x + xJitter,
        y: entry.y + jitter,
      };
    });

  const years = points.map((point) => point.x);
  const minYear = years.length > 0 ? Math.min(...years) - 40 : -800;
  const maxYear = years.length > 0 ? Math.max(...years) + 40 : 120;
  const ticks = buildYearTicks(minYear, maxYear);

  const perSource = (source: Node['source']) => points.filter((point) => point.source === source);
  const sourceOrder: Node['source'][] = ['ANE', 'OT', 'STP', 'Hellenistic', 'NT', 'Manuscript'];

  return (
    <div className="flex h-full w-full flex-col rounded-2xl border border-amber-200 bg-white/80 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {sourceOrder.map((source) => (
          <span
            key={`timeline-${source}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] text-slate-700"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SOURCE_COLORS[source] }} />
            {sourceLabel(source, language)} ({perSource(source).length})
          </span>
        ))}
      </div>
      <p className="mb-2 text-[11px] text-slate-500">
        {zh
          ? '年代優先依引文推定；若無引文則使用來源時代預設值。點擊節點可開啟詳細檔案。'
          : 'Chronology is citation-inferred when possible; otherwise source-era defaults are used. Click a point to open its dossier.'}
      </p>

      <div className="min-h-0 flex-1 grid-cols-1 gap-2 lg:grid lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-h-[220px] lg:min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 18, right: 24, bottom: 24, left: 12 }}>
              <ReferenceArea x1={-1200} x2={-540} y1={0.5} y2={6.5} fill="#fee2e2" fillOpacity={0.11} />
              <ReferenceArea x1={-539} x2={70} y1={0.5} y2={6.5} fill="#fef3c7" fillOpacity={0.16} />
              <ReferenceArea x1={-330} x2={70} y1={0.5} y2={6.5} fill="#e0f2fe" fillOpacity={0.12} />
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
              <XAxis
                type="number"
                dataKey="x"
                domain={[minYear, maxYear]}
                ticks={ticks}
                tickFormatter={formatYear}
                tick={{ fill: '#334155', fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={[0.5, 6.5]}
                ticks={[1, 2, 3, 4, 5, 6]}
                tickFormatter={(value) => laneLabel(value, language)}
                tick={{ fill: '#334155', fontSize: 11 }}
                width={92}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3', stroke: '#64748b' }}
                content={<TimelineTooltip language={language} />}
              />

              {sourceOrder.map((source) => (
                <Scatter
                  key={`lane-${source}`}
                  data={perSource(source)}
                  fill={SOURCE_COLORS[source]}
                  onClick={(point) => {
                    const payload = point?.payload as TimelinePoint | undefined;
                    if (payload?.node) {
                      onNodeSelect(payload.node);
                    }
                  }}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="min-h-[160px] overflow-y-auto rounded-xl border border-amber-200 bg-white/70 p-2">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
            {zh ? '時間線索引' : 'Timeline Index'}
          </p>
          <p className="mb-2 text-[11px] text-slate-500">
            {zh ? '若圖中節點過密，可改用此清單。' : 'Use this list if points are dense in the chart.'}
          </p>
          <ul className="space-y-1.5">
            {points.map((point) => (
              <li key={`timeline-index-${point.id}`}>
                <button
                  onClick={() => onNodeSelect(point.node)}
                  className={`w-full rounded border px-2 py-1 text-left text-xs ${
                    point.id === selectedNodeId
                      ? 'border-deepSea bg-deepSea/10 text-slate-900'
                      : 'border-amber-200 bg-white text-slate-700 hover:bg-amber-50'
                  }`}
                >
                  <p className="font-semibold">{point.shortLabel}</p>
                  <p className="text-[11px] text-slate-500">
                    {formatYear(point.x)} • {sourceLabel(point.source, language)}
                  </p>
                  {point.traditionLabel ? (
                    <p className="text-[11px] text-slate-500">
                      {zh ? '傳統：' : 'Tradition: '}
                      {point.traditionLabel}
                    </p>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
