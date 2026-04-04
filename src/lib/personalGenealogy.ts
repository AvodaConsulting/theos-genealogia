import type {
  PersonalAcademicGenealogyReport,
  ResearchNote,
  UserStance,
  UserStanceValue,
} from '../types';

function scoreStance(value: UserStanceValue): number {
  if (value === 'support') {
    return 1;
  }
  if (value === 'qualified') {
    return 0.4;
  }
  if (value === 'oppose') {
    return -1;
  }
  return 0;
}

function summarizeProfile(
  stanceCount: number,
  topFramework?: { framework: string; netAlignment: number },
  connectedArguments = 0,
): string {
  if (stanceCount === 0) {
    return 'No explicit stance profile yet. Tag support/oppose/qualified positions on debate entries to build your personal scholarly genealogy.';
  }

  if (!topFramework) {
    return `${stanceCount} stance decisions recorded with ${connectedArguments} linked argument notes.`;
  }

  const polarity =
    topFramework.netAlignment > 0.2
      ? 'positive alignment'
      : topFramework.netAlignment < -0.2
        ? 'critical distance'
        : 'mixed alignment';

  return `${stanceCount} stance decisions recorded. Strongest methodological signal: ${topFramework.framework} (${polarity}). Linked argument notes: ${connectedArguments}.`;
}

export function computePersonalAcademicGenealogy(
  userStances: UserStance[],
  notes: ResearchNote[],
): PersonalAcademicGenealogyReport {
  const frameworkMap = new Map<
    string,
    {
      framework: string;
      netAlignment: number;
      support: number;
      oppose: number;
      qualified: number;
      undecided: number;
    }
  >();
  const scholarMap = new Map<
    string,
    {
      scholar: string;
      support: number;
      oppose: number;
      qualified: number;
      undecided: number;
    }
  >();

  for (const stance of userStances) {
    if (!frameworkMap.has(stance.framework)) {
      frameworkMap.set(stance.framework, {
        framework: stance.framework,
        netAlignment: 0,
        support: 0,
        oppose: 0,
        qualified: 0,
        undecided: 0,
      });
    }
    if (!scholarMap.has(stance.scholar)) {
      scholarMap.set(stance.scholar, {
        scholar: stance.scholar,
        support: 0,
        oppose: 0,
        qualified: 0,
        undecided: 0,
      });
    }

    const frameworkEntry = frameworkMap.get(stance.framework) as {
      framework: string;
      netAlignment: number;
      support: number;
      oppose: number;
      qualified: number;
      undecided: number;
    };
    frameworkEntry.netAlignment += scoreStance(stance.stance);
    frameworkEntry[stance.stance] += 1;

    const scholarEntry = scholarMap.get(stance.scholar) as {
      scholar: string;
      support: number;
      oppose: number;
      qualified: number;
      undecided: number;
    };
    scholarEntry[stance.stance] += 1;
  }

  const alignedFrameworks = Array.from(frameworkMap.values()).sort(
    (a, b) => b.netAlignment - a.netAlignment || a.framework.localeCompare(b.framework),
  );
  const scholarDialogues = Array.from(scholarMap.values()).sort(
    (a, b) =>
      b.support + b.qualified - (b.oppose + b.undecided) - (a.support + a.qualified - (a.oppose + a.undecided)) ||
      a.scholar.localeCompare(b.scholar),
  );

  const connectedArguments = notes.filter(
    (note) => note.kind === 'argument' && note.targetType !== 'global',
  ).length;

  const faultLines: string[] = [];
  for (const entry of alignedFrameworks) {
    if (entry.support > 0 && entry.oppose > 0) {
      faultLines.push(
        `${entry.framework}: mixed support and opposition indicates unresolved methodological tension.`,
      );
    }
  }
  for (const entry of scholarDialogues) {
    if (entry.support > 0 && entry.oppose > 0) {
      faultLines.push(
        `${entry.scholar}: your profile both supports and contests this scholar across different links.`,
      );
    }
  }

  const topFramework = alignedFrameworks[0];

  return {
    generatedAt: new Date().toISOString(),
    profileSummary: summarizeProfile(userStances.length, topFramework, connectedArguments),
    stanceCount: userStances.length,
    connectedArguments,
    alignedFrameworks: alignedFrameworks.slice(0, 10),
    scholarDialogues: scholarDialogues.slice(0, 12),
    faultLines: faultLines.slice(0, 10),
  };
}

