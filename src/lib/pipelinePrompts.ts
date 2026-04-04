import type {
  CounterfactualScenarioId,
  Link,
  Node,
  ResearchMethodologyProfile,
} from '../types';

const sharedRules = `
You are TheosGenealogia, a doctoral-level biblical philologist.
Use historically grounded claims only.
Never invent fake citations.
Return valid JSON only.
Prefer SBL-style reference formatting.
Prioritize lexical precision over theological generalization.
Explicitly preserve ambiguity where scholarly consensus is unsettled.
Strict temporal scope: Hebrew Bible through Second Temple/Maccabean/Hellenistic contexts up to the destruction of the Second Temple (70 CE).
Do not import post-70 CE theological systems unless explicitly requested.
Do not collapse independent traditions into synthetic unity.
`;

function compactGraph(graph: { nodes: Node[]; links: Link[] }): string {
  return JSON.stringify(
    {
      nodes: graph.nodes.map((node) => ({
        id: node.id,
        label: node.label,
        type: node.type,
        source: node.source,
        tradition: node.tradition,
        citations: node.citations,
      })),
      links: graph.links.map((link) => ({
        source: link.source,
        target: link.target,
        type: link.type,
        label: link.label,
      })),
    },
    null,
    2,
  );
}

function verifiedCitationsPool(graph: { nodes: Node[]; links: Link[] }): string {
  const unique = Array.from(
    new Set(
      graph.nodes
        .flatMap((node) => node.citations ?? [])
        .map((citation) => citation.trim())
        .filter(Boolean),
    ),
  );

  if (unique.length === 0) {
    return '- No verified citation available';
  }

  return unique.map((citation) => `- ${citation}`).join('\n');
}

function verifiedReferenceTags(graph: { nodes: Node[]; links: Link[] }): string {
  const unique = Array.from(
    new Set(
      graph.nodes
        .flatMap((node) => node.citations ?? [])
        .map((citation) => citation.trim())
        .filter(Boolean),
    ),
  );

  if (unique.length === 0) {
    return '[R0] No verified citation available';
  }

  return unique.map((citation, index) => `[R${index + 1}] ${citation}`).join('\n');
}

function methodologyContext(profile: ResearchMethodologyProfile): string {
  return `
Methodological profile (user-selected):
- Hermeneutic frameworks: ${profile.hermeneuticFrameworks.join(', ') || 'None selected'}
- Canonical assumption: ${profile.canonicalAssumption}
- Language philosophy: ${profile.languagePhilosophy}

Instruction:
- Respect this profile while preserving counter-evidence and unresolved tensions.
- If profile and data conflict, keep data-grounded claims and explicitly mark tension.
`;
}

function counterfactualScenarioDescription(scenario: CounterfactualScenarioId): string {
  if (scenario === 'matthew-hebrew-not-lxx') {
    return 'If Matthew had used direct Hebrew textual tradition instead of the LXX.';
  }
  if (scenario === 'second-temple-not-destroyed') {
    return 'If the Second Temple had not been destroyed in 70 CE.';
  }
  return 'If Philo had circulated broadly in first-century Jesus-movement communities.';
}

export function phase1Prompt(query: string, profile: ResearchMethodologyProfile): string {
  return phase1PromptWithContext(query, profile);
}

function externalCorpusSection(externalContext?: string): string {
  if (!externalContext?.trim()) {
    return '';
  }
  return `
Authorized External Corpus Context (NotebookLM Sync):
${externalContext}

Use this external corpus context as additional evidence only when it is consistent with primary textual witnesses and the strict temporal boundary.
`;
}

