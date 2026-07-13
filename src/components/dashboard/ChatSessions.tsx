import { useEffect, useState } from 'react';
import { MessageSquare, Trash2, Pencil, Play, Plus, Loader2, Cpu } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useToast } from '../../lib/toast';
import { listChats, getChatSession, renameChat, deleteChat } from '../../lib/db';
import { formatCurrency } from '../../lib/utils';
import type { ChatSummary } from '../../types';

export function ChatSessions() {
  const { user, setActiveChat, setDashboardTab } = useStore();
  const toast = useToast();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const load = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      setChats(await listChats(user.id));
    } catch {
      /* not configured / offline */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [user?.id]);

  const handleContinue = async (id: string) => {
    setBusyId(id);
    try {
      const session = await getChatSession(id);
      if (session) {
        setActiveChat(session);
        setDashboardTab('command');
      } else {
        toast({ title: 'Chat not found', variant: 'error' });
      }
    } catch (e: any) {
      toast({ title: 'Could not open chat', description: e?.message, variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await deleteChat(id);
      setChats((c) => c.filter((x) => x.id !== id));
      toast({ title: 'Chat deleted', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message, variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const submitRename = async (id: string) => {
    const title = renameValue.trim();
    setRenaming(null);
    if (!title) return;
    setChats((c) => c.map((x) => (x.id === id ? { ...x, title } : x)));
    try {
      await renameChat(id, title);
    } catch (e: any) {
      toast({ title: 'Rename failed', description: e?.message, variant: 'error' });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Chat Sessions</h2>
          <p className="text-sm text-ink-3 mt-0.5">Resume any routed conversation — history, tokens and savings are preserved.</p>
        </div>
        <button
          onClick={() => setDashboardTab('command')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-br from-brand-400 to-accent-500 text-[#04211f] text-sm font-medium hover:brightness-110 transition"
        >
          <Plus size={15} /> New session
        </button>
      </div>

      {loading ? (
        <div className="glass-card rounded-2xl p-12 grid place-items-center text-ink-3">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : chats.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <span className="inline-grid place-items-center w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] text-ink-3 mb-3">
            <MessageSquare size={22} />
          </span>
          <p className="text-sm text-white font-medium">No chats yet</p>
          <p className="text-xs text-ink-3 mt-1">Run a request in the Command Center and click “Accept &amp; Continue” to start one.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {chats.map((c) => (
            <div key={c.id} className="glass-card rounded-xl p-4 flex items-center gap-4 panel-hover">
              <span className="grid place-items-center w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] text-brand-300 flex-shrink-0">
                <Cpu size={16} />
              </span>
              <div className="min-w-0 flex-1">
                {renaming === c.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => submitRename(c.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitRename(c.id); if (e.key === 'Escape') setRenaming(null); }}
                    className="w-full bg-black/30 border border-white/[0.1] rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-brand-500/50"
                  />
                ) : (
                  <p className="text-sm font-medium text-white truncate">{c.title}</p>
                )}
                <p className="text-[0.7rem] text-ink-3 mt-0.5 truncate">
                  {c.model} · {c.messageCount} messages · {formatCurrency(c.totalCost, 4)} · saved {formatCurrency(c.cumulativeSavings, 4)}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => handleContinue(c.id)} disabled={busyId === c.id} title="Continue" className="p-2 rounded-lg text-ink-3 hover:text-white hover:bg-white/[0.05] transition disabled:opacity-50">
                  {busyId === c.id ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                </button>
                <button onClick={() => { setRenaming(c.id); setRenameValue(c.title); }} title="Rename" className="p-2 rounded-lg text-ink-3 hover:text-white hover:bg-white/[0.05] transition">
                  <Pencil size={15} />
                </button>
                <button onClick={() => handleDelete(c.id)} title="Delete" className="p-2 rounded-lg text-ink-3 hover:text-error-400 hover:bg-white/[0.05] transition">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
