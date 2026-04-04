import type { Link, ScholarlyEcosystemReport } from '../types';

function linkKey(link: Pick<Link, 'source' | 'target' | 'type'>): string {
  return `${link.source}::${link.target}::${link.type}`;
}

export function buildScholarlyEcosystemReport(links: Link[]): ScholarlyEcosystemReport {
  const timeline: ScholarlyEcosystemReport['timeline'] = [];
  const frameworkCount = new Map<string, number>();
  const contested = new Map<string, { label: string; scholars: Set<string> }>();

  for (const link of links) {
    const debates = link.scholarlyDebate ?? [];
    if (debates.length === 0) {
      continue;
    }

    const key = linkKey(link);
    if (!contested.has(key)) {
      contested.set(key, { label: link.label, scholars: new Set() });
    }

    for (const debate of debates) {
      timeline.push({
        year: debate.year,
        scholar: debate.scholar,
        framework: debate.framework,
        linkLabel: link.label,
        position: debate.position,
      });
      frameworkCount.set(debate.framework, (frameworkCount.get(debate.framework) ?? 0) + 1);
      contested.get(key)?.scholars.add(debate.scholar);
    }
  }

  const frameworkClusters = Array.from(frameworkCount.entries())
    .map(([framework, count]) => ({ framework, count }))
    .sort((a, b) => b.count - a.count || a.framework.localeCompare(b.framework));

  const contestedLinks = Array.from(contested.entries())
    .map(([key, value]) => ({
      linkKey: key,
      linkLabel: value.label,
      scholarCount: value.scholars.size,
    }))
    .filter((entry) => entry.scholarCount >= 2)
    .sort((a, b) => b.scholarCount - a.scholarCount || a.linkLabel.localeCompare(b.linkLabel));

  return {
    generatedAt: new Date().toISOString(),
    timeline: timeline.sort((a, b) => a.year - b.year || a.scholar.localeCompare(b.scholar)),
    frameworkClusters,
    contestedLinks,
  };
}
