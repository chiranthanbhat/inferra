import { Card, CardContent, Button, Badge } from '../ui';
import { Key, Link, ExternalLink, Zap } from 'lucide-react';

interface AIProvider {
  id: string;
  name: string;
  icon: string;
  color: string;
  chatUrl: string;
  apiKeyField: string;
  description: string;
}

const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🟢',
    color: 'from-green-500 to-emerald-600',
    chatUrl: 'https://chat.openai.com',
    apiKeyField: 'OpenAI API Key',
    description: 'GPT-4o, GPT-4o Mini, o1, o3-mini',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: '🟠',
    color: 'from-orange-500 to-amber-600',
    chatUrl: 'https://claude.ai',
    apiKeyField: 'Anthropic API Key',
    description: 'Claude 3.5 Sonnet, Opus, Haiku',
  },
  {
    id: 'google',
    name: 'Google',
    icon: '🔵',
    color: 'from-blue-500 to-cyan-600',
    chatUrl: 'https://gemini.google.com',
    apiKeyField: 'Google API Key',
    description: 'Gemini 2.0 Flash, 1.5 Pro',
  },
  {
    id: 'xai',
    name: 'xAI',
    icon: '⚫',
    color: 'from-gray-700 to-gray-900',
    chatUrl: 'https://grok.x.ai',
    apiKeyField: 'xAI API Key',
    description: 'Grok 2, Grok 2 Vision',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: '🟣',
    color: 'from-cyan-600 to-blue-700',
    chatUrl: 'https://chat.deepseek.com',
    apiKeyField: 'DeepSeek API Key',
    description: 'DeepSeek V3, R1 Reasoner',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    icon: '🔷',
    color: 'from-sky-500 to-blue-700',
    chatUrl: 'https://chat.mistral.ai',
    apiKeyField: 'Mistral API Key',
    description: 'Mistral Large, Small, Codestral',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: '🌐',
    color: 'from-brand-500 to-accent-600',
    chatUrl: 'https://openrouter.ai',
    apiKeyField: 'OpenRouter API Key',
    description: 'Access to 100+ models',
  },
];

export function Integrations() {
  // Provider keys are managed server-side (Cloud Functions secrets) — Inferra
  // calls every model on your behalf, so there are no keys to enter here.
  const openProviderChat = (providerId: string) => {
    const provider = AI_PROVIDERS.find((p) => p.id === providerId);
    if (provider) window.open(provider.chatUrl, '_blank', 'noopener');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">AI Provider Integrations</h2>
        <p className="text-ink-2">
          Connect your AI provider accounts. After Inferra optimizes your prompt, send it directly to your preferred AI chat.
        </p>
      </div>

      {/* How It Works */}
      <Card variant="glass">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-inferra-500/20 flex items-center justify-center flex-shrink-0">
              <Zap size={24} className="text-inferra-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-2">How It Works</h3>
              <ol className="space-y-2 text-sm text-ink-2">
                <li className="flex items-start gap-2">
                  <span className="text-inferra-400 font-bold">1.</span>
                  <span>Enter your prompt in the Command Center</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-inferra-400 font-bold">2.</span>
                  <span>Inferra analyzes, optimizes, and routes to the best model</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-inferra-400 font-bold">3.</span>
                  <span>Click "Send to AI" for your connected provider</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-inferra-400 font-bold">4.</span>
                  <span>The optimized prompt opens in your AI chat - just press Enter!</span>
                </li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {AI_PROVIDERS.map((provider) => (
          <Card key={provider.id} variant="glass">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${provider.color} flex items-center justify-center text-2xl`}>
                    {provider.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{provider.name}</h3>
                    <p className="text-xs text-ink-3">{provider.description}</p>
                  </div>
                </div>
                <Badge variant="success" size="sm">Active</Badge>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-ink-3">
                  <Key size={12} className="text-brand-300" />
                  <span>Managed by Inferra — no key required</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openProviderChat(provider.id)}
                  className="w-full"
                >
                  <ExternalLink size={14} className="mr-1" />
                  Open {provider.name}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Note */}
      <Card variant="glass">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Link size={18} className="text-blue-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-white mb-2">About Direct Integration</h4>
              <p className="text-sm text-ink-2">
                Due to security restrictions, most AI providers don't allow URL-based prompt pre-filling. 
                When you click "Send to AI", Inferra will:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-ink-3 list-disc list-inside">
                <li>Open your AI provider's chat in a new tab</li>
                <li>Automatically copy the optimized prompt to your clipboard</li>
                <li>You simply paste (Ctrl+V) and press Enter!</li>
              </ul>
              <p className="mt-3 text-xs text-ink-3">
                For enterprise customers, we offer direct API integration that sends prompts automatically without manual copy-paste. 
                Contact sales for details.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
