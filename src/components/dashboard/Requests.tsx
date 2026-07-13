import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { formatDate } from '../../lib/utils';
import { Search, Filter, ChevronDown, ChevronRight, Shield, Zap, Clock } from 'lucide-react';
import type { InferraPipelineResult } from '../../types';

export function Requests() {
  const { requestHistory } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterModel, setFilterModel] = useState<string>('all');

  // Get unique models for filter
  const models = [...new Set(requestHistory.map(r => r.result.selectedModel.id))];

  // Filter requests
  const filteredRequests = requestHistory.filter(req => {
    const matchesSearch = searchTerm === '' || 
      req.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.result.characterization.taskCategory.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesModel = filterModel === 'all' || req.result.selectedModel.id === filterModel;
    
    return matchesSearch && matchesModel;
  });

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="text"
            placeholder="Search by ID or task type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-white/10 bg-navy-800/50 text-white placeholder-ink-3 focus:outline-none focus:ring-2 focus:ring-inferra-500/20 focus:border-inferra-500"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <select
              value={filterModel}
              onChange={(e) => setFilterModel(e.target.value)}
              className="h-11 pl-9 pr-10 rounded-xl border border-white/10 bg-navy-800/50 text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-inferra-500/20 focus:border-inferra-500"
            >
              <option value="all">All Models</option>
              {models.map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-ink-3">
        Showing {filteredRequests.length} of {requestHistory.length} requests
      </p>

      {/* Request List */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="divide-y divide-white/5">
          {filteredRequests.slice(0, 50).map((req) => (
            <RequestRow 
              key={req.id} 
              request={req.result}
              originalPrompt={req.prompt}
              expanded={expandedId === req.id}
              onToggle={() => setExpandedId(expandedId === req.id ? null : req.id)}
            />
          ))}
        </div>
        {filteredRequests.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-ink-3">No requests found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RequestRow({ 
  request,
  originalPrompt,
  expanded, 
  onToggle 
}: { 
  request: InferraPipelineResult;
  originalPrompt: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="hover:bg-white/5">
      <div 
        className="p-4 flex items-center gap-4 cursor-pointer"
        onClick={onToggle}
      >
        <button className="p-1 hover:bg-white/10 rounded">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <code className="text-xs bg-white/10 px-2 py-1 rounded font-mono text-ink-3">
              {request.requestId.slice(0, 16)}
            </code>
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-inferra-500/20 text-inferra-300 text-xs font-medium">
              {request.selectedModel.displayName}
            </span>
            <span className="text-xs text-ink-3 capitalize">
              {request.characterization.taskCategory.replace('-', ' ')}
            </span>
          </div>
          <p className="text-sm text-ink-3 truncate">
            {originalPrompt.slice(0, 100)}{originalPrompt.length > 100 ? '...' : ''}
          </p>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div className="text-right">
            <p className="font-semibold text-white">${request.costIntelligence.routedCost.totalCost.toFixed(4)}</p>
            <p className="text-xs text-ink-3">cost</p>
          </div>
          <div className="text-right">
            <p className="font-medium text-ink-2">{request.processingTimeMs}ms</p>
            <p className="text-xs text-ink-3">latency</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-3">
              {formatDate(new Date(request.timestamp))}
            </p>
          </div>
          <span className="inline-flex items-center px-2 py-1 rounded-full bg-success-500/15 text-success-400 text-xs font-medium">
            ✓ Success
          </span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pl-12 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Analysis Card */}
            <div className="bg-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink-2 mb-3">
                <Zap size={16} className="text-amber-400" />
                Analysis
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-3">Task Type</span>
                  <span className="font-medium capitalize">{request.characterization.taskCategory.replace('-', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Complexity</span>
                  <span className="font-medium capitalize">{request.characterization.complexity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Requires Reasoning</span>
                  <span className="font-medium">{request.characterization.requiresReasoning ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Contains Code</span>
                  <span className="font-medium">{request.characterization.containsCode ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>

            {/* Security Card */}
            <div className="bg-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink-2 mb-3">
                <Shield size={16} className="text-success-400" />
                Security Scan
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-3">PII Detected</span>
                  <span className={`font-medium ${request.security.hasPII ? 'text-amber-400' : 'text-success-400'}`}>
                    {request.security.hasPII ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Secrets Detected</span>
                  <span className={`font-medium ${request.security.hasSecrets ? 'text-error-400' : 'text-success-400'}`}>
                    {request.security.hasSecrets ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Risk Score</span>
                  <span className="font-medium">{request.security.riskScore}/100</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Status</span>
                  <span className="font-medium text-success-400">Passed</span>
                </div>
              </div>
            </div>

            {/* Routing Card */}
            <div className="bg-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink-2 mb-3">
                <Clock size={16} className="text-inferra-400" />
                Routing Decision
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-3">Selected Model</span>
                  <span className="font-medium">{request.selectedModel.displayName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Confidence</span>
                  <span className="font-medium">{request.routing.confidence}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Est. Cost</span>
                  <span className="font-medium">${request.routing.estimatedCost.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Est. Latency</span>
                  <span className="font-medium">{request.routing.estimatedLatency}ms</span>
                </div>
              </div>
            </div>
          </div>

          {/* Routing Reason */}
          <div className="bg-inferra-500/10 rounded-xl p-4 border border-inferra-500/20">
            <p className="text-sm text-inferra-300">
              <strong>Routing Path:</strong> {request.routing.routingPath}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
