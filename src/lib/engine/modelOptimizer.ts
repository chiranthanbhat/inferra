// ============================================
// INFERRA SEMANTIC OPTIMIZATION ENGINE
// A prompt-intelligence compiler — not a text cleaner.
//
//   raw prompt
//     → semantic deduplication (synonym + adverb runs)
//     → sentence-level dedup (duplicate / synonymous requests)
//     → requirement extraction (verbose lists → structured topics)
//     → deliverable extraction (summary / KPIs / roadmap / …)
//     → constraint extraction (limits / format / tone / audience)
//     → model-specific reconstruction (Objective / Requirements /
//        Constraints / Deliverables)
//     → scoring + validation
//
// Optimization runs AFTER model selection; the selected model
// determines the reconstruction format.
// ============================================

import type {
  AIModel,
  AIProvider,
  PromptCharacterization,
  PromptOptimization,
  OptimizationAction,
  OptimizationSection,
  ModelAwarePrompt,
  PromptModification,
  ModelOptimizationProfile,
  OptimizationProfileId,
} from '../../types';

/* ───────────────────────── token helper ───────────────────────── */
const tokens = (s: string) => Math.ceil(s.trim().length / 4);

/* ───────────────────────── lexicons ───────────────────────── */

// Synonym clusters → canonical term. Runs of these collapse to one word.
const SYNONYM_GROUPS: { canonical: string; members: string[] }[] = [
  { canonical: 'analyze', members: ['analyze', 'analyse', 'evaluate', 'assess', 'review', 'examine', 'investigate', 'study', 'inspect', 'scrutinize', 'appraise', 'audit', 'look into', 'look at'] },
  { canonical: 'comprehensively', members: ['carefully', 'thoroughly', 'comprehensively', 'extensively', 'meticulously', 'rigorously', 'exhaustively', 'deeply', 'diligently', 'painstakingly', 'in detail', 'in-depth', 'in great detail'] },
  { canonical: 'comprehensive', members: ['detailed', 'comprehensive', 'thorough', 'exhaustive', 'complete', 'in-depth', 'extensive', 'full', 'robust'] },
  { canonical: 'create', members: ['create', 'build', 'develop', 'generate', 'produce', 'construct', 'craft', 'formulate', 'put together'] },
  { canonical: 'improve', members: ['improve', 'enhance', 'optimize', 'optimise', 'refine', 'polish', 'strengthen', 'boost', 'elevate'] },
  { canonical: 'summarize', members: ['summarize', 'summarise', 'condense', 'recap', 'synthesize', 'synthesise', 'distill', 'distil'] },
  { canonical: 'explain', members: ['explain', 'describe', 'clarify', 'elaborate', 'illustrate', 'walk through', 'break down'] },
  { canonical: 'important', members: ['important', 'crucial', 'critical', 'essential', 'vital', 'significant', 'paramount', 'imperative'] },
  { canonical: 'identify', members: ['identify', 'pinpoint', 'detect', 'discover', 'uncover', 'surface', 'flag'] },
  { canonical: 'provide', members: ['provide', 'give', 'offer', 'supply', 'present', 'share', 'deliver'] },
  { canonical: 'compare', members: ['compare', 'contrast', 'differentiate', 'distinguish'] },
  { canonical: 'consider', members: ['consider', 'account for', 'factor in', 'take into account', 'bear in mind', 'keep in mind'] },
];

// Action verbs that can govern a requirement list.
const ACTION_VERBS = [
  'analyze', 'create', 'provide', 'include', 'cover', 'address', 'consider', 'compare',
  'improve', 'summarize', 'explain', 'identify', 'list', 'review', 'examine', 'evaluate',
  'assess', 'build', 'develop', 'write', 'generate', 'design', 'plan', 'outline', 'detail',
];

