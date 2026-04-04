import type { ResearchResult, VerificationResult } from '../types';

export const mockResearchResult: ResearchResult = {
  nodes: [
    {
      id: 'ot-dabar',
      type: 'concept',
      source: 'OT',
      label: 'דָּבָר (Dabar)',
      content:
        'Hebrew concept of word-event as performative divine speech (Genesis 1; Isaiah 55).',
      citations: ['Gen 1:3', 'Isa 55:11'],
      linguisticAnalysis: {
        hebrewTerm: 'דָּבָר',
        lxxEquivalent: 'λόγος / ῥῆμα',
        semanticShift:
          'From covenantal speech-act in Hebrew narrative to more abstract conceptualization in Hellenistic Greek discourse.',
      },
      symptomaticAnalysis: {
        surplus:
          'Speech exceeds semantic proposition by materially structuring creation and covenant identity.',
      },
    },
    {
      id: 'lxx-logos',
      type: 'context',
      source: 'Manuscript',
      label: 'LXX Translational Mediation',
      content: 'Septuagint renders Hebrew speech-fields through logos/rhema distinctions.',
      citations: ['LXX Gen 1:3', 'LXX Ps 32:6'],
    },
    {
      id: 'stp-wisdom',
      type: 'concept',
      source: 'STP',
      label: 'Second Temple Wisdom Traditions',
      content:
        'Wisdom of Solomon and Philo align divine speech, wisdom, and mediatorial cosmology.',
      citations: ['Wis 9:1-2', 'Philo, De Opificio Mundi'],
    },
    {
      id: 'hellenistic-logos',
      type: 'context',
      source: 'Hellenistic',
      label: 'Hellenistic Logos Discourse',
      content: 'Stoic and Middle Platonic logos frames order, reason, and mediation.',
      citations: ['Diogenes Laertius 7.134'],
    },
    {
      id: 'nt-john-prologue',
      type: 'verse',
      source: 'NT',
      label: 'John 1:1-18',
      content:
        'Johannine Prologue reconfigures logos into christological revelation and incarnation.',
      citations: ['John 1:1', 'John 1:14'],
    },
    {
      id: 'nt-hebrews',
      type: 'context',
      source: 'NT',
      label: 'Hebrews 1:1-3',
      content: 'God speaks in Son-language, linking speech and ontological representation.',
      citations: ['Heb 1:1-3'],
    },
  ],
  links: [
    {
      source: 'ot-dabar',
      target: 'lxx-logos',
      type: 'translation-shift',
      label: 'Translational Mediation',
      description: 'Hebrew dabar enters Greek philosophical lexicon through LXX strategy.',
    },
    {
      source: 'lxx-logos',
      target: 'stp-wisdom',
      type: 'intertestamental-development',
      label: 'Wisdom Expansion',
      description: 'Second Temple authors integrate logos with wisdom and agentive mediation.',
    },
    {
      source: 'stp-wisdom',
      target: 'nt-john-prologue',
      type: 'genealogical-trajectory',
      label: 'Johannine Reconfiguration',
      description:
        'John reframes inherited mediatory motifs in a christological and incarnational key.',
    },
    {
      source: 'hellenistic-logos',
      target: 'nt-john-prologue',
      type: 'conceptual-pressure',
      label: 'Philosophical Resonance',
      description:
        'Johannine usage resonates with but subverts Greek metaphysical idioms of logos.',
    },
    {
      source: 'nt-john-prologue',
      target: 'nt-hebrews',
      type: 'canonical-intertext',
      label: 'Early Christian Development',
      description: 'NT corpora variably intensify speech/son ontology relation.',
    },
  ],
  summary: `## Genealogical Trajectory

The concept trajectory from **דָּבָר** to **λόγος** is neither linear nor merely lexical. The OT matrix situates speech as eventful agency (Gen 1:3; Isa 55:11), while the LXX introduces Greek terms that expose Hebrew semantics to different philosophical fields. Second Temple corpora then diversify this mediatory language, and the Johannine Prologue crystallizes it in an incarnational thesis.

## Methodological Reflection

A phase-based genealogy avoids flattening textual traditions into proof-text chains. Instead, it tracks transformations across translation, reception, and theological reframing while preserving diachronic discontinuities.

## Symptomatic Analysis

Symptomatically, the tradition repeats divine speech as world-ordering force, yet silence persists around the precise ontological mechanics of mediation. This productive tension drives later christological elaboration.`,
};

export const mockVerification: VerificationResult = {
  status: 'verified',
  notes: ['Starter sample verification state only. Use Trace Genealogy for live run output.'],
};
