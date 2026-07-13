// ============================================
// PROVIDER DISPLAY METADATA (client-safe)
// Provider API keys and the actual model calls now live SERVER-SIDE in Cloud
// Functions (functions/src/providers.ts). The browser only needs labels/colors
// for rendering — it never sees a key. See PRODUCTION_SETUP.md.
// ============================================

import type { AIModel, AIProvider } from '../types';

export interface ProviderMeta {
  label: string;
}

export const PROVIDER_META: Record<AIProvider, ProviderMeta> = {
  openai: { label: 'OpenAI' },
  anthropic: { label: 'Anthropic' },
  google: { label: 'Google AI' },
  xai: { label: 'xAI' },
  deepseek: { label: 'DeepSeek' },
  mistral: { label: 'Mistral' },
  openrouter: { label: 'OpenRouter' },
  opensource: { label: 'OpenRouter' },
};

// Which provider actually serves a given model (open-source models via OpenRouter).
export function keyProviderFor(model: AIModel): AIProvider {
  return model.provider === 'opensource' ? 'openrouter' : model.provider;
}
