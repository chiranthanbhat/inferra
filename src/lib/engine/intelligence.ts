// ============================================
// INFERRA PROMPT INTELLIGENCE ENGINE - LAYER 3
// Analyzes prompt quality, waste, and optimization potential
// ============================================

import type { PromptIntelligence, PromptIssue, PromptIssueType } from '../../types';

export function analyzePromptIntelligence(prompt: string): PromptIntelligence {
  const issues: PromptIssue[] = [];
  const recommendations: string[] = [];

  const totalTokens = Math.ceil(prompt.length / 4);
  let redundantTokens = 0;
  let fillerTokens = 0;

  // Check for redundant phrases
  const redundantPhrases = [
    { pattern: /please\s+kindly/gi, issue: 'Redundant politeness', savings: 2 },
    { pattern: /\b(very|really|extremely|absolutely)\s+(very|really|extremely|absolutely)/gi, issue: 'Stacked intensifiers', savings: 2 },
    { pattern: /in order to/gi, issue: 'Verbose phrase', savings: 3 },
    { pattern: /due to the fact that/gi, issue: 'Verbose phrase', savings: 5 },
    { pattern: /at this point in time/gi, issue: 'Verbose phrase', savings: 5 },
    { pattern: /in the event that/gi, issue: 'Verbose phrase', savings: 4 },
    { pattern: /for the purpose of/gi, issue: 'Verbose phrase', savings: 4 },
    { pattern: /with regard to/gi, issue: 'Verbose phrase', savings: 3 },
    { pattern: /in spite of the fact that/gi, issue: 'Verbose phrase', savings: 6 },
    { pattern: /as a matter of fact/gi, issue: 'Filler phrase', savings: 5 },
    { pattern: /it is important to note that/gi, issue: 'Filler phrase', savings: 6 },
    { pattern: /it should be noted that/gi, issue: 'Filler phrase', savings: 5 },
    { pattern: /basically/gi, issue: 'Filler word', savings: 2 },
    { pattern: /essentially/gi, issue: 'Filler word', savings: 3 },
    { pattern: /actually/gi, issue: 'Filler word', savings: 2 },
    { pattern: /literally/gi, issue: 'Filler word', savings: 2 },
    { pattern: /I would like you to/gi, issue: 'Unnecessary preamble', savings: 5 },
    { pattern: /I want you to/gi, issue: 'Unnecessary preamble', savings: 4 },
    { pattern: /Can you please/gi, issue: 'Unnecessary preamble', savings: 3 },
    { pattern: /Could you please/gi, issue: 'Unnecessary preamble', savings: 4 },
    { pattern: /please help me/gi, issue: 'Unnecessary preamble', savings: 3 },
  ];

  for (const { pattern, issue, savings } of redundantPhrases) {
    const matches = prompt.match(pattern);
    if (matches && matches.length > 0) {
      const tokenImpact = matches.length * savings;
      redundantTokens += tokenImpact;
      
      issues.push({
        type: 'verbosity' as PromptIssueType,
        severity: tokenImpact > 10 ? 'medium' : 'low',
        description: issue,
        tokenImpact,
      });
    }
  }

  // Check for filler words
  const fillerWords = ['um', 'uh', 'like', 'you know', 'i mean', 'sort of', 'kind of'];
  for (const filler of fillerWords) {
    const regex = new RegExp(`\\b${filler}\\b`, 'gi');
    const matches = prompt.match(regex);
    if (matches && matches.length > 0) {
      fillerTokens += matches.length;
      issues.push({
        type: 'filler-words' as PromptIssueType,
        severity: 'low',
        description: `Filler phrase: "${filler}"`,
        tokenImpact: matches.length,
      });
    }
  }

  // Check for duplicate instructions
  const duplicatePatterns = [
    /\b(please|make sure to|be sure to|don't forget to)\b.*?\b(please|make sure to|be sure to|don't forget to)\b/gi,
    /\b(respond|answer|reply)\s+.*?\b(respond|answer|reply)\b/gi,
    /\b(important|note|remember)\b.*?\b(important|note|remember)\b/gi,
  ];

  for (const pattern of duplicatePatterns) {
    if (pattern.test(prompt)) {
      issues.push({
        type: 'duplicate-instruction' as PromptIssueType,
        severity: 'medium',
        description: 'Duplicate or redundant instructions detected',
        tokenImpact: 10,
      });
      redundantTokens += 10;
    }
  }

  // Check for poor structure
  const paragraphs = prompt.split(/\n\n+/);
  if (paragraphs.length === 1 && prompt.length > 500) {
    issues.push({
      type: 'poor-structure' as PromptIssueType,
      severity: 'medium',
      description: 'Long prompt without paragraph breaks',
      tokenImpact: 0,
    });
    recommendations.push('Add paragraph breaks to improve readability');
  }

  // Check excessive whitespace
  const excessiveSpaces = (prompt.match(/\s{3,}/g) || []).length;
  if (excessiveSpaces > 0) {
    issues.push({
      type: 'poor-structure' as PromptIssueType,
      severity: 'low',
      description: 'Excessive whitespace',
      tokenImpact: excessiveSpaces * 2,
    });
  }

  // Check verbosity (low unique word ratio)
  const words = prompt.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words);
  const uniqueRatio = uniqueWords.size / words.length;
  
  if (words.length > 100 && uniqueRatio < 0.4) {
    issues.push({
      type: 'redundancy' as PromptIssueType,
      severity: 'medium',
      description: 'Prompt may contain repetitive content',
      tokenImpact: Math.round(words.length * 0.1),
    });
    recommendations.push('Consider condensing repetitive sections');
  }

  // Calculate scores
  const instructionTokens = Math.round(totalTokens * 0.3);
  const contextTokens = Math.round(totalTokens * 0.5);

  const wasteScore = Math.min(100, Math.round(((redundantTokens + fillerTokens) / totalTokens) * 100 * 3));
  const qualityScore = Math.max(0, 100 - wasteScore - (issues.filter(i => i.severity === 'high').length * 10) - (issues.filter(i => i.severity === 'medium').length * 5));
  const optimizationScore = Math.min(100, wasteScore + 20);

  // Generate recommendations
  if (wasteScore > 30) {
    recommendations.push('High potential for token reduction through optimization');
  }
  if (issues.filter(i => i.type === 'verbosity').length > 3) {
    recommendations.push('Multiple verbose phrases detected - consider more concise language');
  }
  if (issues.length === 0) {
    recommendations.push('Prompt is well-optimized');
  }

  return {
    qualityScore,
    wasteScore,
    optimizationScore,
    issues,
    recommendations,
    tokenAnalysis: {
      totalTokens,
      instructionTokens,
      contextTokens,
      redundantTokens,
      fillerTokens,
    },
  };
}
