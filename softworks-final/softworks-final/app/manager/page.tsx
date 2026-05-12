'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Brief } from '../../types';

type BriefWithAssets = Brief & { brief_assets?: unknown[] };

const MANAGER_SECRET = process.env.NEXT_PUBLIC_MANAGER_SECRET ?? '';

const STATUS_FILTERS = [
  { value: '', label: 'All Briefs' },
  { value: 'pending_approval', label: 'Pending' },
  { value: 'ai_processed', label: 'AI Processed' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'sent_to_dept', label: 'In Progress' },
];

const STATUS_BADGE: Record<string, string> = {
  pending_ai:       'bg-yellow-100 text-yellow-800',
  ai_processed:     'bg-blue-100 text-blue-800',
  pending_approval: 'bg-orange-100 text-orange-800',
  approved:         'bg-green-100 text-green-800',
  rejected:         'bg-red-100 text-red-800',
  sent_to_dept:     'bg-purple-100 text-purple-800',
};

const PRIORITY_BADGE: Record<string, string> = {
  low:    'bg-slate-100 text-slate-600',
  normal: 'bg-blue-50 text-blue-700',
  high:   'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};

export default function ManagerDashboard() {
  const [briefs, setBriefs] = useState<BriefWithAssets[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending_approval');
  const [selected, setSelected] = useState<BriefWithAssets | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [managerName, setManagerName] = useState('');
  const [managerNotes, setManagerNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const authHeader = `Bearer ${MANAGER_SECRET}`;

  const fetchBriefs = useCallback(async () => {
    setLoading(true);
    const url = statusFilter ? `/api/briefs?status=${statusFilter}` : '/api/briefs';
    const r = await fetch(url, { headers: { Authorization: authHeader } });
    const d = await r.json();
    setBriefs(d.briefs ?? []);
    setLoading(false);
  }, [statusFilter, authHeader]);

  useEffect(() => { fetchBriefs(); }, [fetchBriefs]);

  // Handle ?brief=id&action=approve from email link
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const briefId = sp.get('brief');
    const act = sp.get('action') as 'approve' | 'reject' | null;
    if (briefId && act) {
      fetch(`/api/briefs?status=`, { headers: { Authorization: authHeader } })
        .then(r => r.json())
        .then(d => {
          const found = (d.briefs ?? []).find((b: Brief) => b.id === briefId);
          if (found) { setSelected(found); setAction(act); }
        });
    }
  }, [authHeader]);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSubmitAction = async () => {
    if (!selected || !action || !managerName) return;
    setSubmitting(true);
    try {
      const r = await fetch(`/api/approve/${selected.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          action,
          approved_by: managerName,
          manager_notes: managerNotes || undefined,
        }),
      });
      const d = await r.json();
      if (r.ok) {
        showToast(`Brief ${action === 'approve' ? 'approved and routed to department' : 'rejected and submitter notified'}.`, true);
        setSelected(null);
        setAction(null);
        setManagerNotes('');
        fetchBriefs();
      } else {
        showToast(d.error ?? 'Action failed.', false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async (brief: Brief) => {
    const r = await fetch(`/api/export/${brief.id}`, { headers: { Authorization: authHeader } });
    const d = await r.json();
    if (d.download_url) window.open(d.download_url, '_blank');
    else showToast('PDF generation failed.', false);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-5 shadow">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-widest">Softworks</p>
            <h1 className="text-xl font-bold">Manager Dashboard</h1>
          </div>
          <div className="text-slate-300 text-sm">
            {briefs.length} brief{briefs.length !== 1 ? 's' : ''} shown
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
        {/* Sidebar filters */}
        <aside className="w-48 flex-shrink-0 space-y-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                statusFilter === f.value
                  ? 'bg-white shadow text-slate-900'
                  : 'text-slate-500 hover:bg-white hover:text-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </aside>

        {/* Brief list */}
        <div className="flex-1 space-y-4">
          {loading && (
            <div className="text-center py-16 text-slate-400">
              <div className="w-8 h-8 border-4 border-slate-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
              Loading briefs…
            </div>
          )}

          {!loading && briefs.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-slate-400">
              No briefs found for this filter.
            </div>
          )}

          {!loading && briefs.map(brief => (
            <div key={brief.id} className="bg-white rounded-2xl shadow-sm p-5 hover:shadow transition">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[brief.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {brief.status.replace(/_/g, ' ')}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${PRIORITY_BADGE[brief.priority]}`}>
                      {brief.priority}
                    </span>
                    {brief.department && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                        {brief.department}
                      </span>
                    )}
                  </div>
                  <h2 className="font-bold text-slate-800 text-base truncate">{brief.project_title ?? 'Untitled Brief'}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{brief.submitter_name} &bull; {brief.submitter_email}</p>
                  {brief.goals && brief.goals.length > 0 && (
                    <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                      {brief.goals[0]}{brief.goals.length > 1 ? ` (+${brief.goals.length - 1} more)` : ''}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  <p className="text-xs text-slate-400 text-right">{new Date(brief.created_at).toLocaleDateString()}</p>
                  <div className="flex gap-2">
                    {['pending_approval', 'ai_processed'].includes(brief.status) && (
                      <>
                        <button
                          onClick={() => { setSelected(brief); setAction('approve'); }}
                          className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-semibold transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => { setSelected(brief); setAction('reject'); }}
                          className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-semibold transition"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleExport(brief)}
                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-semibold transition"
                    >
                      PDF
                    </button>
                    <a
                      href={`/share/${brief.share_token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-semibold transition"
                    >
                      View
                    </a>
                  </div>
                </div>
              </div>

              {brief.ambiguities && brief.ambiguities.length > 0 && (
                <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                  <p className="text-xs text-amber-700 font-semibold mb-1">⚠ {brief.ambiguities.length} open question{brief.ambiguities.length > 1 ? 's' : ''}</p>
                  <p className="text-xs text-amber-600">{brief.ambiguities[0]}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action Modal */}
      {selected && action && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <h2 className={`text-xl font-bold mb-1 ${action === 'approve' ? 'text-green-700' : 'text-red-700'}`}>
              {action === 'approve' ? '✓ Approve Brief' : '✗ Reject Brief'}
            </h2>
            <p className="text-slate-500 text-sm mb-5">
              <span className="font-medium text-slate-700">{selected.project_title ?? 'Untitled'}</span>
              {action === 'approve'
                ? ' will be routed to the department team.'
                : ' — the submitter will be notified to revise.'}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Your Name *</label>
                <input
                  type="text"
                  value={managerName}
                  onChange={e => setManagerName(e.target.value)}
                  placeholder="e.g. Sarah Chen"
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes {action === 'reject' ? '(Required — explain what needs revision)' : '(Optional)'}
                </label>
                <textarea
                  value={managerNotes}
                  onChange={e => setManagerNotes(e.target.value)}
                  rows={3}
                  placeholder={action === 'reject' ? 'Please specify what information is missing or needs to be revised…' : 'Any additional notes for the department…'}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSubmitAction}
                disabled={submitting || !managerName || (action === 'reject' && !managerNotes)}
                className={`flex-1 py-2.5 rounded-lg font-semibold text-white transition disabled:opacity-50 ${
                  action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {submitting ? 'Processing…' : action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
              </button>
              <button
                onClick={() => { setSelected(null); setAction(null); setManagerNotes(''); }}
                className="px-5 py-2.5 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
