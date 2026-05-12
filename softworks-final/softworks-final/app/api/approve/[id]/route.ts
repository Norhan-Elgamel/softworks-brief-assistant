/**
 * POST /api/approve/[id]
 * Member 3 deliverable: manager approves or rejects a brief.
 * After approval → sends department routing email.
 * After rejection → notifies submitter.
 *
 * Body: { action: 'approve' | 'reject', manager_notes?, approved_by }
 * Header: Authorization: Bearer <MANAGER_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import {
  sendDepartmentRouting,
  sendSubmitterConfirmation,
} from '../../../../lib/email';
import { Resend } from 'resend';
import type { Brief } from '../../../../types';

const FROM = process.env.RESEND_FROM_EMAIL ?? 'briefs@softworks.io';
const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.MANAGER_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { action, manager_notes, approved_by } = body as {
    action: 'approve' | 'reject';
    manager_notes?: string;
    approved_by: string;
  };

  if (!action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
  }

  if (!approved_by) {
    return NextResponse.json({ error: 'approved_by is required' }, { status: 400 });
  }

  // Fetch the brief to validate state
  const { data: brief, error: fetchErr } = await supabaseAdmin
    .from('briefs')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !brief) {
    return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
  }

  if (!['ai_processed', 'pending_approval'].includes(brief.status)) {
    return NextResponse.json(
      { error: `Brief is in "${brief.status}" state and cannot be actioned` },
      { status: 409 }
    );
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  // Update the brief
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('briefs')
    .update({
      status: newStatus,
      manager_notes: manager_notes ?? null,
      approved_by,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (updateErr || !updated) {
    console.error('[approve] update error:', updateErr);
    return NextResponse.json({ error: 'Failed to update brief' }, { status: 500 });
  }

  // Post-action emails
  if (action === 'approve') {
    // Update status to sent_to_dept after department email
    sendDepartmentRouting(updated as Brief)
      .then(() =>
        supabaseAdmin
          .from('briefs')
          .update({ status: 'sent_to_dept' })
          .eq('id', id)
      )
      .catch(console.error);
  } else {
    // Notify submitter of rejection
    sendRejectionEmail(updated as Brief).catch(console.error);
  }

  return NextResponse.json({
    success: true,
    brief_id: id,
    new_status: newStatus,
  });
}

async function sendRejectionEmail(brief: Brief): Promise<void> {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f7fb; margin: 0; padding: 40px 20px; }
    .card { background: #fff; border-radius: 12px; max-width: 540px; margin: 0 auto; overflow: hidden; box-shadow: 0 2px 16px rgba(0,0,0,.08); }
    .header { background: linear-gradient(135deg, #7f1d1d, #dc2626); padding: 28px 32px; color: #fff; }
    .header h1 { margin: 0; font-size: 20px; }
    .body { padding: 24px 32px; }
    .body p { color: #444; line-height: 1.6; margin: 0 0 14px; }
    .note-box { background: #fef2f2; border-left: 3px solid #dc2626; border-radius: 4px; padding: 12px 16px; margin: 16px 0; color: #7f1d1d; }
    .btn { display: inline-block; background: #0050a0; color: #fff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; }
    .footer { text-align: center; padding: 16px; color: #aaa; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Brief Update — Further Information Needed</h1>
    </div>
    <div class="body">
      <p>Hi <strong>${brief.submitter_name}</strong>,</p>
      <p>Thank you for submitting your brief. After review, our team requires some additional information before we can proceed with <strong>${brief.project_title ?? 'your project'}</strong>.</p>
      ${brief.manager_notes ? `
      <div class="note-box">
        <strong>Manager's Notes:</strong><br>${brief.manager_notes}
      </div>` : ''}
      <p>Please submit a revised brief addressing the points above, or reply to this email if you have questions.</p>
      <a href="${APP_URL}" class="btn">Submit Revised Brief →</a>
    </div>
    <div class="footer">Softworks Brief Assistant</div>
  </div>
</body>
</html>`;

  await resend.emails.send({
    from: FROM,
    to: brief.submitter_email,
    subject: `Brief Update Required: ${brief.project_title ?? 'Your Brief'} [#${brief.id.substring(0, 8).toUpperCase()}]`,
    html,
  });
}
