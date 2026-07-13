// ============================================
// SERVER-SIDE PROVIDER CALLS
// Provider API keys come from environment secrets and never leave the server.
// Anthropic / OpenAI / Google / DeepSeek / xAI / Mistral / OpenRouter supported.
// ============================================

import { HttpsError } from 'firebase-functions/v2/https';

export type Provider = 'openai' | 'anthropic' | 'google' | 'xai' | 'deepseek' | 'mistral' | 'openrouter' | 'opensource';

export interface Turn { role: 'user' | 'assistant'; content: string }
export interface ProviderReply { content: string; inputTokens: number; outputTokens: number }

function keyFor(provider: Provider): string {
  const env: Record<Provider, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    google: process.env.GOOGLE_API_KEY,
    xai: process.env.XAI_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
    mistral: process.env.MISTRAL_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    opensource: process.env.OPENROUTER_API_KEY,
  };
  const key = env[provider];
  if (!key) {
    throw new HttpsError('failed-precondition', `The ${provider} provider is not configured on the server.`);
  }
  return key;
}

const OPENAI_COMPAT: Partial<Record<Provider, string>> = {
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  xai: 'https://api.x.ai/v1',
  mistral: 'https://api.mistral.ai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  opensource: 'https://openrouter.ai/api/v1',
};

const est = (s: string) => Math.max(1, Math.ceil((s || '').length / 4));

export async function callProvider(provider: Provider, modelName: string, history: Turn[]): Promise<ProviderReply> {
  const apiKey = keyFor(provider);

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: modelName, max_tokens: 1024, messages: history }),
    });
    if (!res.ok) throw new HttpsError('internal', `Anthropic: ${await errText(res)}`);
    const d: any = await res.json();
    const content = (d.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n') || '(empty response)';
    return { content, inputTokens: d.usage?.input_tokens ?? est(history.map((m) => m.content).join(' ')), outputTokens: d.usage?.output_tokens ?? est(content) };
  }

  if (provider === 'google') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: history.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })) }),
    });
    if (!res.ok) throw new HttpsError('internal', `Google: ${await errText(res)}`);
    const d: any = await res.json();
    const content = d.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '(empty response)';
    return { content, inputTokens: d.usageMetadata?.promptTokenCount ?? est(history.map((m) => m.content).join(' ')), outputTokens: d.usageMetadata?.candidatesTokenCount ?? est(content) };
  }

  const base = OPENAI_COMPAT[provider] || OPENAI_COMPAT.openrouter!;
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: modelName, messages: history, max_tokens: 1024 }),
  });
  if (!res.ok) throw new HttpsError('internal', `${provider}: ${await errText(res)}`);
  const d: any = await res.json();
  const content = d.choices?.[0]?.message?.content || '(empty response)';
  return { content, inputTokens: d.usage?.prompt_tokens ?? est(history.map((m) => m.content).join(' ')), outputTokens: d.usage?.completion_tokens ?? est(content) };
}

async function errText(res: Response): Promise<string> {
  try {
    const j: any = await res.json();
    return `${res.status} ${j?.error?.message || JSON.stringify(j).slice(0, 160)}`;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}