const DELIVERABLES: { re: RegExp; label: string }[] = [
  { re: /executive summary/i, label: 'Executive summary' },
  { re: /recommendation/i, label: 'Recommendations' },
  { re: /road\s?map/i, label: 'Roadmap' },
  { re: /\bkpis?\b|key performance indicator/i, label: 'KPIs' },
  { re: /milestone/i, label: 'Milestones' },
  { re: /action items?/i, label: 'Action items' },
  { re: /next steps?/i, label: 'Next steps' },
  { re: /time\s?line/i, label: 'Timeline' },
  { re: /\bbudget\b/i, label: 'Budget' },
  { re: /risk (?:assessment|analysis|matrix)/i, label: 'Risk assessment' },
  { re: /swot/i, label: 'SWOT analysis' },
  { re: /financial (?:model|projection|forecast)/i, label: 'Financial model' },
];

const FILLERS = [
  'basically', 'essentially', 'actually', 'literally', 'obviously', 'clearly',
  'simply', 'really', 'very', 'just', 'quite', 'rather', 'kind of', 'sort of',
  'of course', 'needless to say', 'as you know', 'i think', 'i believe', 'i feel',
  'i would like you to', 'i want you to', 'i need you to', 'make sure to', 'be sure to',
];

const VERBOSE: [string, string][] = [
  ['in order to', 'to'], ['due to the fact that', 'because'], ['at this point in time', 'now'],
  ['at the present time', 'now'], ['in the event that', 'if'], ['for the purpose of', 'for'],
  ['with regard to', 'about'], ['with respect to', 'about'], ['in spite of the fact that', 'although'],
  ['it is important to note that ', ''], ['it should be noted that ', ''], ['please note that ', ''],
  ['prior to', 'before'], ['subsequent to', 'after'], ['with the exception of', 'except'],
  ['a variety of', 'various'], ['a number of', 'several'], ['in the near future', 'soon'],
  ['as well as', 'and'], ['in addition to', 'and'],
];

const INLINE_POLITE = [
  'i would appreciate it if you could ', 'i would like you to please ', 'i would like you to ',
  'could you please ', 'can you please ', 'would you please ', 'could you kindly ',
  'could you ', 'can you ', 'would you ', 'will you ', 'please kindly ', 'please ', 'kindly ',
];

const CLOSINGS = [
  'thank you in advance', 'thanks in advance', 'thank you so much', 'thank you', 'thanks',
  'i appreciate your help', 'i appreciate it', 'i look forward to your response', 'best regards',
];

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'as', 'at', 'by',
  'is', 'are', 'be', 'this', 'that', 'these', 'those', 'it', 'its', 'their', 'your', 'you',
  'we', 'i', 'me', 'my', 'our', 'us', 'they', 'them', 'all', 'any', 'each', 'every', 'some',
  'into', 'about', 'from', 'then', 'than', 'so', 'such', 'also', 'both', 'including', 'etc',
]);

/* ───────────────────────── regex helpers ───────────────────────── */
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CONNECTOR = String.raw`(?:\s*(?:,|;|/|&|\+)\s*|\s+(?:and|or|as well as|along with|plus)\s+|\s+)`;

function buildRunRegex(members: string[]): RegExp {
  const alt = members.slice().sort((a, b) => b.length - a.length).map(esc).join('|');
  const unit = `(?:${alt})`;
  // a "run" = unit (connector unit)+   — i.e. two or more synonyms in sequence
  return new RegExp(`\\b${unit}\\b(?:${CONNECTOR}\\b${unit}\\b)+`, 'gi');
}
const RUN_REGEXES = SYNONYM_GROUPS.map((g) => ({ canonical: g.canonical, re: buildRunRegex(g.members) }));

/* ───────────────────────── semantic passes ───────────────────────── */

interface PassResult { text: string; hits: number; }

