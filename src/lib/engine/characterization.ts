// ============================================
// INFERRA CHARACTERIZATION ENGINE - LAYER 2
// Analyzes prompt intent, complexity, and requirements
// ============================================

import type { PromptCharacterization, IntentType, ComplexityLevel, TaskType, OutputType, ContextNeeds } from '../../types';

const INTENT_KEYWORDS: Record<IntentType, string[]> = {
  'question': ['what', 'who', 'when', 'where', 'why', 'how', 'is', 'are', 'does', 'do', 'can', 'could'],
  'instruction': ['make', 'create', 'build', 'write', 'generate', 'produce', 'implement', 'develop'],
  'generation': ['generate', 'create', 'write', 'compose', 'draft', 'produce'],
  'analysis': ['analyze', 'evaluate', 'assess', 'review', 'examine', 'investigate', 'compare'],
  'transformation': ['convert', 'transform', 'translate', 'change', 'modify', 'reformat', 'summarize'],
  'conversation': ['hi', 'hello', 'hey', 'thanks', 'help', 'explain'],
  'coding': ['code', 'function', 'class', 'debug', 'fix', 'implement', 'program', 'script', 'api'],
};

const TASK_KEYWORDS: Record<TaskType, string[]> = {
  'simple-qa': ['what is', 'who is', 'when', 'where', 'define', 'explain briefly'],
  'complex-reasoning': ['analyze', 'evaluate', 'compare', 'argue', 'debate', 'implications', 'consequences'],
  'code': ['code', 'function', 'class', 'debug', 'implement', 'program', 'script', 'algorithm', 'api'],
  'creative': ['write', 'story', 'poem', 'creative', 'imagine', 'fiction', 'narrative'],
  'summarization': ['summarize', 'summary', 'tldr', 'key points', 'main ideas', 'condense'],
  'translation': ['translate', 'translation', 'in spanish', 'in french', 'in german', 'in chinese'],
  'data-extraction': ['extract', 'parse', 'find all', 'list all', 'identify', 'get the'],
  'conversation': ['chat', 'talk', 'discuss', 'tell me about', 'help me'],
  'analysis': ['analyze', 'analysis', 'review', 'examine', 'assess', 'insights'],
  'math': ['calculate', 'solve', 'equation', 'formula', 'math', 'algebra', 'calculus'],
};

const COMPLEXITY_INDICATORS = {
  high: ['step by step', 'detailed', 'comprehensive', 'in-depth', 'thoroughly', 'complex', 'advanced', 'expert', 'professional', 'architecture', 'system design', 'optimize', 'production-ready', 'multiple', 'various'],
  medium: ['explain', 'describe', 'outline', 'compare', 'example', 'how to', 'implement', 'create'],
  low: ['briefly', 'quick', 'simple', 'just', 'only', 'yes or no', 'true or false', 'one word', 'short'],
};

export function characterizePrompt(prompt: string, systemPrompt?: string): PromptCharacterization {
  const fullText = systemPrompt ? `${systemPrompt}\n${prompt}` : prompt;
  const lowerText = fullText.toLowerCase();

  const intent = detectIntent(lowerText);
  const taskCategory = detectTaskType(lowerText);
  const { complexity, complexityScore } = analyzeComplexity(fullText);
  const contextNeeds = analyzeContextNeeds(fullText);
  const outputType = detectOutputType(lowerText, taskCategory);

  const estimatedInputTokens = Math.ceil(fullText.length / 4);
  const estimatedOutputTokens = estimateOutputTokens(taskCategory, complexity, estimatedInputTokens);

  const containsCode = hasCode(fullText);
  const containsMath = hasMath(fullText);

  const requiresReasoning = ['complex-reasoning', 'math', 'analysis', 'code'].includes(taskCategory) || 
    lowerText.includes('why') || lowerText.includes('explain') || lowerText.includes('reason');
  const requiresCreativity = taskCategory === 'creative' || 
    ['creative', 'imagine', 'invent', 'original', 'unique', 'brainstorm'].some(kw => lowerText.includes(kw));
  const requiresAccuracy = ['math', 'code', 'data-extraction', 'translation'].includes(taskCategory) ||
    ['exact', 'precise', 'accurate', 'correct', 'factual'].some(kw => lowerText.includes(kw));

  const keywords = extractKeywords(fullText);
  const detectedLanguage = detectLanguage(fullText);

  return {
    intent,
    complexity,
    complexityScore,
    contextNeeds,
    outputType,
    taskCategory,
    estimatedInputTokens,
    estimatedOutputTokens,
    keywords,
    detectedLanguage,
    containsCode,
    containsMath,
    requiresReasoning,
    requiresCreativity,
    requiresAccuracy,
  };
}

function detectIntent(text: string): IntentType {
  let maxScore = 0;
  let detectedIntent: IntentType = 'question';

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) score += 1;
    }
    if (score > maxScore) {
      maxScore = score;
      detectedIntent = intent as IntentType;
    }
  }

  return detectedIntent;
}

function detectTaskType(text: string): TaskType {
  let maxScore = 0;
  let detectedTask: TaskType = 'conversation';

  for (const [task, keywords] of Object.entries(TASK_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) score += 1;
    }
    if (score > maxScore) {
      maxScore = score;
      detectedTask = task as TaskType;
    }
  }

  if (maxScore < 2) {
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 20 && text.includes('?')) return 'simple-qa';
  }

  return detectedTask;
}