export function phase1PromptWithContext(
  query: string,
  profile: ResearchMethodologyProfile,
  externalContext?: string,
): string {
  return `
${sharedRules}
${methodologyContext(profile)}
${externalCorpusSection(externalContext)}

Phase 1: Structural Mapping
Research query: ${query}

Task:
- Produce 12-16 nodes and 16-24 links tracing concept genealogy across OT, STP, NT, Hellenistic, and Manuscript evidence.
- Keep output compact: basic fields only.
- Use source strictly as one of: OT, STP, NT, Hellenistic, Manuscript.
- Required source balance:
  - OT >= 2 nodes
  - NT >= 2 nodes
  - STP >= 2 nodes
  - Include Hellenistic and Manuscript nodes when historically relevant (at least 1 each if relevant).
- Classification examples:
  - Mark 8:29 => NT
  - Isaiah 53 (MT/LXX) => OT
  - Josephus, Antiquities / Philo => Hellenistic
  - DSS/codices/papyri witnesses => Manuscript
- Ensure structural coverage of:
  1) MT/LXX lexical roots
  2) Second Temple and Maccabean corpora (DSS, Pseudepigrapha, 1-2 Maccabees, Philo, Josephus where relevant)
  3) NT reframing
  4) Hellenistic conceptual pressure points
  5) Manuscript-critical witnesses
- Preserve independent parallel traditions when evidence indicates multiple lineages; do not force a single continuous chain.
- Disconnected or weakly connected subgraphs are allowed when historically appropriate.
- Assign a tradition tag to each node when possible:
  - tradition.id (stable slug),
  - tradition.label (human-readable stream),
  - tradition.independence ("independent" | "convergent" | "contested" | "uncertain").
- Use cross-tradition links only when evidence of convergence, reuse, or contestation is explicit.
- If multiple traditions remain genuinely independent, keep them disconnected.
- Use link.type from this controlled vocabulary:
  - direct-citation
  - allusion
  - conceptual-development
  - translation-interpretation
  - inversion
  - parallel
- Add at least one rupture node if the concept undergoes a major semantic/syntactic shift.

Return this JSON shape:
{
  "nodes": Array<{
    "id": string,
    "type": "verse" | "concept" | "context" | "rupture" | "variant",
    "source": "OT" | "STP" | "NT" | "Hellenistic" | "Manuscript",
    "label": string,
    "content": string,
    "citations": string[],
    "tradition"?: {
      "id": string,
      "label": string,
      "independence"?: "independent" | "convergent" | "contested" | "uncertain",
      "notes"?: string
    }
  }>,
  "links": Link[]
}
`;
}

export function nodeEnrichmentPrompt(
  query: string,
  node: Node,
  graph: { nodes: Node[]; links: Link[] },
  profile: ResearchMethodologyProfile,
  externalContext?: string,
): string {
  return `
${sharedRules}
${methodologyContext(profile)}
${externalCorpusSection(externalContext)}

On-demand Node Enrichment
Research query: ${query}
Target node:
${JSON.stringify(node, null, 2)}
Graph context:
${compactGraph(graph)}

Task:
- Enrich ONLY the target node with deep linguistic and symptomatic analysis.
- Map Greek NT terms to LXX/MT roots.
- Explicitly model one-to-many and many-to-one Greek↔Hebrew mappings where relevant.
- Add Second Temple and Hellenistic lexical-conceptual parallels where relevant.
- Add manuscript variants if relevant to this node.
- Add rupture analysis if the node exhibits semantic replacement, syntactic/gender grammar shift, untranslatable loss, or historical silence.
- Add concise conceptual topography notes when the term drifts across time/power semantics.

Return JSON shape:
{
  "id": "${node.id}",
  "citations"?: string[],
  "linguisticAnalysis"?: {
    "greekTerm"?: string,
    "hebrewTerm"?: string,
    "lxxEquivalent"?: string,
    "morphology"?: string,
    "semanticShift"?: string,
    "genderGrammar"?: string,
    "untranslatable"?: string,
    "greekToHebrewMappings"?: Array<{
      "greekLemma": string,
      "hebrewLemmas": string[],
      "lxxExamples"?: string[],
      "mtExamples"?: string[],
      "notes"?: string
    }>,
    "secondTempleParallels"?: Array<{
      "corpus": "DSS" | "Pseudepigrapha" | "Philo" | "Josephus" | "Other",
      "reference": string,
      "concept": string,
      "notes"?: string
    }>,
    "hellenisticParallels"?: Array<{
      "author": string,
      "work"?: string,
      "greekTerm"?: string,
      "notes": string
    }>
  },
  "symptomaticAnalysis"?: {
    "surplus"?: string,
    "silence"?: string,
    "repetition"?: string,
    "fantasy"?: string
  },
  "manuscriptVariants"?: Array<{
    "manuscript": string,
    "reading": string,
    "significance": string
  }>,
  "ruptureAnalysis"?: {
    "semanticRuptures"?: Array<{
      "from": string,
      "to": string,
      "significance": string
    }>,
    "syntacticRuptures"?: Array<{
      "from": string,
      "to": string,
      "significance": string
    }>,
    "untranslatables"?: Array<{
      "term": string,
      "lossProfile": string,
      "implications"?: string
    }>,
    "historicalSilences"?: Array<{
      "missingReference": string,
      "hypothesis": string,
      "ideologicalFunction"?: string
    }>
  },
  "conceptualTopography"?: {
    "temporalAxis"?: string,
    "semanticAxis"?: string,
    "powerAxis"?: string,
    "cloudMovement"?: string
  }
}
`;
}

