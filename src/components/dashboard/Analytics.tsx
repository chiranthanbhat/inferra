import { useStore } from '../../store/useStore';
import { Card, CardHeader, CardTitle, CardContent } from '../ui';
import { formatCurrency, formatNumber, formatPercent } from '../../lib/utils';
import { TrendingDown, DollarSign, Activity, Zap } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];

export function Analytics() {
  const { stats, requestHistory } = useStore();

  // Prepare chart data from request history
  const dailyData = requestHistory.reduce((acc, req) => {
    const date = new Date(req.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!acc[date]) {
      acc[date] = { date, requests: 0, cost: 0, savings: 0, tokens: 0 };
    }
    acc[date].requests += 1;
    acc[date].cost += req.result.costIntelligence.routedCost.totalCost;
    acc[date].savings += req.result.costIntelligence.totalSavings.totalSaved;
    acc[date].tokens += req.result.costIntelligence.routedCost.totalTokens;
    return acc;
  }, {} as Record<string, any>);

  const chartData = Object.values(dailyData).slice(-14);

  // Model distribution
  const modelData = requestHistory.reduce((acc, req) => {
    const model = req.result.selectedModel.displayName;
    acc[model] = (acc[model] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const modelChartData = Object.entries(modelData)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Task type distribution
  const taskData = requestHistory.reduce((acc, req) => {
    const task = req.result.characterization.taskCategory;
    acc[task] = (acc[task] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const taskChartData = Object.entries(taskData)
    .map(([name, value]) => ({ name: name.replace('-', ' '), value }))
    .sort((a, b) => b.value - a.value);

  // Calculate metrics
  const avgTokensPerRequest = stats.totalRequests > 0 ? Math.round(stats.totalTokens / stats.totalRequests) : 0;
  const savingsRate = stats.totalSpend > 0 
    ? (stats.totalSavings / (stats.totalSpend + stats.totalSavings)) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="glass">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <TrendingDown size={20} className="text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Savings Rate</p>
                <p className="text-2xl font-bold text-white">{formatPercent(savingsRate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Activity size={20} className="text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Avg Tokens/Request</p>
                <p className="text-2xl font-bold text-white">{formatNumber(avgTokensPerRequest)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <DollarSign size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Avg Cost/Request</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(stats.avgCostPerRequest, 4)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Zap size={20} className="text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Avg Latency</p>
                <p className="text-2xl font-bold text-white">{Math.round(stats.avgLatency)}ms</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Trend */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Daily Activity (Last 14 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                  />
                  <Area type="monotone" dataKey="requests" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorRequests)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Model Distribution */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Model Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center">
              <ResponsiveContainer width="50%" height="100%">
                <PieChart>
                  <Pie
                    data={modelChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {modelChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {modelChartData.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-400 truncate max-w-[120px]">{item.name}</span>
                    </div>
                    <span className="text-white font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task Distribution */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Task Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taskChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9ca3af" angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Cost & Savings */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Cost vs Savings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={(v) => `$${v.toFixed(2)}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  />
                  <Bar dataKey="cost" fill="#ef4444" name="Cost" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="savings" fill="#10b981" name="Savings" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
