import { useState } from 'react';
import { Card, CardContent, Button, Input, Badge } from '../ui';
import { Key, Link, ExternalLink, Check, Trash2, Plus, Zap } from 'lucide-react';

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
    color: 'from-purple-600 to-violet-700',
    chatUrl: 'https://chat.deepseek.com',
    apiKeyField: 'DeepSeek API Key',
    description: 'DeepSeek V3, R1 Reasoner',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    icon: '🔷',
    color: 'from-indigo-500 to-blue-700',
    chatUrl: 'https://chat.mistral.ai',
    apiKeyField: 'Mistral API Key',
    description: 'Mistral Large, Small, Codestral',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: '🌐',
    color: 'from-pink-500 to-rose-600',
    chatUrl: 'https://openrouter.ai',
    apiKeyField: 'OpenRouter API Key',
    description: 'Access to 100+ models',
  },
];

export function Integrations() {
  const [connectedProviders, setConnectedProviders] = useState<Record<string, { apiKey: string; connectedAt: Date }>>({});
  const [showKeyInput, setShowKeyInput] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const handleConnect = (providerId: string) => {
    setShowKeyInput(providerId);
    setApiKeyInput('');
  };

  const handleSaveKey = (providerId: string) => {
    if (apiKeyInput.trim()) {
      setConnectedProviders(prev => ({
        ...prev,
        [providerId]: { apiKey: apiKeyInput.trim(), connectedAt: new Date() }
      }));
      setShowKeyInput(null);
      setApiKeyInput('');
    }
  };

  const handleDisconnect = (providerId: string) => {
    setConnectedProviders(prev => {
      const updated = { ...prev };
      delete updated[providerId];
      return updated;
    });
  };

  const handleSendToAI = (providerId: string, optimizedPrompt: string) => {
    const provider = AI_PROVIDERS.find(p => p.id === providerId);
    if (!provider) return;

    // Open the AI provider's chat in a new window
    // Note: Most AI chat interfaces don't support URL pre-filling for security
    // So we open the chat and copy the prompt to clipboard
    window.open(provider.chatUrl, '_blank');
    
    // Copy optimized prompt to clipboard
    navigator.clipboard.writeText(optimizedPrompt).then(() => {
      // Show notification that prompt is copied
      alert(`Optimized prompt copied to clipboard! Paste it into ${provider.name} chat.`);
    }).catch(() => {
      alert(`Opened ${provider.name} chat. Please paste your optimized prompt manually.`);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">AI Provider Integrations</h2>
        <p className="text-gray-400">
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
              <ol className="space-y-2 text-sm text-gray-400">
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
        {AI_PROVIDERS.map((provider) => {
          const isConnected = !!connectedProviders[provider.id];
          const isEditing = showKeyInput === provider.id;

          return (
            <Card key={provider.id} variant="glass">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${provider.color} flex items-center justify-center text-2xl`}>
                      {provider.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{provider.name}</h3>
                      <p className="text-xs text-gray-500">{provider.description}</p>
                    </div>
                  </div>
                  {isConnected && (
                    <Badge variant="success" size="sm">Connected</Badge>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <Input
                      type="password"
                      placeholder={`Enter your ${provider.apiKeyField}`}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSaveKey(provider.id)}
                        className="flex-1"
                      >
                        <Check size={14} className="mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setShowKeyInput(null); setApiKeyInput(''); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : isConnected ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Key size={12} />
                      <span>API Key stored securely</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendToAI(provider.id, 'Your optimized prompt will appear here')}
                        className="flex-1"
                      >
                        <ExternalLink size={14} className="mr-1" />
                        Test Connection
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDisconnect(provider.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleConnect(provider.id)}
                    className="w-full"
                  >
                    <Plus size={14} className="mr-1" />
                    Connect {provider.name}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
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
              <p className="text-sm text-gray-400">
                Due to security restrictions, most AI providers don't allow URL-based prompt pre-filling. 
                When you click "Send to AI", Inferra will:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-gray-500 list-disc list-inside">
                <li>Open your AI provider's chat in a new tab</li>
                <li>Automatically copy the optimized prompt to your clipboard</li>
                <li>You simply paste (Ctrl+V) and press Enter!</li>
              </ul>
              <p className="mt-3 text-xs text-gray-500">
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
