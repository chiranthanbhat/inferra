import { useStore } from '../../store/useStore';
import { Card, CardHeader, CardContent, Button } from '../ui';
import { formatCurrency } from '../../lib/utils';
import { Users, DollarSign, Activity, Plus } from 'lucide-react';

export function Teams() {
  const { teams } = useStore();

  // Calculate team stats
  const teamStats = teams.map(team => {
    const memberCount = team.memberIds?.length || 0;
    return {
      ...team,
      memberCount,
      budgetUsed: team.budget ? 0 : 0, // Would calculate from actual usage
      budgetPercent: team.budget ? 0 : 0,
    };
  });

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card variant="glass">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Users size={20} className="text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Teams</p>
                <p className="text-2xl font-bold text-white">{teams.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Activity size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Members</p>
                <p className="text-2xl font-bold text-white">
                  {teams.reduce((sum, t) => sum + (t.memberIds?.length || 0), 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <DollarSign size={20} className="text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Budget</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(teams.reduce((sum, t) => sum + (t.budget || 0), 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {teamStats.map((team) => (
          <Card key={team.id} variant="glass">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-inferra-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                    {team.name?.charAt(0) || 'T'}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{team.name}</h3>
                    <p className="text-sm text-gray-400">{team.description || 'No description'}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm">Manage</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Members</p>
                  <p className="text-lg font-semibold text-white">{team.memberCount}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Budget</p>
                  <p className="text-lg font-semibold text-white">
                    {team.budget ? formatCurrency(team.budget) : 'Unlimited'}
                  </p>
                </div>
              </div>

              {/* Budget Progress */}
              {team.budget && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-gray-500">Budget Usage</span>
                    <span className="text-gray-400">
                      {formatCurrency(team.budgetUsed)} / {formatCurrency(team.budget)}
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        team.budgetPercent > 90 ? 'bg-red-500' :
                        team.budgetPercent > 70 ? 'bg-amber-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${team.budgetPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Members Preview */}
              <div className="pt-4 border-t border-white/5">
                <p className="text-xs text-gray-500 mb-3">Team Members</p>
                <div className="flex -space-x-2">
                  {(team.memberIds || []).slice(0, 5).map((memberId, i) => (
                    <div 
                      key={memberId}
                      className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 border-2 border-navy-900 flex items-center justify-center text-xs font-medium text-white"
                    >
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                  {(team.memberIds?.length || 0) > 5 && (
                    <div className="w-8 h-8 rounded-full bg-gray-700 border-2 border-navy-900 flex items-center justify-center text-xs font-medium text-gray-400">
                      +{(team.memberIds?.length || 0) - 5}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add Team Card */}
        <Card variant="glass" className="border-dashed border-2 border-white/10 hover:border-inferra-500/50 transition-colors cursor-pointer group">
          <CardContent className="h-full flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-white/5 group-hover:bg-inferra-500/20 flex items-center justify-center mb-4 transition-colors">
              <Plus size={24} className="text-gray-400 group-hover:text-inferra-400 transition-colors" />
            </div>
            <p className="text-lg font-semibold text-gray-300 group-hover:text-white transition-colors">Create New Team</p>
            <p className="text-sm text-gray-500 mt-1">Add a new team to your organization</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