// 1. Collapse synonym / adverb runs to a single canonical word.
function semanticDedup(text: string): PassResult {
  let out = text;
  let hits = 0;
  for (const { canonical, re } of RUN_REGEXES) {
    out = out.replace(re, () => { hits++; return canonical; });
  }
  // collapse immediate repeats: "analyze analyze" / "growth growth"
  out = out.replace(/\b(\w+)(\s+\1\b)+/gi, (_m, w) => { hits++; return w; });
  return { text: out, hits };
}

function stripPhrases(text: string, phrases: string[]): PassResult {
  let out = text;
  let hits = 0;
  for (const ph of phrases) {
    const re = new RegExp(`(^|[\\s,])${esc(ph)}(?=[\\s,.!?;:]|$)`, 'gi');
    out = out.replace(re, (_m, lead) => { hits++; return lead; });
  }
  return { text: out, hits };
}

function stripPoliteness(text: string): PassResult {
  let out = text;
  let hits = 0;
  for (const ph of INLINE_POLITE) {
    const re = new RegExp(esc(ph), 'gi');
    out = out.replace(re, () => { hits++; return ''; });
  }
  for (const c of CLOSINGS) {
    const re = new RegExp(`[,.;\\s]*${esc(c)}[.!]*\\s*$`, 'i');
    if (re.test(out)) { out = out.replace(re, ''); hits++; }
  }
  out = out.replace(/(^|[.!?]\s+)([a-z])/g, (_m, a, b) => a + b.toUpperCase());
  return { text: out, hits };
}

function compressVerbose(text: string): PassResult {
  let out = text;
  let hits = 0;
  for (const [from, to] of VERBOSE) {
    const re = new RegExp(esc(from), 'gi');
    out = out.replace(re, (m) => { hits++; return to === '' ? '' : (m[0] === m[0].toUpperCase() ? to.charAt(0).toUpperCase() + to.slice(1) : to); });
  }
  return { text: out, hits };
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

// 2. Remove duplicate / synonymous sentences (Jaccard on content words).
function dedupSentences(text: string): { text: string; removed: number } {
  const sentences = splitSentences(text);
  if (sentences.length < 2) return { text, removed: 0 };
  const kept: string[] = [];
  const keptSets: Set<string>[] = [];
  let removed = 0;

  const contentSet = (s: string) =>
    new Set(canonicalTokens(s).filter((w) => !STOPWORDS.has(w)));

  for (const s of sentences) {
    const set = contentSet(s);
    if (set.size === 0) { kept.push(s); keptSets.push(set); continue; }
    let dup = false;
    for (const prev of keptSets) {
      const inter = [...set].filter((w) => prev.has(w)).length;
      const union = new Set([...set, ...prev]).size;
      const jaccard = union ? inter / union : 0;
      const subset = inter / set.size; // is this sentence's content already covered?
      if (jaccard > 0.6 || subset >= 0.85) { dup = true; break; }
    }
    if (dup) { removed++; continue; }
    kept.push(s);
    keptSets.push(set);
  }
  return { text: kept.join(' '), removed };
}

// canonicalize a string into comparable content tokens (synonyms folded)
function canonicalTokens(s: string): string[] {
  let t = s.toLowerCase();
  for (const g of SYNONYM_GROUPS) {
    for (const m of g.members) {
      t = t.replace(new RegExp(`\\b${esc(m)}\\b`, 'g'), g.canonical);
    }
  }
  return t.replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
}

/* ───────────────────────── structure extraction ───────────────────────── */

interface Structure {
  objectiveVerb: string | null;
  intense: boolean;
  requirements: string[];
  deliverables: string[];
  constraints: string[];
}

function cleanItem(raw: string): string {
  let it = raw
    .replace(/^\s*(?:and|or|also|including|such as|the|a|an|its?|their)\s+/i, '')
    .replace(/[.?!,;:]+$/, '')
    .trim();
  it = it.replace(/\s+/g, ' ');
  return it.charAt(0).toUpperCase() + it.slice(1);
}

function looksLikeTopic(it: string): boolean {
  const words = it.split(/\s+/);
  return it.length >= 2 && it.length <= 48 && words.length <= 6 && /[a-z]/i.test(it);
}

// Verbs that can govern a list = explicit action verbs + every verb-group synonym.
const VERB_CANON: Record<string, string> = {};
for (const v of ACTION_VERBS) VERB_CANON[v] = v;
for (const g of SYNONYM_GROUPS) {
  if (!ACTION_VERBS.includes(g.canonical)) continue; // verb groups only (skip adverb/adjective groups)
  for (const m of g.members) VERB_CANON[m.toLowerCase()] = g.canonical;
}
['look', 'look at', 'look into', 'go over', 'dig into'].forEach((v) => (VERB_CANON[v] = 'analyze'));
const VERB_KEYS = Object.keys(VERB_CANON).sort((a, b) => b.length - a.length);
const VERB_RE = new RegExp(`\\b(${VERB_KEYS.map(esc).join('|')})\\b`, 'i');

function extractRequirements(text: string, deliverables: string[]): { verb: string; items: string[] } | null {
  const delKeys = new Set(deliverables.map((d) => d.toLowerCase()));
  let best: { verb: string; items: string[] } | null = null;

  for (const sentence of splitSentences(text)) {
    const m = sentence.match(VERB_RE);
    if (!m || m.index === undefined) continue;
    let region = sentence.slice(m.index + m[0].length);
    region = region.replace(/^[:\s]*(?:at|on|into|over|the|following|these|below|all of|each of)?[:\s-]*/i, ' ');
    const rawItems = region.split(/\s*(?:,|;|\/|&|\band\b|\bor\b)\s*/i);
    let items = dedupItems(rawItems.map(cleanItem).filter(looksLikeTopic));
    // requirements are not deliverables — drop any that are
    items = items.filter((it) => !delKeys.has(it.toLowerCase()) && !isDeliverablePhrase(it));
    if (items.length >= 3 && (!best || items.length > best.items.length)) {
      best = { verb: VERB_CANON[m[1].toLowerCase()] ?? m[1].toLowerCase(), items };
    }
  }
  return best;
}

function isDeliverablePhrase(s: string): boolean {
  return DELIVERABLES.some((d) => d.re.test(s));
}

function dedupItems(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const key = canonicalTokens(it).join(' ');
    if (key && !seen.has(key)) { seen.add(key); out.push(it); }
  }
  return out;
}

