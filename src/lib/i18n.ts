import type { AppLanguage, CounterfactualScenarioId, NodeType, PhaseKey, SourceType } from '../types';

export const DEFAULT_LANGUAGE: AppLanguage = 'en';

export function isZhHant(language: AppLanguage): boolean {
  return language === 'zh-Hant';
}

export function uiLocale(language: AppLanguage): string {
  return isZhHant(language) ? 'zh-HK' : 'en-US';
}

export function formatUiDate(value: string | number | Date, language: AppLanguage): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString(uiLocale(language));
}

export function summaryPlaceholder(language: AppLanguage): string {
  return isZhHant(language)
    ? '開啟「摘要」分頁即可根據目前圖譜生成綜合分析。'
    : 'Open the Summary tab to generate the synthesis essay from the current graph state.';
}

export function defaultQuery(language: AppLanguage): string {
  return isZhHant(language)
    ? '約翰福音 1 章中「道（Logos）」概念，如何從 MT/LXX 經由第二聖殿文獻發展而來。'
    : 'The concept of Logos in John 1 and its genealogy from MT/LXX through STP literature.';
}

export function sourceLabel(source: SourceType, language: AppLanguage): string {
  if (!isZhHant(language)) {
    return source;
  }
  const map: Record<SourceType, string> = {
    ANE: '古代近東',
    OT: '舊約/希伯來聖經',
    STP: '第二聖殿時期',
    NT: '新約',
    Hellenistic: '希臘化',
    Manuscript: '手稿傳統',
  };
  return map[source];
}

export function nodeTypeLabel(type: NodeType, language: AppLanguage): string {
  if (!isZhHant(language)) {
    return type;
  }
  const map: Record<NodeType, string> = {
    verse: '經文',
    concept: '概念',
    context: '語境',
    rupture: '斷裂',
    variant: '異文',
  };
  return map[type];
}

export function lineTypeLabel(type: string, language: AppLanguage): string {
  const normalized = type.trim().toLowerCase();
  const enMap: Record<string, string> = {
    'direct-citation': 'Direct Citation',
    allusion: 'Allusion',
    'conceptual-development': 'Conceptual Development',
    'translation-interpretation': 'Translation / Interpretation',
    inversion: 'Inversion',
    parallel: 'Parallel / Resonance',
    'inferred-sequence': 'Inferred Sequence',
  };
  const zhMap: Record<string, string> = {
    'direct-citation': '直接引用',
    allusion: '暗引／典故',
    'conceptual-development': '概念演變',
    'translation-interpretation': '翻譯／詮釋',
    inversion: '反轉／顛覆',
    parallel: '平行／共鳴',
    'inferred-sequence': '推定序列',
  };
  if (isZhHant(language) && zhMap[normalized]) {
    return zhMap[normalized];
  }
  if (enMap[normalized]) {
    return enMap[normalized];
  }
  const fallback = type.replace(/[_-]+/g, ' ').trim();
  if (!fallback) {
    return isZhHant(language) ? '概念演變' : 'Conceptual Development';
  }
  return fallback
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function phaseLabel(phase: PhaseKey, language: AppLanguage): string {
  if (!isZhHant(language)) {
    return phase;
  }
  const map: Record<PhaseKey, string> = {
    'phase0-notebook-sync': '階段0：NotebookLM 同步',
    'phase1-structural-mapping': '階段1：結構映射',
    'phase2-philological-enrichment': '階段2：語文深化',
    'phase3-academic-rigor': '階段3：學術嚴謹度',
    'phase4-synthesis-summary': '階段4：綜合摘要',
    'phase5-verification': '階段5：引文驗證',
    'phase6-counterfactual-lab': '階段6：反事實實驗室',
    'phase7-intertextuality-stats': '階段7：互文統計',
    'phase8-citation-audit': '階段8：引文稽核',
    'phase9-living-publication': '階段9：動態出版',
    'phase10-peer-review': '階段10：同儕審查',
  };
  return map[phase];
}

export function counterfactualLabel(
  scenario: CounterfactualScenarioId,
  language: AppLanguage,
): string {
  if (!isZhHant(language)) {
    return {
      'matthew-hebrew-not-lxx': 'Matthew Uses Hebrew Instead Of LXX',
      'second-temple-not-destroyed': 'Second Temple Not Destroyed',
      'philo-broad-circulation': 'Philo Broadly Circulates',
    }[scenario];
  }
  return {
    'matthew-hebrew-not-lxx': '若馬太使用希伯來文本而非七十士譯本',
    'second-temple-not-destroyed': '若第二聖殿未於公元70年被毀',
    'philo-broad-circulation': '若斐洛著作在一世紀廣泛流傳',
  }[scenario];
}

export function generationLanguageDirective(language: AppLanguage): string {
  if (!isZhHant(language)) {
    return `
Output language requirement:
- Write all narrative fields in native, publication-grade English.
- Preserve source-language terms (Hebrew/Greek/Aramaic/transliteration) exactly where relevant.
`;
  }

  return `
輸出語言要求：
- 所有敘事性內容必須使用「繁體中文（zh-Hant）」撰寫。
- 文風必須是自然、成熟、可直接閱讀的學術中文；避免英語句法直譯與生硬外來語序。
- 優先採用華文神學與人文研究常用術語（如：互文性、語義場、文本批判、第二聖殿時期）。
- 經文、專名、希伯來文／希臘文字詞可保留原文，必要時於中文敘述中自然嵌入。
- 嚴禁輸出簡體中文。
`;
}

