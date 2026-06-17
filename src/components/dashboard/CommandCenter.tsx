import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Zap, 
  Shield, 
  GitBranch, 
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Sparkles,
  ChevronDown,
  RotateCcw,
  Lock,
  Brain
} from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, CardContent, Textarea, Badge } from '../ui';
import { useStore } from '../../store/useStore';
import { runInferraPipeline } from '../../lib/engine/pipeline';
import { AI_MODELS } from '../../lib/models';
import { formatCurrency, formatLatency, formatNumber, formatPercent } from '../../lib/utils';
import type { InferraPipelineResult } from '../../types';

const EXAMPLE_PROMPTS = [
  { label: 'Simple Q&A', prompt: 'What is the capital of France?' },
  { label: 'Code Generation', prompt: 'Write a Python function to calculate the factorial of a number recursively with proper error handling.' },
  { label: 'Summarization', prompt: 'Please help me summarize the key points: AI is transforming healthcare through early disease detection using machine learning algorithms that can analyze medical images with accuracy rivaling expert radiologists.' },
  { label: 'Complex Analysis', prompt: 'I would like you to analyze and compare the economic policies of Keynesian and Austrian schools of thought. Could you please explain their effectiveness during different economic conditions in detail?' },
  { label: 'Creative Writing', prompt: 'Can you please help me write a short poem about a robot discovering emotions for the first time? I need it to be creative and unique.' },
  { label: '🔐 PII Test', prompt: 'My email is john.doe@example.com and my phone is 555-123-4567. My SSN is 123-45-6789. Please help me write a professional bio.' },
  { label: '🔑 Secret Test', prompt: 'Here is my API key: sk-1234567890abcdefghijklmnopqrstuv. And my password is SuperSecret123! How do I store these securely?' },
];