export function linkDebatePrompt(
  query: string,
  link: Link,
  graph: { nodes: Node[]; links: Link[] },
  profile: ResearchMethodologyProfile,
  externalContext?: string,
): string {
  return `
${sharedRules}
${methodologyContext(profile)}
${externalCorpusSection(externalContext)}

On-demand Link Debate Enrichment
Research query: ${query}
Target link:
${JSON.stringify(link, null, 2)}
Graph context:
${compactGraph(graph)}

Task:
- Enrich ONLY this link with scholarly debate.
- Provide at least 2 scholars with years, framework, critique.
- Focus on philological, Second Temple, apocalyptic, and conceptual-genealogy debate axes when relevant.
- Add explicit methodology tagging:
  - hermeneutic frameworks (multi-select),
  - canonical assumption,
  - language philosophy stance.
- Add a short stance matrix (stance/reading/key question).
- Add a parallax block with two irreconcilable readings and explicit rupture points.
- Ensure at least 2 readings are present in methodologyTagging.readings whenever possible.
- Add intertextuality significance metrics and p-value when inferable.
- Keep link.type within this controlled vocabulary whenever possible:
  direct-citation | allusion | conceptual-development | translation-interpretation | inversion | parallel.

Return JSON shape:
{
  "source": "${link.source}",
  "target": "${link.target}",
  "type": "${link.type}",
  "scholarlyDebate"?: Array<{
    "scholar": string,
    "position": string,
    "year": number,
    "framework": string,
    "critique": string
  }>,
  "methodologyTagging"?: {
    "hermeneuticFrameworks"?: Array<"Historical-Critical" | "Literary" | "Reader-Response">,
    "canonicalAssumption"?: "Traditional" | "Expanded Canon" | "Plural Canons" | "Non-Canonical",
    "languagePhilosophy"?: "Reference" | "Use" | "Differance" | "Event",
    "readings"?: Array<{
      "stance": string,
      "reading": string,
      "keyQuestion": string
    }>,
    "parallax"?: {
      "leftStance": string,
      "rightStance": string,
      "leftReading": string,
      "rightReading": string,
      "rupturePoints": Array<{
        "theme": string,
        "leftClaim": string,
        "rightClaim": string,
        "whyIrreconcilable": string
      }>,
      "sliderNote"?: string
    }
  },
  "intertextualityMetrics"?: {
    "lexicalOverlap"?: "low" | "medium" | "high",
    "syntacticSimilarity"?: "low" | "medium" | "high",
    "conceptualDistance"?: "low" | "medium" | "high",
    "contextualRarity"?: "low" | "medium" | "high",
    "pValue"?: string,
    "conclusion"?: string
  }
}
`;
}