function extractDeliverables(text: string): string[] {
  const found: string[] = [];
  for (const d of DELIVERABLES) if (d.re.test(text) && !found.includes(d.label)) found.push(d.label);
  return found;
}

function extractConstraints(text: string): string[] {
  const out: string[] = [];
  const add = (s: string) => { if (s && !out.includes(s)) out.push(s); };

  const limit = text.match(/(?:within|under|no more than|at most|less than|up to|max(?:imum)? of)\s+(\d[\d,]*)\s*(words?|tokens?|pages?|sentences?|bullets?|paragraphs?)/i);
  if (limit) add(`Max ${limit[1]} ${limit[2].toLowerCase()}`);

  const fmt = text.match(/\b(?:in|as|using|format(?:ted)? (?:as|in)?)\s+(json|markdown|a table|a bulleted list|bullet points|csv|yaml|plain text|html)\b/i);
  if (fmt) add(`Format: ${fmt[1].toLowerCase()}`);

  const tone = text.match(/\b(formal|professional|casual|friendly|concise|technical|persuasive|neutral)\s+tone\b/i);
  if (tone) add(`Tone: ${tone[1].toLowerCase()}`);

  const aud = text.match(/\bfor\s+(executives?|leadership|stakeholders?|engineers?|developers?|a technical audience|beginners?|customers?|investors?|the board)\b/i);
  if (aud) add(`Audience: ${aud[1].toLowerCase()}`);

  const avoid = text.match(/\b(?:do not|don't|avoid|never|without)\s+([a-z][a-z\s-]{2,40}?)(?=[.,;!?]|$)/i);
  if (avoid) add(`Avoid ${avoid[1].trim()}`);

  const deadline = text.match(/\bby\s+(tomorrow|next week|end of (?:day|week|month|quarter)|q[1-4]|\w+ \d{1,2})\b/i);
  if (deadline) add(`Deadline: ${deadline[1].toLowerCase()}`);

  return out;
}

/* ───────────────────────── profiles ───────────────────────── */

const PROFILE_META: Record<OptimizationProfileId, { label: string; focus: string; description: (m: AIModel) => string }> = {
  reasoning: {
    label: 'Reasoning-focused structure',
    focus: 'Objective + stepwise requirements',
    description: (m) => `${m.displayName} reasons best from an explicit objective and a clean requirement list. The prompt is rebuilt into Objective / Requirements / Constraints / Deliverables so the model can work through each item, with redundant synonyms and duplicate asks removed.`,
  },
  structured: {
    label: 'Instruction-focused structure',
    focus: 'Numbered, imperative directives',
    description: (m) => `${m.displayName} follows explicit, ordered instructions best. Requirements are rebuilt as a numbered imperative checklist, politeness and filler stripped, synonym runs collapsed to a single directive.`,
  },
  context: {
    label: 'Context-focused structure',
    focus: 'Organized, labelled sections',
    description: (m) => `${m.displayName} performs best with clearly labelled context. The prompt is reorganized into titled sections with all reference topics preserved, while duplicate and synonymous phrasing is removed.`,
  },
  compression: {
    label: 'Maximum compression (intent-preserving)',
    focus: 'Smallest token footprint',
    description: (m) => `${m.displayName} is priced for volume. The prompt is compressed to its semantic core — synonym runs, filler, politeness, and duplicate asks removed — and rendered as a terse, inline directive that preserves every objective, topic, and deliverable.`,
  },
  conversational: {
    label: 'Conversational structure',
    focus: 'Natural, single-pass phrasing',
    description: (m) => `${m.displayName} thrives on a natural voice. The prompt is de-duplicated and tightened into one clear conversational instruction that keeps the objective, topics, and deliverables intact.`,
  },
};

function profileForModel(model: AIModel): OptimizationProfileId {
  const byProvider: Partial<Record<AIProvider, OptimizationProfileId>> = {
    anthropic: 'reasoning', openai: 'structured', google: 'context',
    deepseek: 'compression', xai: 'conversational',
  };
  return byProvider[model.provider] ?? 'structured';
}

/* ───────────────────────── reconstruction ───────────────────────── */

const bullets = (items: string[]) => items.map((i) => `- ${i}`).join('\n');
const numbered = (items: string[]) => items.map((i, n) => `${n + 1}. ${i}`).join('\n');

function sectionsFrom(struct: Structure): OptimizationSection[] {
  const out: OptimizationSection[] = [];
  const verb = struct.objectiveVerb ? cap(struct.objectiveVerb) : 'Address';
  const obj = `${verb} the items below${struct.intense ? ' comprehensively' : ''}.`;
  out.push({ title: 'Objective', items: [obj] });
  if (struct.requirements.length) out.push({ title: 'Requirements', items: struct.requirements });
  if (struct.constraints.length) out.push({ title: 'Constraints', items: struct.constraints });
  if (struct.deliverables.length) out.push({ title: 'Deliverables', items: struct.deliverables });
  return out;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function render(profile: OptimizationProfileId, struct: Structure): string {
  const verb = struct.objectiveVerb ? cap(struct.objectiveVerb) : 'Address';
  const reqs = struct.requirements;
  const cons = struct.constraints;
  const dels = struct.deliverables;
  const intense = struct.intense ? ' comprehensively' : '';

  switch (profile) {
    case 'reasoning': {
      const lines = [`Objective: ${verb} each area below${intense}, reasoning through them step by step.`];
      if (reqs.length) lines.push(`Requirements:\n${bullets(reqs)}`);
      if (cons.length) lines.push(`Constraints:\n${bullets(cons)}`);
      if (dels.length) lines.push(`Deliverables:\n${bullets(dels)}`);
      return lines.join('\n\n');
    }
    case 'structured': {
      const lines = [`Task: ${verb} the following${intense}.`];
      if (reqs.length) lines.push(`Requirements:\n${numbered(reqs)}`);
      if (cons.length) lines.push(`Constraints:\n${bullets(cons)}`);
      if (dels.length) lines.push(`Deliverables:\n${numbered(dels)}`);
      return lines.join('\n\n');
    }
    case 'context': {
      const lines = [`# Objective\n${verb} the following${intense}.`];
      if (reqs.length) lines.push(`# Areas to cover\n${bullets(reqs)}`);
      if (cons.length) lines.push(`# Constraints\n${bullets(cons)}`);
      if (dels.length) lines.push(`# Deliverables\n${bullets(dels)}`);
      return lines.join('\n\n');
    }
    case 'compression': {
      const parts = [`${struct.objectiveVerb ?? 'address'}: ${reqs.join('; ')}`];
      if (dels.length) parts.push(`deliver: ${dels.join('; ').toLowerCase()}`);
      if (cons.length) parts.push(`limits: ${cons.join('; ').toLowerCase()}`);
      return parts.join('. ') + '.';
    }
    case 'conversational': {
      let s = `${verb} the following${intense}: ${oxford(reqs)}.`;
      if (dels.length) s += ` Then provide ${oxford(dels).toLowerCase()}.`;
      if (cons.length) s += ` Keep it to: ${cons.join(', ').toLowerCase()}.`;
      return s;
    }
  }
}

function oxford(items: string[]): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/* linear (no structure detected): per-model casing of the compressed text */
function renderLinear(profile: OptimizationProfileId, text: string): string {
  const t = text.trim();
  switch (profile) {
    case 'compression': return t.charAt(0).toLowerCase() + t.slice(1);
    case 'structured':
    case 'reasoning': return cap(t).replace(/([.!?])?$/, (m) => (m ? m : '.'));
    default: return cap(t);
  }
}

/* ───────────────────────── scoring ───────────────────────── */

// Words that carry no intent — removing them must NOT lower the intent score.
const NOISE = new Set<string>();
FILLERS.forEach((f) => f.split(/\s+/).forEach((w) => NOISE.add(w)));
for (const g of SYNONYM_GROUPS) {
  if (ACTION_VERBS.includes(g.canonical)) continue; // keep verb canonicals; drop intensity/quality words
  g.members.forEach((m) => m.split(/\s+/).forEach((w) => NOISE.add(w)));
  NOISE.add(g.canonical);
}
['business', 'area', 'areas', 'everything', 'thing', 'things', 'want', 'like', 'would', 'really',
 'make', 'sure', 'great', 'detail', 'details', 'all', 'our', 'your', 'please', 'thank', 'thanks',
 'advance', 'look', 'then', 'keep', 'help', 'need', 'much', 'lot', 'really', 'going', 'able',
].forEach((w) => NOISE.add(w));

// Intent preservation = how many MEANINGFUL terms (topics, deliverables, objective)
// survive. Filler/duplicate/intensity removal does not count against the score.
function intentPreservation(original: string, optimized: string): number {
  const o = new Set(canonicalTokens(original).filter((w) => w.length > 2 && !STOPWORDS.has(w) && !NOISE.has(w)));
  if (o.size === 0) return 100;
  const p = new Set(canonicalTokens(optimized).filter((w) => !STOPWORDS.has(w)));
  let kept = 0;
  o.forEach((w) => { if (p.has(w)) kept++; });
  return Math.round((kept / o.size) * 100);
}

/* ───────────────────────── main entry ───────────────────────── */

export function optimizeForModel(
  prompt: string,
  model: AIModel,
  characterization?: PromptCharacterization,
): {
  profile: ModelOptimizationProfile;
  optimization: PromptOptimization;
  modelAwarePrompt: ModelAwarePrompt;
} {
  const id = profileForModel(model);
  const meta = PROFILE_META[id];
  const mods: PromptModification[] = [];
  const actions: OptimizationAction[] = [];
  const note = (type: PromptModification['type'], description: string, reason: string, saved = 0) => {
    mods.push({ type, description, reason });
    actions.push({ type: 'semantic', description, tokensSaved: saved });
  };

  const originalTokens = tokens(prompt);
  let text = prompt;

  // — pass 1: politeness / preamble / sign-off
  const pol = stripPoliteness(text);
  if (pol.hits) { note('instruction', 'Removed politeness, preamble, and sign-off', `${model.displayName} needs the task, not the framing`); text = pol.text; }

  // — pass 2: semantic deduplication (synonym + adverb runs)
  const t1 = tokens(text);
  const dedup = semanticDedup(text);
  if (dedup.hits) { note('instruction', `Collapsed ${dedup.hits} synonym/redundant run${dedup.hits > 1 ? 's' : ''} to canonical terms`, 'Merged "analyze, evaluate, assess…" → one verb; redundant adverbs → one', Math.max(0, t1 - tokens(dedup.text))); text = dedup.text; }

  // — pass 3: filler + verbose compression
  const fill = stripPhrases(text, FILLERS);
  if (fill.hits) { note('format', 'Removed filler words', 'Filler carries no instruction signal'); text = fill.text; }
  const verb = compressVerbose(text);
  if (verb.hits) { note('format', 'Compressed verbose phrasing', 'Tighter, equivalent wording'); text = verb.text; }

  // — pass 4: sentence-level dedup (duplicate / synonymous requests)
  const sd = dedupSentences(text);
  if (sd.removed) { note('structure', `Removed ${sd.removed} duplicate / synonymous sentence${sd.removed > 1 ? 's' : ''}`, 'Repeated asks add tokens, not meaning'); text = sd.text; }

  text = text.replace(/\s{2,}/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();

  // — pass 5: structure extraction
  const deliverables = extractDeliverables(prompt);
  const reqExtract = extractRequirements(text, deliverables);
  const constraints = extractConstraints(prompt);
  const intense = /\bcomprehensively\b/i.test(text) || SYNONYM_GROUPS[1].members.some((m) => new RegExp(`\\b${esc(m)}\\b`, 'i').test(prompt));

  const struct: Structure = {
    objectiveVerb: reqExtract?.verb ?? null,
    intense,
    requirements: reqExtract?.items ?? [],
    deliverables,
    constraints,
  };

  const hasStructure = struct.requirements.length >= 3 || deliverables.length > 0;
  let sections: OptimizationSection[] = [];
  let engineered: string;

  if (hasStructure) {
    sections = sectionsFrom(struct);
    engineered = render(id, struct);
    if (struct.requirements.length >= 3) note('structure', `Extracted ${struct.requirements.length} requirements into a structured list`, 'Verbose enumeration → scannable topics');
    if (deliverables.length) note('structure', `Extracted ${deliverables.length} deliverable${deliverables.length > 1 ? 's' : ''}: ${deliverables.join(', ')}`, 'Made outputs explicit');
    if (constraints.length) note('structure', `Captured ${constraints.length} constraint${constraints.length > 1 ? 's' : ''}`, 'Preserved limits, format, and audience');
    note('structure', `Rebuilt as ${meta.label} for ${model.displayName}`, 'Reconstruction, not truncation');
  } else {
    engineered = renderLinear(id, text);
  }

  engineered = engineered.replace(/\n{3,}/g, '\n\n').trim() || prompt.trim();

  // — scoring
  const optimizedTokens = tokens(engineered);
  const tokensSaved = Math.max(0, originalTokens - optimizedTokens);
  const tokenReductionPercent = originalTokens > 0 ? Math.round((tokensSaved / originalTokens) * 100) : 0;
  const intentScore = intentPreservation(prompt, engineered);

  const structureBonus = hasStructure ? 22 + Math.min(18, struct.requirements.length * 2) : 0;
  const qualityScore = clamp(Math.round(tokenReductionPercent * 0.8 + structureBonus + mods.length * 2));
  const validationPassed = !(tokenReductionPercent < 15 && originalTokens > 200);
  const confidenceScore = clamp(Math.round(0.45 * intentScore + 0.35 * qualityScore + 0.20 * (validationPassed ? 100 : 45)));
  const validationMessage = validationPassed
    ? undefined
    : `Only ${tokenReductionPercent}% reduced on a ${originalTokens}-token prompt — below the 15% floor.`;

  if (actions.length === 0) actions.push({ type: 'assessment', description: 'Prompt already optimal for this model', tokensSaved: 0 });

  const profile: ModelOptimizationProfile = {
    id, label: meta.label, focus: meta.focus, description: meta.description(model),
    provider: model.provider, modelName: model.displayName,
  };

  const optimization: PromptOptimization = {
    originalPrompt: prompt,
    optimizedPrompt: engineered,
    originalTokens,
    optimizedTokens,
    tokensSaved,
    tokenReductionPercent,
    optimizationScore: qualityScore,
    optimizations: actions,
    qualityScore,
    intentScore,
    confidenceScore,
    validationPassed,
    validationMessage,
    sections,
  };

  const modelAwarePrompt: ModelAwarePrompt = {
    originalPrompt: prompt,
    modelOptimizedPrompt: engineered,
    targetModel: model,
    modifications: mods,
    expectedImprovements: {
      qualityIncrease: Math.min(25, mods.length * 3),
      tokenReduction: tokensSaved,
      costSavings: tokensSaved * (model.inputCostPer1k / 1000),
    },
  };

  void characterization;
  return { profile, optimization, modelAwarePrompt };
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

/* ───────────────────────── routing explanation ───────────────────────── */

export function buildRoutingExplanation(
  model: AIModel,
  characterization: PromptCharacterization,
  priority: string,
  profile: ModelOptimizationProfile,
  requestedModel?: AIModel,
): string {
  const task = characterization.taskCategory.replace('-', ' ');
  const analyzed = `Detected a ${characterization.complexity}-complexity ${task} task (${characterization.intent} intent), prioritizing ${priority}.`;
  const provider = providerName(model.provider);

  let lead: string;
  if (requestedModel && requestedModel.id !== model.id) {
    // Inferra re-routed away from the user's requested model.
    lead = `You requested ${requestedModel.displayName}. ${analyzed} Inferra scored every candidate and routed to ${model.displayName} on ${provider} instead — so the prompt is optimized for ${model.displayName}, the model that will actually run it, not ${requestedModel.displayName}.`;
  } else if (requestedModel) {
    // Inferra independently confirmed the user's requested model is best.
    lead = `You requested ${requestedModel.displayName}. ${analyzed} Inferra scored every candidate and confirmed ${model.displayName} on ${provider} is the best fit, so the prompt is optimized for it.`;
  } else {
    lead = `${analyzed} Inferra scored every candidate and routed to ${model.displayName} on ${provider}.`;
  }
  return `${lead} The prompt was then rebuilt with the ${profile.label.toLowerCase()} profile, tuned to how ${model.displayName} performs best.`;
}

function providerName(p: AIProvider): string {
  const names: Record<AIProvider, string> = {
    openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', xai: 'xAI',
    deepseek: 'DeepSeek', mistral: 'Mistral', openrouter: 'OpenRouter', opensource: 'open source',
  };
  return names[p] ?? p;
}