export function CommandCenter() {
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [priority, setPriority] = useState<'cost' | 'speed' | 'quality' | 'balanced'>('balanced');
  const [result, setResult] = useState<InferraPipelineResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'analysis' | 'rewrite' | 'cost' | 'security' | 'routing'>('analysis');
  const { addRequestToHistory, organization } = useStore();

  const handleProcess = async () => {
    if (!prompt.trim()) return;
    setIsProcessing(true);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));

    const pipelineResult = await runInferraPipeline(
      prompt,
      undefined,
      selectedModel || undefined,
      { prioritize: priority },
      {
        piiPolicy: organization?.settings?.piiPolicy || 'sanitize',
        secretPolicy: organization?.settings?.secretPolicy || 'block',
        enableOptimization: organization?.settings?.enableOptimization ?? true,
        enableRouting: organization?.settings?.enableRouting ?? true,
        enableGovernance: organization?.settings?.enableGovernance ?? true,
      }
    );

    setResult(pipelineResult);
    setIsProcessing(false);

    if (pipelineResult.success) {
      addRequestToHistory(prompt, pipelineResult);
    }
  };

  const handleReset = () => {
    setPrompt('');
    setResult(null);
    setActiveTab('analysis');
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Input Panel */}
      <div className="space-y-4">
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap size={18} className="text-yellow-400" />
              Command Center
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Example Prompts */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Try an example:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((ex) => (
                  <button
                    key={ex.label}
                    onClick={() => setPrompt(ex.prompt)}
                    className="px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Input */}
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt here... Try including verbose language or sensitive data to see Inferra in action."
              className="h-40"
            />

            {/* Options Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Model Selection */}
              <div>
                <label className="block text-xs text-gray-500 mb-2">User Selected Model (optional)</label>
                <div className="relative">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full bg-navy-800/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white appearance-none cursor-pointer focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="">Auto-select (Recommended)</option>
                    {AI_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.displayName} - ${model.inputCostPer1k + model.outputCostPer1k}/1K
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs text-gray-500 mb-2">Routing Priority</label>
                <div className="grid grid-cols-4 gap-1">
                  {(['cost', 'speed', 'quality', 'balanced'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`py-2 px-2 rounded-lg text-xs font-medium transition ${
                        priority === p
                          ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleProcess}
                disabled={!prompt.trim() || isProcessing}
                isLoading={isProcessing}
                className="flex-1"
              >
                {isProcessing ? 'Processing...' : (
                  <>
                    <Send size={16} />
                    Analyze & Route
                  </>
                )}
              </Button>
              <Button variant="ghost" onClick={handleReset}>
                <RotateCcw size={16} />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results Panel */}
      <div className="space-y-4">
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card variant="glass" className="h-[500px] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <Brain size={28} className="text-gray-500" />
                  </div>
                  <h4 className="font-semibold text-gray-300 mb-2">Ready to Analyze</h4>
                  <p className="text-sm text-gray-500 max-w-xs">
                    Enter a prompt to see how Inferra analyzes, optimizes, and routes your AI request.
                  </p>
                </div>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Status Banner */}
              <div className={`rounded-xl p-4 ${
                result.blocked 
                  ? 'bg-red-500/10 border border-red-500/30' 
                  : 'bg-green-500/10 border border-green-500/30'
              }`}>
                <div className="flex items-center gap-3">
                  {result.blocked ? (
                    <AlertTriangle size={24} className="text-red-400" />
                  ) : (
                    <CheckCircle size={24} className="text-green-400" />
                  )}
                  <div>
                    <p className={`font-semibold ${result.blocked ? 'text-red-300' : 'text-green-300'}`}>
                      {result.blocked ? 'Request Blocked' : 'Request Approved & Routed'}
                    </p>
                    <p className={`text-sm ${result.blocked ? 'text-red-400/80' : 'text-green-400/80'}`}>
                      {result.blocked ? result.blockReason : `Processed in ${result.processingTimeMs}ms`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              {!result.blocked && (
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <DollarSign size={18} className="mx-auto text-green-400 mb-1" />
                    <p className="text-lg font-bold text-white">{formatCurrency(result.costIntelligence.routedCost.totalCost, 4)}</p>
                    <p className="text-xs text-gray-500">Final Cost</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <TrendingDown size={18} className="mx-auto text-purple-400 mb-1" />
                    <p className="text-lg font-bold text-white">{formatPercent(result.costIntelligence.totalSavings.percentSaved)}</p>
                    <p className="text-xs text-gray-500">Saved</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <Clock size={18} className="mx-auto text-yellow-400 mb-1" />
                    <p className="text-lg font-bold text-white">{formatLatency(result.routing.estimatedLatency)}</p>
                    <p className="text-xs text-gray-500">Est. Latency</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <Sparkles size={18} className="mx-auto text-blue-400 mb-1" />
                    <p className="text-lg font-bold text-white">{result.modelSelection.confidence}%</p>
                    <p className="text-xs text-gray-500">Confidence</p>
                  </div>
                </div>
              )}

              {/* Tab Navigation */}
              <div className="flex gap-2 border-b border-white/10 pb-2">
                {(['analysis', 'rewrite', 'cost', 'security', 'routing'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                      activeTab === tab
                        ? 'bg-purple-500/20 text-purple-300'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <Card variant="glass" padding="none">
                <div className="p-6 max-h-[400px] overflow-y-auto">
                  {activeTab === 'analysis' && <AnalysisTab result={result} />}
                  {activeTab === 'rewrite' && <RewriteTab result={result} originalPrompt={prompt} />}
                  {activeTab === 'cost' && <CostTab result={result} />}
                  {activeTab === 'security' && <SecurityTab result={result} />}
                  {activeTab === 'routing' && <RoutingTab result={result} />}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TrendingDown(props: any) {
  return <DollarSign {...props} />;
}

function AnalysisTab({ result }: { result: InferraPipelineResult }) {
  return (
    <div className="space-y-6">
      {/* Characterization */}
      <div>
        <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <Brain size={16} className="text-blue-400" />
          Prompt Characterization
        </h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-gray-500 text-xs">Task Type</p>
            <p className="text-white font-medium capitalize">{result.characterization.taskCategory.replace('-', ' ')}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-gray-500 text-xs">Complexity</p>
            <p className="text-white font-medium capitalize">{result.characterization.complexity}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-gray-500 text-xs">Intent</p>
            <p className="text-white font-medium capitalize">{result.characterization.intent}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-gray-500 text-xs">Est. Tokens</p>
            <p className="text-white font-medium">{formatNumber(result.characterization.estimatedInputTokens + result.characterization.estimatedOutputTokens)}</p>
          </div>
        </div>
      </div>

      {/* Intelligence */}
      <div>
        <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-purple-400" />
          Prompt Intelligence
        </h4>
        <div className="grid grid-cols-3 gap-3 text-sm mb-3">
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{result.intelligence.qualityScore}</p>
            <p className="text-xs text-gray-500">Quality</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{result.intelligence.wasteScore}</p>
            <p className="text-xs text-gray-500">Waste</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">{result.intelligence.optimizationScore}</p>
            <p className="text-xs text-gray-500">Optimization</p>
          </div>
        </div>
        {result.intelligence.issues.length > 0 && (
          <div className="space-y-2">
            {result.intelligence.issues.slice(0, 3).map((issue, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Badge variant={issue.severity === 'high' ? 'danger' : issue.severity === 'medium' ? 'warning' : 'default'} size="sm">
                  {issue.severity}
                </Badge>
                <span className="text-gray-400">{issue.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Optimization */}
      <div>
        <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <Zap size={16} className="text-yellow-400" />
          Optimization Results
        </h4>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-white">{result.optimization.originalTokens}</p>
            <p className="text-xs text-gray-500">Original</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-green-400">{result.optimization.optimizedTokens}</p>
            <p className="text-xs text-gray-500">Optimized</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-purple-400">-{result.optimization.tokenReductionPercent}%</p>
            <p className="text-xs text-gray-500">Reduction</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RewriteTab({ result, originalPrompt }: { result: InferraPipelineResult; originalPrompt: string }) {
  const originalTokens = Math.ceil(originalPrompt.length / 4);
  const optimizedTokens = Math.ceil(result.optimization.optimizedPrompt.length / 4);
  const rewrittenTokens = Math.ceil(result.modelAwarePrompt.modelOptimizedPrompt.length / 4);
  
  const totalTokensSaved = originalTokens - rewrittenTokens;
  const totalPercentSaved = originalTokens > 0 ? Math.round((totalTokensSaved / originalTokens) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-bold text-white">Model-Aware Rewriting</h4>
            <p className="text-sm text-gray-400">
              Prompt rewritten specifically for <span className="text-purple-300 font-medium">{result.selectedModel.displayName}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-green-400">-{totalPercentSaved}%</p>
            <p className="text-xs text-gray-500">{totalTokensSaved} tokens saved</p>
          </div>
        </div>
      </div>

      {/* Three-Stage Transformation */}
      <div className="space-y-4">
        {/* Stage 1: Original */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-red-500/30 flex items-center justify-center text-xs font-bold text-red-300">1</span>
              <span className="text-sm font-semibold text-red-300">Original Prompt</span>
            </div>
            <Badge variant="danger" size="sm">{originalTokens} tokens</Badge>
          </div>
          <div className="bg-black/20 rounded-lg p-3 max-h-24 overflow-y-auto">
            <p className="text-sm text-gray-300 font-mono whitespace-pre-wrap">{originalPrompt}</p>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
            <Zap size={16} className="text-yellow-400" />
            <span className="text-xs font-medium text-yellow-300">Layer 4: Optimization</span>
            <span className="text-xs text-yellow-400">(-{result.optimization.tokenReductionPercent}%)</span>
          </div>
        </div>

        {/* Stage 2: Optimized */}
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-yellow-500/30 flex items-center justify-center text-xs font-bold text-yellow-300">2</span>
              <span className="text-sm font-semibold text-yellow-300">After Basic Optimization</span>
            </div>
            <Badge variant="warning" size="sm">{optimizedTokens} tokens</Badge>
          </div>
          <div className="bg-black/20 rounded-lg p-3 max-h-24 overflow-y-auto">
            <p className="text-sm text-gray-300 font-mono whitespace-pre-wrap">{result.optimization.optimizedPrompt}</p>
          </div>
          {result.optimization.optimizations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {result.optimization.optimizations.slice(0, 3).map((opt, i) => (
                <span key={i} className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded">
                  {opt.description}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <Sparkles size={16} className="text-purple-400" />
            <span className="text-xs font-medium text-purple-300">Layer 6: Model-Aware Rewrite for {result.selectedModel.displayName}</span>
          </div>
        </div>

        {/* Stage 3: Model-Aware Rewritten */}
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-500/30 flex items-center justify-center text-xs font-bold text-green-300">3</span>
              <span className="text-sm font-semibold text-green-300">Final Model-Optimized Prompt</span>
            </div>
            <Badge variant="success" size="sm">{rewrittenTokens} tokens</Badge>
          </div>
          <div className="bg-black/20 rounded-lg p-3 max-h-32 overflow-y-auto">
            <p className="text-sm text-gray-300 font-mono whitespace-pre-wrap">{result.modelAwarePrompt.modelOptimizedPrompt}</p>
          </div>
          {result.modelAwarePrompt.modifications.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-gray-500 font-medium">Model-Specific Modifications:</p>
              {result.modelAwarePrompt.modifications.map((mod, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-green-400">✓</span>
                  <span className="text-gray-400">{mod.description}</span>
                  <span className="text-gray-500">— {mod.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Model Style Explanation */}
      <div className="bg-white/5 rounded-xl p-4">
        <h5 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
          <Brain size={14} className="text-purple-400" />
          Why {result.selectedModel.displayName}?
        </h5>
        <p className="text-sm text-gray-400">
          {result.selectedModel.promptStyle === 'instruction-following' && 
            `${result.selectedModel.displayName} excels at following direct instructions. The prompt was rewritten to be imperative and clear, removing unnecessary preambles.`}
          {result.selectedModel.promptStyle === 'deep-reasoning' && 
            `${result.selectedModel.displayName} performs best with step-by-step reasoning. The prompt was structured to encourage thorough analysis.`}
          {result.selectedModel.promptStyle === 'long-context' && 
            `${result.selectedModel.displayName} handles massive context windows. The prompt was structured with clear section markers.`}
          {result.selectedModel.promptStyle === 'cost-efficient' && 
            `${result.selectedModel.displayName} is optimized for cost. The prompt was aggressively compressed by removing all unnecessary tokens.`}
          {result.selectedModel.promptStyle === 'conversational' && 
            `${result.selectedModel.displayName} excels at natural conversation. The prompt maintains a conversational tone while being efficient.`}
        </p>
      </div>
    </div>
  );
}

function CostTab({ result }: { result: InferraPipelineResult }) {
  const { originalCost, optimizedCost, routedCost, promptSavings, routingSavings, totalSavings } = result.costIntelligence;

  return (
    <div className="space-y-6">
      {/* Cost Comparison Visual */}
      <div className="space-y-4">
        {/* Original */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-red-300 font-medium">Original Cost ({originalCost.model})</span>
            <span className="text-2xl font-bold text-red-400">{formatCurrency(originalCost.totalCost, 4)}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-red-300/80">
            <span>{formatNumber(originalCost.inputTokens)} input</span>
            <span>{formatNumber(originalCost.outputTokens)} output</span>
            <span>{formatNumber(originalCost.totalTokens)} total</span>
          </div>
        </div>

        {/* Optimized */}
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-yellow-300 font-medium">After Optimization (Same Model)</span>
            <span className="text-2xl font-bold text-yellow-400">{formatCurrency(optimizedCost.totalCost, 4)}</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-yellow-300/80">{formatNumber(optimizedCost.totalTokens)} tokens</span>
            <Badge variant="success" size="sm">-{formatPercent(promptSavings.percentSaved)} prompt savings</Badge>
          </div>
        </div>

        {/* Routed */}
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-green-300 font-medium">After Routing ({routedCost.model})</span>
            <span className="text-2xl font-bold text-green-400">{formatCurrency(routedCost.totalCost, 4)}</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-green-300/80">{formatNumber(routedCost.totalTokens)} tokens</span>
            <Badge variant="success" size="sm">-{formatPercent(routingSavings.percentSaved)} routing savings</Badge>
          </div>
        </div>
      </div>

      {/* Total Savings */}
      <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-xl p-6 text-center">
        <p className="text-sm text-gray-400 mb-2">Total Savings</p>
        <div className="flex items-center justify-center gap-4">
          <div>
            <p className="text-3xl font-bold text-white">{formatCurrency(totalSavings.totalSaved, 4)}</p>
            <p className="text-xs text-gray-500">saved this request</p>
          </div>
          <div className="w-px h-12 bg-white/10" />
          <div>
            <p className="text-3xl font-bold gradient-text">{formatPercent(totalSavings.percentSaved)}</p>
            <p className="text-xs text-gray-500">reduction</p>
          </div>
          <div className="w-px h-12 bg-white/10" />
          <div>
            <p className="text-3xl font-bold text-green-400">{formatCurrency(totalSavings.annualProjection)}</p>
            <p className="text-xs text-gray-500">annual projection</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SecurityTab({ result }: { result: InferraPipelineResult }) {
  const { security } = result;

  return (
    <div className="space-y-6">
      {/* Scores */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-green-400">{security.securityScore}</p>
          <p className="text-xs text-gray-500">Security Score</p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 text-center">
          <p className={`text-3xl font-bold ${security.riskScore > 50 ? 'text-red-400' : security.riskScore > 20 ? 'text-yellow-400' : 'text-green-400'}`}>
            {security.riskScore}
          </p>
          <p className="text-xs text-gray-500">Risk Score</p>
        </div>
      </div>

      {/* Detections */}
      <div className="space-y-4">
        {/* Secrets */}
        <div className={`rounded-xl p-4 ${security.hasSecrets ? 'bg-red-500/10 border border-red-500/20' : 'bg-green-500/10 border border-green-500/20'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Lock size={16} className={security.hasSecrets ? 'text-red-400' : 'text-green-400'} />
            <span className={`text-sm font-medium ${security.hasSecrets ? 'text-red-300' : 'text-green-300'}`}>
              {security.hasSecrets ? 'Secrets Detected!' : 'No Secrets Detected'}
            </span>
          </div>
          {security.hasSecrets && (
            <div className="flex flex-wrap gap-2">
              {security.secretTypes.map((type) => (
                <Badge key={type} variant="danger" size="sm">{type}</Badge>
              ))}
            </div>
          )}
        </div>

        {/* PII */}
        <div className={`rounded-xl p-4 ${security.hasPII ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-green-500/10 border border-green-500/20'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Shield size={16} className={security.hasPII ? 'text-yellow-400' : 'text-green-400'} />
            <span className={`text-sm font-medium ${security.hasPII ? 'text-yellow-300' : 'text-green-300'}`}>
              {security.hasPII ? 'PII Detected' : 'No PII Detected'}
            </span>
          </div>
          {security.hasPII && (
            <div className="flex flex-wrap gap-2">
              {security.piiTypes.map((type) => (
                <Badge key={type} variant="warning" size="sm">{type}</Badge>
              ))}
            </div>
          )}
        </div>

        {/* Compliance */}
        {security.complianceViolations.length > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-orange-400" />
              <span className="text-sm font-medium text-orange-300">Compliance Warnings</span>
            </div>
            <div className="space-y-2">
              {security.complianceViolations.map((v, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Badge variant={v.severity === 'critical' ? 'danger' : 'warning'} size="sm">
                    {v.framework.toUpperCase()}
                  </Badge>
                  <span className="text-gray-400">{v.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RoutingTab({ result }: { result: InferraPipelineResult }) {
  const { modelSelection, routing } = result;

  return (
    <div className="space-y-6">
      {/* Selected Model */}
      <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-purple-500/30 flex items-center justify-center text-2xl font-bold text-purple-300">
            {modelSelection.recommendedModel.displayName.charAt(0)}
          </div>
          <div className="flex-1">
            <p className="text-lg font-bold text-white">{modelSelection.recommendedModel.displayName}</p>
            <p className="text-sm text-gray-400 capitalize">{modelSelection.recommendedModel.provider}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-purple-300">{routing.confidence}%</p>
            <p className="text-xs text-gray-500">confidence</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-gray-400">{modelSelection.reason}</p>
      </div>

      {/* Routing Factors */}
      <div>
        <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <GitBranch size={16} className="text-purple-400" />
          Routing Factors
        </h4>
        <div className="space-y-3">
          {modelSelection.factors.map((factor) => (
            <div key={factor.name} className="bg-white/5 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">{factor.name}</span>
                <span className="text-sm font-medium text-white">{Math.round(factor.score)}/100</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                  style={{ width: `${factor.score}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{factor.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Alternatives */}
      {modelSelection.alternatives.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-3">Alternative Models</h4>
          <div className="space-y-2">
            {modelSelection.alternatives.map((alt) => (
              <div key={alt.model.id} className="bg-white/5 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">{alt.model.displayName}</p>
                  <p className="text-xs text-gray-500">{alt.reason}</p>
                </div>
                <span className="text-sm text-gray-400">{Math.round(alt.score)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
