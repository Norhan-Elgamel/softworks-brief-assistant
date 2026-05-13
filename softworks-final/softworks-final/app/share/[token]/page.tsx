'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { Brief, BriefAsset } from '../../../types';

type BriefWithAssets = Brief & { brief_assets: (BriefAsset & { signed_url?: string })[] };

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_ai:       { label: 'Processing',        color: 'bg-yellow-100 text-yellow-800' },
  ai_processed:     { label: 'Awaiting Approval', color: 'bg-blue-100 text-blue-800' },
  pending_approval: { label: 'Awaiting Approval', color: 'bg-blue-100 text-blue-800' },
  approved:         { label: 'Approved',           color: 'bg-green-100 text-green-800' },
  rejected:         { label: 'Needs Revision',     color: 'bg-red-100 text-red-800' },
  sent_to_dept:     { label: 'In Progress',        color: 'bg-purple-100 text-purple-800' },
};

export default function SharePage() {
  const params = useParams();
  const token = params?.token as string;

  const [brief, setBrief] = useState<BriefWithAssets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/share/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setBrief(d.brief);
      })
      .catch(() => setError('Failed to load brief'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleExport = async () => {
    if (!brief) return;
    setExporting(true);
    try {
      const r = await fetch(`/api/export/${brief.id}?token=${token}`);
      const d = await r.json();
      if (d.download_url) window.open(d.download_url, '_blank');
      else alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading brief…</p>
        </div>
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow p-10 max-w-md text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Brief Not Found</h1>
          <p className="text-slate-500">{error ?? 'This link may have expired or is invalid.'}</p>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[brief.status] ?? { label: brief.status, color: 'bg-slate-100 text-slate-700' };
  const structured = brief.structured_brief;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-900 to-blue-700 text-white py-6 px-6 shadow">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-sm font-medium uppercase tracking-wide">Softworks Brief Assistant</p>
            <h1 className="text-2xl font-bold mt-1">{brief.project_title ?? 'Project Brief'}</h1>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="bg-white text-blue-900 font-semibold px-4 py-2 rounded-lg text-sm hover:bg-blue-50 transition disabled:opacity-60"
          >
            {exporting ? 'Generating…' : '⬇ Export PDF'}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto py-8 px-6 space-y-6">
        {/* Meta card */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex flex-wrap gap-3 mb-4">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            {brief.department && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                {brief.department.charAt(0).toUpperCase() + brief.department.slice(1)}
              </span>
            )}
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              {brief.priority.toUpperCase()} Priority
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-0.5">Submitted by</p>
              <p className="font-medium text-slate-800">{brief.submitter_name}</p>
              <p className="text-slate-500">{brief.submitter_email}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-0.5">Submitted on</p>
              <p className="font-medium text-slate-800">{new Date(brief.created_at).toLocaleDateString()}</p>
            </div>
            {brief.deadline && (
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wide mb-0.5">Deadline</p>
                <p className="font-medium text-slate-800">{new Date(brief.deadline).toLocaleDateString()}</p>
              </div>
            )}
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-0.5">Reference ID</p>
              <p className="font-mono text-slate-700">#{brief.id.substring(0, 8).toUpperCase()}</p>
            </div>
          </div>
        </div>

        {/* Summary */}
        {structured?.summary && (
          <Section title="Executive Summary">
            <p className="text-slate-700 leading-relaxed">{structured.summary}</p>
          </Section>
        )}

        {/* Goals */}
        {(brief.goals ?? structured?.goals ?? []).length > 0 && (
          <Section title="Project Goals">
            <ul className="space-y-2">
              {(brief.goals ?? structured?.goals ?? []).map((g, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                  <span className="text-slate-700">{g}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Deliverables */}
        {(structured?.deliverables ?? []).length > 0 && (
          <Section title="Deliverables">
            <ul className="space-y-1">
              {structured!.deliverables!.map((d, i) => (
                <li key={i} className="flex gap-2 text-slate-700">
                  <span className="text-blue-500">•</span> {d}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Target audience */}
        {structured?.target_audience && (
          <Section title="Target Audience">
            <p className="text-slate-700">{structured.target_audience}</p>
          </Section>
        )}

        {/* Ambiguities */}
        {(brief.ambiguities ?? structured?.ambiguities ?? []).length > 0 && (
          <Section title="Open Questions" accent="amber">
            <ul className="space-y-2">
              {(brief.ambiguities ?? structured?.ambiguities ?? []).map((a, i) => (
                <li key={i} className="flex gap-2 text-amber-800">
                  <span className="text-amber-500 flex-shrink-0">⚠</span> {a}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Manager decision */}
        {(brief.status === 'approved' || brief.status === 'rejected') && (
          <div className={`rounded-2xl p-6 border-2 ${brief.status === 'approved' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <h2 className={`font-bold text-lg mb-2 ${brief.status === 'approved' ? 'text-green-800' : 'text-red-800'}`}>
              {brief.status === 'approved' ? '✓ Approved' : '✗ Needs Revision'}
            </h2>
            {brief.manager_notes && (
              <p className="text-slate-700">{brief.manager_notes}</p>
            )}
            {brief.approved_at && (
              <p className="text-sm text-slate-500 mt-2">
                By {brief.approved_by} on {new Date(brief.approved_at).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Attachments */}
        {(brief.brief_assets ?? []).length > 0 && (
          <Section title="Attachments">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {brief.brief_assets.map(asset => (
                <a
                  key={asset.id}
                  href={asset.signed_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition"
                >
                  <span className="text-2xl">{assetIcon(asset.asset_type)}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{asset.file_name}</p>
                    <p className="text-xs text-slate-400">{formatBytes(asset.file_size ?? 0)}</p>
                  </div>
                </a>
              ))}
            </div>
          </Section>
        )}
      </main>

      <footer className="text-center text-slate-400 text-xs py-8">
        Softworks Brief Assistant &bull; This link expires {brief.share_token_expires_at ? new Date(brief.share_token_expires_at).toLocaleDateString() : 'soon'}
      </footer>
    </div>
  );
}

function Section({ title, children, accent = 'blue' }: {
  title: string;
  children: React.ReactNode;
  accent?: 'blue' | 'amber';
}) {
  const border = accent === 'amber' ? 'border-amber-200' : 'border-slate-100';
  return (
    <div className={`bg-white rounded-2xl shadow-sm p-6 border ${border}`}>
      <h2 className="font-bold text-slate-800 text-base mb-4">{title}</h2>
      {children}
    </div>
  );
}

function assetIcon(type: string) {
  if (type === 'image') return '🖼';
  if (type === 'audio') return '🎙';
  return '📄';
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
