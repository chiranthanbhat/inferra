import { motion } from 'framer-motion';
import { 
  DollarSign, 
  TrendingDown, 
  Zap, 
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  GitBranch
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui';
import { useStore } from '../../store/useStore';
import { formatCurrency, formatNumber, formatLatency, formatPercent } from '../../lib/utils';

export function Overview() {
  const { stats, organization, requestHistory } = useStore();

  const savingsPercent = stats.totalSpend > 0 
    ? (stats.totalSavings / (stats.totalSpend + stats.totalSavings)) * 100 
    : 0;

  const usagePercent = organization?.planLimits?.requestsPerMonth 
    ? (organization.usage.requestsUsed / organization.planLimits.requestsPerMonth) * 100
    : 0;

  const statCards = [
    {
      title: 'Total Spend',
      value: formatCurrency(stats.totalSpend),
      change: '-32%',
      changeType: 'positive',
      icon: <DollarSign size={20} />,
      color: 'from-green-500 to-emerald-600',
    },
    {
      title: 'Total Savings',
      value: formatCurrency(stats.totalSavings),
      change: `${formatPercent(savingsPercent)} saved`,
      changeType: 'positive',
      icon: <TrendingDown size={20} />,
      color: 'from-purple-500 to-indigo-600',
    },
    {
      title: 'Requests Processed',
      value: formatNumber(stats.totalRequests),
      change: '+12%',
      changeType: 'positive',
      icon: <Activity size={20} />,
      color: 'from-blue-500 to-cyan-600',
    },
    {
      title: 'Avg Latency',
      value: formatLatency(stats.avgLatency),
      change: '-18%',
      changeType: 'positive',
      icon: <Zap size={20} />,
      color: 'from-yellow-500 to-orange-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
          >
            <Card variant="glass" className="hover:border-white/10 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-white shadow-lg`}>
                  {stat.icon}
                </div>
                <div className={`flex items-center gap-1 text-xs font-medium ${
                  stat.changeType === 'positive' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {stat.changeType === 'positive' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                  {stat.change}
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-sm text-gray-400 mt-1">{stat.title}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Usage & Efficiency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Usage */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card variant="glass">
            <CardHeader>
              <CardTitle>Plan Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Requests This Month</span>
                  <span className="text-white font-medium">
                    {formatNumber(organization?.usage?.requestsUsed || 0)} / {formatNumber(organization?.planLimits?.requestsPerMonth || 100)}
                  </span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(usagePercent, 100)}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className={`h-full rounded-full ${
                      usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-yellow-500' : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                    }`}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {formatPercent(usagePercent)} of monthly quota used
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Efficiency Score */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Card variant="glass">
            <CardHeader>
              <CardTitle>Efficiency Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={16} className="text-green-400" />
                    <span className="text-xs text-gray-400">Security Score</span>
                  </div>
                  <p className="text-2xl font-bold text-white">98%</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <GitBranch size={16} className="text-purple-400" />
                    <span className="text-xs text-gray-400">Routing Efficiency</span>
                  </div>
                  <p className="text-2xl font-bold text-white">94%</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown size={16} className="text-blue-400" />
                    <span className="text-xs text-gray-400">Optimization Rate</span>
                  </div>
                  <p className="text-2xl font-bold text-white">42%</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign size={16} className="text-yellow-400" />
                    <span className="text-xs text-gray-400">Cost per Request</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{formatCurrency(stats.avgCostPerRequest, 4)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
      >
        <Card variant="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Requests</CardTitle>
              <button 
                onClick={() => useStore.getState().setDashboardTab('requests')}
                className="text-sm text-purple-400 hover:text-purple-300 transition"
              >
                View All →
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="pb-3 pr-4">Task Type</th>
                    <th className="pb-3 pr-4">Model</th>
                    <th className="pb-3 pr-4">Tokens</th>
                    <th className="pb-3 pr-4">Cost</th>
                    <th className="pb-3 pr-4">Savings</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {requestHistory.slice(0, 5).map((req) => (
                    <tr key={req.id} className="text-sm">
                      <td className="py-3 pr-4 capitalize text-gray-300">
                        {req.result.characterization.taskCategory.replace('-', ' ')}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="px-2 py-1 rounded-lg bg-purple-500/20 text-purple-300 text-xs font-medium">
                          {req.result.selectedModel.displayName}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-400">
                        {formatNumber(req.result.costIntelligence.routedCost.totalTokens)}
                      </td>
                      <td className="py-3 pr-4 text-white font-medium">
                        {formatCurrency(req.result.costIntelligence.routedCost.totalCost, 4)}
                      </td>
                      <td className="py-3 pr-4 text-green-400">
                        {formatCurrency(req.result.costIntelligence.totalSavings.totalSaved, 4)}
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                          ✓ Success
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {requestHistory.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-gray-500">No requests yet. Try the Command Center!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