function analyzeComplexity(text: string): { complexity: ComplexityLevel; complexityScore: number } {
  const lowerText = text.toLowerCase();
  let score = 50;

  const wordCount = text.split(/\s+/).length;
  if (wordCount < 20) score -= 15;
  else if (wordCount < 50) score -= 5;
  else if (wordCount > 200) score += 15;
  else if (wordCount > 500) score += 25;

  for (const indicator of COMPLEXITY_INDICATORS.high) {
    if (lowerText.includes(indicator)) score += 8;
  }
  for (const indicator of COMPLEXITY_INDICATORS.medium) {
    if (lowerText.includes(indicator)) score += 3;
  }
  for (const indicator of COMPLEXITY_INDICATORS.low) {
    if (lowerText.includes(indicator)) score -= 10;
  }

  if (hasCode(text)) score += 10;
  if (hasMath(text)) score += 10;

  const questionCount = (text.match(/\?/g) || []).length;
  if (questionCount > 1) score += questionCount * 5;

  score = Math.max(0, Math.min(100, score));

  let complexity: ComplexityLevel;
  if (score < 30) complexity = 'low';
  else if (score < 55) complexity = 'medium';
  else if (score < 80) complexity = 'high';
  else complexity = 'very-high';

  return { complexity, complexityScore: score };
}

function analyzeContextNeeds(text: string): ContextNeeds {
  const lowerText = text.toLowerCase();
  
  const requiresExternalKnowledge = ['latest', 'recent', 'current', '2024', '2025', '2026'].some(kw => lowerText.includes(kw));
  const requiresLongContext = text.length > 4000 || lowerText.includes('document') || lowerText.includes('entire');
  const requiresMultiStep = ['step by step', 'first', 'then', 'finally', 'multiple'].some(kw => lowerText.includes(kw));
  
  const numberedItems = (text.match(/^\s*\d+[\.\)]/gm) || []).length;
  const estimatedSteps = Math.max(1, numberedItems || (requiresMultiStep ? 3 : 1));

  return { requiresExternalKnowledge, requiresLongContext, requiresMultiStep, estimatedSteps };
}

function detectOutputType(text: string, taskType: TaskType): OutputType {
  if (taskType === 'code') return 'code';
  if (text.includes('json') || text.includes('structured')) return 'json';
  if (text.includes('list') || text.includes('bullet')) return 'list';
  if (text.includes('table') || text.includes('comparison')) return 'table';
  if (taskType === 'creative') return 'creative';
  if (taskType === 'analysis') return 'analysis';
  return 'text';
}

function estimateOutputTokens(taskType: TaskType, complexity: ComplexityLevel, inputTokens: number): number {
  const multipliers: Record<TaskType, number> = {
    'simple-qa': 0.3,
    'complex-reasoning': 2.5,
    'code': 2.0,
    'creative': 3.0,
    'summarization': 0.4,
    'translation': 1.2,
    'data-extraction': 0.5,
    'conversation': 0.8,
    'analysis': 2.0,
    'math': 1.5,
  };

  const complexityMultipliers: Record<ComplexityLevel, number> = {
    'low': 0.5,
    'medium': 1.0,
    'high': 1.5,
    'very-high': 2.0,
  };

  const baseOutput = inputTokens * multipliers[taskType];
  const adjusted = baseOutput * complexityMultipliers[complexity];

  return Math.max(50, Math.min(8000, Math.round(adjusted)));
}

function hasCode(text: string): boolean {
  const codePatterns = [
    /```[\s\S]*```/,
    /\bfunction\s+\w+\s*\(/,
    /\bdef\s+\w+\s*\(/,
    /\bclass\s+\w+/,
    /\bimport\s+.*\s+from/,
    /\bconst\s+\w+\s*=/,
    /=>|->|\|>/,
    /SELECT\s+.*\s+FROM/i,
  ];
  return codePatterns.some(p => p.test(text));
}

function hasMath(text: string): boolean {
  const mathPatterns = [
    /\d+\s*[\+\-\*\/\^]\s*\d+/,
    /\b(sin|cos|tan|log|ln|sqrt)\s*\(/,
    /∫|∑|√|∞|π|θ|Δ|∂/,
    /\bsolve\s+for\b/i,
    /\bderivative\b/i,
    /\bintegral\b/i,
  ];
  return mathPatterns.some(p => p.test(text));
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set(['this', 'that', 'with', 'from', 'have', 'been', 'were', 'they', 'their', 'what', 'when', 'where', 'which', 'there', 'about', 'would', 'could', 'should', 'into', 'your', 'more', 'some', 'them', 'then', 'than', 'also', 'just', 'only', 'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'has', 'her', 'was', 'one', 'our', 'out']);
  
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));

  return [...new Set(words)].slice(0, 10);
}

function detectLanguage(text: string): string {
  if (/[\u0400-\u04FF]/.test(text)) return 'russian';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'chinese';
  if (/[\u3040-\u30FF]/.test(text)) return 'japanese';
  if (/[\uAC00-\uD7AF]/.test(text)) return 'korean';
  if (/[\u0600-\u06FF]/.test(text)) return 'arabic';
  return 'english';
}