export function summaryPrompt(
  query: string,
  graph: { nodes: Node[]; links: Link[] },
  profile: ResearchMethodologyProfile,
  externalContext?: string,
): string {
  return `
${sharedRules}
${methodologyContext(profile)}
${externalCorpusSection(externalContext)}

Phase 4: Synthesis & Summary (On-demand)
Research query: ${query}
Graph context:
${JSON.stringify(graph, null, 2)}

Verified citation pool (use only these citations):
${verifiedCitationsPool(graph)}

Task:
- Write an 800-1200 word academic essay in Markdown.
- The response MUST follow this structure exactly:
  1) # Research Dossier
  2) ## Abstract
  3) ## Genealogical Trajectory
  4) ## Philological Analysis
  5) ## Methodological Reflection
  6) ## Symptomatic Analysis
  7) ## Rupture and Untranslatable Diagnostics
  8) ## Conclusion
  9) ## Bibliography (Verified Sources Only)
- Use SBL citations throughout.
- Cite ONLY references present in the provided graph context citations arrays.
- If evidence is insufficient, explicitly state "No verified citation available" instead of inventing a reference.
- Include explicit treatment of lexical polyvalence and MT/LXX divergences.
- Include a short section-level synthesis of DSS/STP and Hellenistic comparative evidence.
- In the bibliography section, provide one bullet per reference.

Return JSON shape:
{
  "summary": "markdown essay here"
}
`;
}

export function counterfactualPrompt(
  query: string,
  graph: { nodes: Node[]; links: Link[] },
  scenario: CounterfactualScenarioId,
  profile: ResearchMethodologyProfile,
  externalContext?: string,
): string {
  return `
${sharedRules}
${methodologyContext(profile)}
${externalCorpusSection(externalContext)}

Phase 6: Counterfactual Lab
Research query: ${query}
Scenario: ${counterfactualScenarioDescription(scenario)}
Scenario id: ${scenario}

Graph context:
${compactGraph(graph)}

Task:
- Generate a rigorous counterfactual analysis grounded in philology, Second Temple evidence, and reception history.
- Keep uncertainty explicit; distinguish likely vs speculative outcomes.
- Include concrete textual pressure points.

Return JSON shape:
{
  "scenario": "${scenario}",
  "hypothesis": "short thesis sentence",
  "projectedShifts": string[],
  "theologicalConsequences": string[],
  "methodologicalReflection": "short paragraph",
  "citations": string[]
}
`;
}

export function publicationPrompt(
  query: string,
  graph: { nodes: Node[]; links: Link[] },
  profile: ResearchMethodologyProfile,
  externalContext?: string,
): string {
  return `
${sharedRules}
${methodologyContext(profile)}
${externalCorpusSection(externalContext)}

Phase 9: Living Publication Draft
Research query: ${query}
Graph context:
${compactGraph(graph)}

Verified citation pool:
${verifiedCitationsPool(graph)}

Verified reference tags (use only these tags inline):
${verifiedReferenceTags(graph)}

Task:
- Write a polished, scholar-facing publication draft (1200-1800 words) in Markdown.
- This is NOT a brief summary. It should read like a conference-ready or preprint-ready research dossier.
- Required structure:
  1) # Title
  2) ## Abstract
  3) ## Research Scope and Corpus Boundary (must explicitly mention boundary up to 70 CE)
  4) ## Genealogical Reconstruction
  5) ## Philological Dossiers
  6) ## Tradition Streams and Points of Discontinuity
  7) ## Intertextuality and Textual-Critical Assessment
  8) ## Methodological Risks and Limits
  9) ## Conclusion for Scholarly Discussion
  10) ## Bibliography (Verified Sources Only)
- Inline references must use ONLY [R#] tags from the verified reference tags list.
- Do not invent or paraphrase references outside verified tags.
- Avoid devotional language; keep analytical academic style.

Return JSON shape:
{
  "publicationMarkdown": "markdown draft here"
}
`;
}

export function verificationPrompt(fullResult: {
  nodes: Node[];
  links: Link[];
  summary: string;
}): string {
  return `
${sharedRules}

Phase 5: Verification
Input object:
${JSON.stringify(fullResult, null, 2)}

Task:
- Critically peer-review all references and citation integrity.
- If citations are reliable, return status = verified.
- If any need correction, return status = corrected and provide concrete citation fixes.
- Flag uncertain references explicitly in notes when confidence is limited.

Return JSON shape:
{
  "status": "verified" | "corrected",
  "notes"?: string[],
  "citationFixes"?: Array<{
    "nodeId"?: string,
    "linkId"?: string,
    "citations": string[],
    "rationale"?: string
  }>
}
`;
}
