import type { PromptOptimization, OptimizationAction } from '../../types';

export function optimizePrompt(input: string): PromptOptimization {
  const originalPrompt = input;
  const originalTokens = Math.ceil(input.length / 4);
  let p = input;
  const opts: OptimizationAction[] = [];

  function save(before: string, desc: string) {
    if (before !== p) {
      const saved = Math.ceil((before.length - p.length) / 4);
      if (saved > 0) opts.push({ type: 'optimization', description: desc, tokensSaved: saved });
    }
  }

  // ---- STAGE 1: Strip opening preambles (longest first) ----
  const openers = [
    'I would appreciate it if you could ',
    'I would appreciate if you could ',
    'I would like you to please ',
    'I would like you to ',
    'I would like to ask you to ',
    'I want you to please ',
    'I want you to ',
    'I need you to please ',
    'I need you to ',
    'I would like to ',
    "I'd like you to ",
    "I'd like to ",
    "I'm looking for help with ",
    "I'm looking for ",
    "I'm trying to ",
    'I need to ',
    'I want to ',
    'Can you please help me to ',
    'Can you please help me ',
    'Can you please ',
    'Can you help me to ',
    'Can you help me ',
    'Can you ',
    'Could you please help me to ',
    'Could you please help me ',
    'Could you please ',
    'Could you help me to ',
    'Could you help me ',
    'Could you ',
    'Would you please help me to ',
    'Would you please help me ',
    'Would you please ',
    'Would you help me to ',
    'Would you help me ',
    'Would you ',
    'Will you please ',
    'Will you ',
    'Please help me to ',
    'Please help me ',
    'Help me to ',
    'Help me ',
    'Please kindly ',
    'Kindly ',
    'Please ',
  ];

  const trimmed = p.trimStart();
  for (const opener of openers) {
    if (trimmed.toLowerCase().startsWith(opener.toLowerCase())) {
      const before = p;
      const leadingWhitespace = p.length - trimmed.length;
      p = p.substring(leadingWhitespace + opener.length);
      save(before, 'Removed "' + opener.trim() + '"');
      break;
    }
  }

  // ---- STAGE 2: Strip closing phrases ----
  const closings = [
    ' Thank you in advance.',
    ' Thank you in advance',
    ' Thanks in advance.',
    ' Thanks in advance',
    ' Thank you.',
    ' Thank you',
    ' Thanks.',
    ' Thanks',
    ' I appreciate your help.',
    ' I appreciate your help',
    ' I look forward to your response.',
    ' I look forward to your response',
  ];
  for (const c of closings) {
    if (p.toLowerCase().endsWith(c.toLowerCase())) {
      const before = p;
      p = p.substring(0, p.length - c.length);
      save(before, 'Removed closing phrase');
      break;
    }
  }

  // ---- STAGE 3: Compress verbose phrases ----
  const verbose: [string, string][] = [
    ['in order to', 'to'],
    ['due to the fact that', 'because'],
    ['at this point in time', 'now'],
    ['in the event that', 'if'],
    ['for the purpose of', 'for'],
    ['with regard to', 'about'],
    ['in spite of the fact that', 'although'],
    ['it is important to note that ', ''],
    ['it should be noted that ', ''],
    ['it goes without saying that ', ''],
    ['as a matter of fact, ', ''],
    ['as a matter of fact ', ''],
    ['what I mean is ', ''],
    ['the thing is ', ''],
    ['prior to', 'before'],
    ['subsequent to', 'after'],
    ['with the exception of', 'except'],
    ['in addition to', 'besides'],
    ['for the most part', 'mostly'],
    ['by means of', 'by'],
    ['at the present time', 'now'],
    ['in the near future', 'soon'],
    ['in conclusion, ', ''],
    ['in conclusion ', ''],
    ['to sum up, ', ''],
    ['to sum up ', ''],
    ['in summary, ', ''],
    ['in summary ', ''],
  ];

  for (const [from, to] of verbose) {
    // lowercase
    let before = p;
    while (p.includes(from)) p = p.replace(from, to);
    save(before, 'Compressed "' + from + '"');
    // capitalized
    const cap = from.charAt(0).toUpperCase() + from.slice(1);
    before = p;
    while (p.includes(cap)) p = p.replace(cap, to.charAt(0).toUpperCase() + to.slice(1));
    save(before, 'Compressed "' + cap + '"');
  }

  // ---- STAGE 4: Remove filler words ----
  const fillers = [
    'basically', 'essentially', 'actually', 'literally', 'obviously',
    'clearly', 'simply', 'really', 'very', 'quite', 'rather', 'just',
  ];

  for (const word of fillers) {
    let before = p;
    // " word " -> " "
    while (p.includes(' ' + word + ' ')) p = p.replace(' ' + word + ' ', ' ');
    // " word, " -> " "
    while (p.includes(' ' + word + ', ')) p = p.replace(' ' + word + ', ', ' ');
    // ", word " -> " "
    while (p.includes(', ' + word + ' ')) p = p.replace(', ' + word + ' ', ' ');
    save(before, 'Removed "' + word + '"');
  }

  // ---- STAGE 5: Clean up whitespace ----
  const beforeClean = p;
  while (p.includes('  ')) p = p.replace('  ', ' ');
  p = p.replace(' .', '.').replace(' ,', ',').replace(' !', '!').replace(' ?', '?');
  p = p.trim();
  save(beforeClean, 'Cleaned whitespace');

  // ---- Calculate metrics ----
  const optimizedTokens = Math.ceil(p.length / 4);
  const tokensSaved = Math.max(0, originalTokens - optimizedTokens);
  const tokenReductionPercent = originalTokens > 0 ? Math.round((tokensSaved / originalTokens) * 100) : 0;
  const optimizationScore = Math.min(100, tokenReductionPercent * 2 + opts.length * 5);

  if (opts.length === 0) {
    opts.push({ type: 'assessment', description: 'Prompt already well-optimized', tokensSaved: 0 });
  }

  return {
    originalPrompt,
    optimizedPrompt: p,
    originalTokens,
    optimizedTokens,
    tokensSaved,
    tokenReductionPercent,
    optimizationScore,
    optimizations: opts,
  };
}
