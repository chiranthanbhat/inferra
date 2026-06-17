import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '../ui';
import { Shield, Zap, DollarSign, Key, Bell, Eye, EyeOff, Copy, Check } from 'lucide-react';

export function Settings() {
  const { organization } = useStore();
  const [activeTab, setActiveTab] = useState<'general' | 'routing' | 'security' | 'api'>('general');
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const tabs = [
    { id: 'general', label: 'General', icon: <Zap size={18} /> },
    { id: 'routing', label: 'Routing', icon: <DollarSign size={18} /> },
    { id: 'security', label: 'Security', icon: <Shield size={18} /> },
    { id: 'api', label: 'API Keys', icon: <Key size={18} /> },
  ];

  const copyApiKey = () => {
    navigator.clipboard.writeText('inf_prod_sk_live_1234567890abcdefghijklmnop');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === tab.id
                ? 'bg-inferra-500/20 text-inferra-300 border border-inferra-500/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* General Settings */}
      {activeTab === 'general' && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Organization Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Organization Name
              </label>
              <Input
                defaultValue={organization?.name}
                placeholder="Your organization name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Current Plan
              </label>
              <div className="flex items-center gap-3">
                <span className="px-4 py-2 bg-inferra-500/20 text-inferra-300 rounded-xl font-semibold capitalize border border-inferra-500/30">
                  {organization?.plan || 'free'} Plan
                </span>
                <Button variant="outline" size="sm">Upgrade</Button>
              </div>
            </div>

            <div className="pt-6 border-t border-white/10">
              <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Bell size={18} className="text-gray-400" />
                Notifications
              </h4>
              <div className="space-y-4">
                {[
                  { label: 'Budget alerts', desc: 'Get notified when spending reaches thresholds', checked: true },
                  { label: 'Security alerts', desc: 'Notifications for PII or secret detection', checked: true },
                  { label: 'Weekly reports', desc: 'Receive weekly usage summaries', checked: false },
                ].map((item) => (
                  <label key={item.label} className="flex items-center justify-between cursor-pointer group">
                    <div>
                      <p className="font-medium text-gray-300 group-hover:text-white transition">{item.label}</p>
                      <p className="text-sm text-gray-500">{item.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked={item.checked}
                      className="w-5 h-5 rounded border-gray-600 bg-navy-800 text-inferra-500 focus:ring-inferra-500/50"
                    />
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Routing Settings */}
      {activeTab === 'routing' && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Routing Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Default Routing Priority
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['cost', 'speed', 'quality', 'balanced'].map((priority) => (
                  <button
                    key={priority}
                    className={`p-4 rounded-xl border-2 text-center transition ${
                      (organization?.settings as any)?.defaultPriority === priority
                        ? 'border-inferra-500 bg-inferra-500/20'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <p className="font-semibold capitalize text-white">{priority}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {priority === 'cost' && 'Minimize cost'}
                      {priority === 'speed' && 'Fastest response'}
                      {priority === 'quality' && 'Best output'}
                      {priority === 'balanced' && 'Optimize all'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-white/10">
              <h4 className="font-semibold text-white mb-4">Cost Limits</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Max Cost per Request
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <Input defaultValue="1.00" className="pl-7" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Daily Budget
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <Input defaultValue="100" className="pl-7" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Monthly Budget
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <Input defaultValue="2000" className="pl-7" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Settings */}
      {activeTab === 'security' && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Security & Compliance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                PII Policy
              </label>
              <div className="space-y-3">
                {[
                  { value: 'block', label: 'Block', desc: 'Block requests containing PII' },
                  { value: 'sanitize', label: 'Sanitize', desc: 'Automatically mask PII before sending' },
                  { value: 'warn', label: 'Warn', desc: 'Allow but flag in analytics' },
                  { value: 'allow', label: 'Allow', desc: 'No PII restrictions' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${
                      organization?.settings?.piiPolicy === option.value
                        ? 'border-inferra-500 bg-inferra-500/20'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pii-policy"
                      defaultChecked={organization?.settings?.piiPolicy === option.value}
                      className="w-4 h-4 text-inferra-500 focus:ring-inferra-500/50"
                    />
                    <div>
                      <p className="font-medium text-white">{option.label}</p>
                      <p className="text-sm text-gray-500">{option.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-white/10">
              <h4 className="font-semibold text-white mb-4">Compliance Frameworks</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {['GDPR', 'HIPAA', 'PCI-DSS', 'SOX', 'CCPA', 'ISO 27001'].map((framework) => (
                  <label
                    key={framework}
                    className="flex items-center gap-2 p-3 rounded-xl border border-white/10 hover:border-white/20 cursor-pointer transition"
                  >
                    <input
                      type="checkbox"
                      defaultChecked={['GDPR', 'HIPAA'].includes(framework)}
                      className="w-4 h-4 rounded border-gray-600 bg-navy-800 text-inferra-500 focus:ring-inferra-500/50"
                    />
                    <span className="text-sm font-medium text-gray-300">{framework}</span>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Keys */}
      {activeTab === 'api' && (
        <Card variant="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>API Keys</CardTitle>
              <Button size="sm">+ Create New Key</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {(organization as any)?.apiKeys?.map((key: any) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <Key size={18} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{key.name}</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm text-gray-400 font-mono">
                        {showKey ? 'inf_prod_sk_live_1234567890abcdefghijklmnop' : key.prefix}
                      </code>
                      <button
                        onClick={() => setShowKey(!showKey)}
                        className="p-1 hover:bg-white/10 rounded transition"
                      >
                        {showKey ? <EyeOff size={14} className="text-gray-400" /> : <Eye size={14} className="text-gray-400" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyApiKey}
                    className="p-2 hover:bg-white/10 rounded-lg transition"
                  >
                    {copied ? (
                      <Check size={18} className="text-green-400" />
                    ) : (
                      <Copy size={18} className="text-gray-400" />
                    )}
                  </button>
                  <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                    Revoke
                  </Button>
                </div>
              </div>
            ))}

            <div className="pt-6 border-t border-white/10">
              <h4 className="font-semibold text-white mb-3">Quick Integration</h4>
              <div className="bg-navy-900 rounded-xl p-4 border border-white/10">
                <pre className="text-xs text-gray-300 overflow-x-auto">
{`// Replace your AI provider URLs with Inferra
const response = await fetch('https://api.inferra.io/v1/chat/completions', {
  headers: { 'Authorization': 'Bearer inf_prod_sk_...' },
  body: JSON.stringify({ prompt: '...' })
})`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-6 border-t border-white/10">
        <Button className="px-8">
          Save Changes
        </Button>
      </div>
    </div>
  );
}
