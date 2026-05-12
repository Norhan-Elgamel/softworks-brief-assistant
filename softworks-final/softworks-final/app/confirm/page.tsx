'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ConfirmContent() {
  const searchParams = useSearchParams();
  const briefId = searchParams.get('id');
  const token = searchParams.get('token');
  const email = searchParams.get('email') ?? '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl max-w-lg w-full overflow-hidden">
        {/* Top bar */}
        <div className="h-2 bg-gradient-to-r from-blue-600 to-indigo-600" />

        <div className="p-10 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-slate-800 mb-2">Brief Submitted!</h1>
          <p className="text-slate-500 mb-6">
            Your project brief has been received and is being processed by our AI.
            {email && (
              <> A confirmation has been sent to <strong className="text-slate-700">{email}</strong>.</>
            )}
          </p>

          {briefId && (
            <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Reference ID</p>
              <p className="font-mono font-bold text-slate-700 text-lg">#{briefId.substring(0, 8).toUpperCase()}</p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-start gap-3 text-left">
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">1</div>
              <div>
                <p className="font-medium text-slate-800 text-sm">AI Processing</p>
                <p className="text-slate-500 text-xs">Gemini will extract goals, detect ambiguities, and categorize your brief.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-left">
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">2</div>
              <div>
                <p className="font-medium text-slate-800 text-sm">Manager Review</p>
                <p className="text-slate-500 text-xs">A manager will review your brief within 1–2 business days.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-left">
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">3</div>
              <div>
                <p className="font-medium text-slate-800 text-sm">Department Routing</p>
                <p className="text-slate-500 text-xs">Once approved, the right team will reach out to get started.</p>
              </div>
            </div>
          </div>

          {token && (
            <div className="mt-8">
              <Link
                href={`/share/${token}`}
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition text-sm"
              >
                Track My Brief →
              </Link>
            </div>
          )}

          <p className="mt-6 text-xs text-slate-400">
            No account needed — bookmark your brief link to check its status anytime.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>}>
      <ConfirmContent />
    </Suspense>
  );
}
