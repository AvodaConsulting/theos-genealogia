import type { Node } from '../types';

type NodePatch = {
  id: string;
  citations?: string[];
  linguisticAnalysis?: Node['linguisticAnalysis'];
  symptomaticAnalysis?: Node['symptomaticAnalysis'];
  manuscriptVariants?: Node['manuscriptVariants'];
  ruptureAnalysis?: Node['ruptureAnalysis'];
  conceptualTopography?: Node['conceptualTopography'];
};

function hasSatanTheme(node: Node): boolean {
  const text = `${node.label} ${node.content} ${(node.citations ?? []).join(' ')}`.toLowerCase();
  return /\b(satan|adversary|accuser|devil|dragon|belial)\b/.test(text);
}

function buildSatanHeuristic(node: Node): NodePatch {
  return {
    id: node.id,
    citations: node.citations,
    linguisticAnalysis: {
      hebrewTerm: 'שָׂטָן (satan): adversary/accuser role-term',
      greekTerm: 'σατανᾶς (satanas); accusation lexicon also overlaps with διάβολος traditions',
      lxxEquivalent:
        'Earlier OT/LXX usage often preserves an adversarial function, not consistently a fixed proper-name opponent.',
      morphology:
        'Role-term usage in Hebrew Bible can be functional/contextual before later apocalyptic personalization.',
      semanticShift:
        'Trajectory from functional opposition (HB) toward personalized cosmic adversary in later apocalyptic reception.',
      untranslatable:
        'Hebrew adversarial role nuance can flatten when retro-read through later demonological categories.',
      secondTempleParallels: [
        {
          corpus: 'DSS',
          reference: 'Qumran dualistic materials',
          concept: 'Adversarial powers become systematized within light/darkness conflict logic.',
          notes: 'Heuristic baseline; verify exact witness texts in focused follow-up.',
        },
        {
          corpus: 'Pseudepigrapha',
          reference: 'Second Temple apocalyptic expansions',
          concept: 'Adversarial agency is increasingly personalized and cosmologized.',
          notes: 'Heuristic baseline; confirm corpus-specific references before publication.',
        },
      ],
    },
    symptomaticAnalysis: {
      surplus:
        'Narrative surplus appears when a role-term later accrues mythic density beyond immediate legal-narrative function.',
      silence:
        'Early strata often do not require a fully personalized evil counterpart, creating later hermeneutical pressure.',
      repetition:
        'Repetition of accusation/opposition motifs enables continuity while semantic center shifts across corpora.',
      fantasy:
        'Later reception can project a unified antagonist backward onto earlier role-based usages.',
    },
    ruptureAnalysis: {
      semanticRuptures: [
        {
          from: 'Functional adversary role in immediate narrative/legal context',
          to: 'Personalized trans-historical cosmic opponent',
          significance:
            'This is a conceptual escalation, not a simple lexical carryover.',
        },
      ],
      historicalSilences: [
        {
          missingReference: 'Fully developed cosmic-adversary profile in early Torah strata',
          hypothesis:
            'The role-term operates contextually before apocalyptic systematization becomes dominant.',
          ideologicalFunction:
            'Later demonological coherence may retroactively smooth earlier textual plurality.',
        },
      ],
    },
    conceptualTopography: {
      temporalAxis: 'HB functional usage -> STP apocalyptic intensification -> NT receptional consolidation.',
      semanticAxis: 'From situational opposition to personified adversarial ontology.',
      powerAxis: 'Shift from localized narrative function to macro-cosmic conflict framing.',
      cloudMovement: 'High drift expected across OT, STP, and NT witness layers.',
    },
  };
}

function buildGenericHeuristic(node: Node): NodePatch {
  return {
    id: node.id,
    citations: node.citations,
    linguisticAnalysis: {
      semanticShift:
        'Heuristic baseline: concept should be tested for role-to-ontology shift across HB, STP, and NT corpora.',
      morphology:
        'Heuristic baseline: inspect whether lexical form marks function, title, or ontological identity in each layer.',
    },
    symptomaticAnalysis: {
      surplus:
        'Heuristic baseline: track where later reception adds conceptual load absent in earlier strata.',
      silence:
        'Heuristic baseline: track what the tradition does not explicitly define at early stages.',
    },
    conceptualTopography: {
      temporalAxis: 'Baseline trajectory inferred from selected node and citation context.',
      semanticAxis: 'Monitor shifts in conceptual scope across corpora.',
      powerAxis: 'Monitor institutional framing and reception authority shifts.',
      cloudMovement: 'Moderate drift baseline; validate with focused philological enrichment.',
    },
  };
}

export function hasDeepNodePatch(
  patch:
    | {
        linguisticAnalysis?: Node['linguisticAnalysis'];
        symptomaticAnalysis?: Node['symptomaticAnalysis'];
        manuscriptVariants?: Node['manuscriptVariants'];
        ruptureAnalysis?: Node['ruptureAnalysis'];
        conceptualTopography?: Node['conceptualTopography'];
      }
    | null
    | undefined,
): boolean {
  if (!patch) {
    return false;
  }

  return Boolean(
    patch.linguisticAnalysis ||
      patch.symptomaticAnalysis ||
      patch.manuscriptVariants ||
      patch.ruptureAnalysis ||
      patch.conceptualTopography,
  );
}

export function buildHeuristicNodeEnrichment(node: Node): NodePatch {
  if (hasSatanTheme(node)) {
    return buildSatanHeuristic(node);
  }
  return buildGenericHeuristic(node);
}

