/**
 * Email Routing — Member 3 deliverable
 * All transactional emails via Resend SDK.
 * Three email types:
 *   1. submitter_confirmation  → sent to the person who submitted the brief
 *   2. manager_notification    → sent to manager for approval
 *   3. dept_routing            → sent to department after manager approves
 */

import { Resend } from 'resend';
import { supabaseAdmin } from './supabase';
import type { Brief, Department } from '../types';

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = process.env.RESEND_FROM_EMAIL ?? 'briefs@softworks.io';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

// Department email routing table — set real addresses in env or here
const DEPT_EMAILS: Record<Department | 'other', string> = {
  design:      process.env.EMAIL_DEPT_DESIGN      ?? 'design@softworks.io',
  development: process.env.EMAIL_DEPT_DEV         ?? 'dev@softworks.io',
  marketing:   process.env.EMAIL_DEPT_MARKETING   ?? 'marketing@softworks.io',
  content:     process.env.EMAIL_DEPT_CONTENT     ?? 'content@softworks.io',
  hr:          process.env.EMAIL_DEPT_HR          ?? 'hr@softworks.io',
  finance:     process.env.EMAIL_DEPT_FINANCE     ?? 'finance@softworks.io',
  operations:  process.env.EMAIL_DEPT_OPS         ?? 'ops@softworks.io',
  other:       process.env.EMAIL_DEPT_OTHER       ?? 'inbox@softworks.io',
};

const MANAGER_EMAIL = process.env.MANAGER_EMAIL ?? 'manager@softworks.io';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Submitter confirmation
// ─────────────────────────────────────────────────────────────────────────────
export async function sendSubmitterConfirmation(brief: Brief): Promise<void> {
  const shareUrl = `${APP_URL}/share/${brief.share_token}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f7fb; margin: 0; padding: 40px 20px; }
    .card { background: #fff; border-radius: 12px; max-width: 560px; margin: 0 auto; overflow: hidden; box-shadow: 0 2px 16px rgba(0,0,0,.08); }
    .header { background: linear-gradient(135deg, #0050a0, #0080d0); padding: 32px; color: #fff; }
    .header h1 { margin: 0; font-size: 22px; }
    .header p { margin: 6px 0 0; opacity: .85; font-size: 14px; }
    .body { padding: 28px 32px; }
    .body p { color: #444; line-height: 1.6; margin: 0 0 14px; }
    .meta { background: #f0f5ff; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
    .meta p { margin: 4px 0; font-size: 13px; color: #333; }
    .meta strong { color: #0050a0; }
    .btn { display: inline-block; background: #0050a0; color: #fff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 8px 0; }
    .footer { text-align: center; padding: 16px; color: #aaa; font-size: 12px; }
    .chip { display: inline-block; background: #e8f0fe; color: #0050a0; border-radius: 4px; padding: 2px 10px; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>✅ Brief Received!</h1>
      <p>Your project brief has been submitted to Softworks</p>
    </div>
    <div class="body">
      <p>Hi <strong>${brief.submitter_name}</strong>,</p>
      <p>We've received your brief and our AI is already processing it. A manager will review it shortly and you'll hear back within 1–2 business days.</p>

      <div class="meta">
        <p><strong>Project:</strong> ${brief.project_title ?? 'Processing…'}</p>
        <p><strong>Department:</strong> <span class="chip">${brief.department ?? 'Detecting…'}</span></p>
        <p><strong>Priority:</strong> ${brief.priority.toUpperCase()}</p>
        <p><strong>Submitted:</strong> ${new Date(brief.created_at).toLocaleString()}</p>
        <p><strong>Reference ID:</strong> ${brief.id.substring(0, 8).toUpperCase()}</p>
      </div>

      <p>You can track your brief at any time using the link below:</p>
      <a href="${shareUrl}" class="btn">View My Brief →</a>
      <p style="font-size:12px;color:#999;margin-top:4px;">This link is valid for 30 days</p>
    </div>
    <div class="footer">Softworks Brief Assistant &bull; This is an automated message</div>
  </div>
</body>
</html>`;

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: brief.submitter_email,
    subject: `Brief Received: ${brief.project_title ?? 'New Brief'} [#${brief.id.substring(0, 8).toUpperCase()}]`,
    html,
  });

  await logEmail(brief.id, brief.submitter_email,
    `Brief Received: ${brief.project_title}`, 'submitter_confirmation', data?.id, error);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Manager notification — requires approval action
// ─────────────────────────────────────────────────────────────────────────────
export async function sendManagerNotification(brief: Brief): Promise<void> {
  const dashboardUrl = `${APP_URL}/manager`;
  const approveUrl   = `${APP_URL}/manager?brief=${brief.id}&action=approve`;
  const rejectUrl    = `${APP_URL}/manager?brief=${brief.id}&action=reject`;

  const goalsList = (brief.goals ?? [])
    .map(g => `<li style="margin:4px 0;color:#333">${g}</li>`)
    .join('');

  const ambigList = (brief.ambiguities ?? [])
    .map(a => `<li style="margin:4px 0;color:#b85c00">${a}</li>`)
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f7fb; margin: 0; padding: 40px 20px; }
    .card { background: #fff; border-radius: 12px; max-width: 620px; margin: 0 auto; overflow: hidden; box-shadow: 0 2px 16px rgba(0,0,0,.08); }
    .header { background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 28px 32px; color: #fff; }
    .header h1 { margin: 0; font-size: 20px; }
    .header p  { margin: 6px 0 0; opacity: .8; font-size: 13px; }
    .body { padding: 24px 32px; }
    .body p { color: #444; line-height: 1.6; margin: 0 0 14px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #f8faff; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .meta-item p { margin: 0; font-size: 12px; color: #888; }
    .meta-item strong { font-size: 14px; color: #222; }
    .section { margin: 20px 0; }
    .section h3 { font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: #888; margin: 0 0 8px; }
    .warn-box { background: #fff8ee; border-left: 3px solid #f59e0b; border-radius: 4px; padding: 12px 16px; }
    .actions { display: flex; gap: 12px; margin: 24px 0; }
    .btn-approve { background: #16a34a; color: #fff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 15px; }
    .btn-reject  { background: #dc2626; color: #fff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 15px; }
    .btn-dash    { background: #f1f5f9; color: #334155 !important; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; }
    .footer { text-align: center; padding: 16px; color: #aaa; font-size: 12px; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .badge-urgent { background: #fee2e2; color: #dc2626; }
    .badge-high   { background: #fef3c7; color: #b45309; }
    .badge-normal { background: #dbeafe; color: #1d4ed8; }
    .badge-low    { background: #f0fdf4; color: #15803d; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>📋 New Brief Awaiting Approval</h1>
      <p>Action required — please review and approve or reject</p>
    </div>
    <div class="body">
      <p>A new project brief has been submitted and processed. Please review the details below and take action.</p>

      <div class="meta">
        <div class="meta-item">
          <p>Project</p>
          <strong>${brief.project_title ?? 'Untitled'}</strong>
        </div>
        <div class="meta-item">
          <p>Department</p>
          <strong>${brief.department ?? 'TBD'}</strong>
        </div>
        <div class="meta-item">
          <p>Submitted by</p>
          <strong>${brief.submitter_name}</strong>
        </div>
        <div class="meta-item">
          <p>Priority</p>
          <span class="badge badge-${brief.priority}">${brief.priority}</span>
        </div>
        ${brief.deadline ? `
        <div class="meta-item">
          <p>Deadline</p>
          <strong>${new Date(brief.deadline).toLocaleDateString()}</strong>
        </div>` : ''}
        <div class="meta-item">
          <p>Brief ID</p>
          <strong>#${brief.id.substring(0, 8).toUpperCase()}</strong>
        </div>
      </div>

      ${goalsList ? `
      <div class="section">
        <h3>Project Goals</h3>
        <ul style="margin:0;padding-left:20px">${goalsList}</ul>
      </div>` : ''}

      ${ambigList ? `
      <div class="section warn-box">
        <h3 style="color:#b45309">⚠ Open Questions</h3>
        <ul style="margin:4px 0;padding-left:20px">${ambigList}</ul>
      </div>` : ''}

      <div class="actions">
        <a href="${approveUrl}" class="btn-approve">✓ Approve</a>
        <a href="${rejectUrl}"  class="btn-reject">✗ Reject</a>
      </div>
      <a href="${dashboardUrl}" class="btn-dash">Open Full Dashboard →</a>
    </div>
    <div class="footer">Softworks Brief Assistant &bull; Manager Notification</div>
  </div>
</body>
</html>`;

  const subject = `[Action Required] New Brief: ${brief.project_title ?? 'Untitled'} (#${brief.id.substring(0, 8).toUpperCase()})`;

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: MANAGER_EMAIL,
    subject,
    html,
  });

  await logEmail(brief.id, MANAGER_EMAIL, subject, 'manager_notification', data?.id, error);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Department routing — sent after manager approves
// ─────────────────────────────────────────────────────────────────────────────
export async function sendDepartmentRouting(brief: Brief): Promise<void> {
  const dept = (brief.department ?? 'other') as Department;
  const deptEmail = DEPT_EMAILS[dept] ?? DEPT_EMAILS.other;
  const shareUrl = `${APP_URL}/share/${brief.share_token}`;

  const goalsList = (brief.goals ?? [])
    .map(g => `<li style="margin:4px 0">${g}</li>`)
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f7fb; margin: 0; padding: 40px 20px; }
    .card { background: #fff; border-radius: 12px; max-width: 580px; margin: 0 auto; overflow: hidden; box-shadow: 0 2px 16px rgba(0,0,0,.08); }
    .header { background: linear-gradient(135deg, #059669, #0d9488); padding: 28px 32px; color: #fff; }
    .header h1 { margin: 0; font-size: 20px; }
    .header p  { margin: 6px 0 0; opacity: .85; font-size: 13px; }
    .body { padding: 24px 32px; }
    .body p { color: #444; line-height: 1.6; margin: 0 0 14px; }
    .meta { background: #f0fdf8; border-radius: 8px; padding: 16px 20px; margin: 16px 0; }
    .meta p { margin: 4px 0; font-size: 13px; color: #333; }
    .meta strong { color: #065f46; }
    .section h3 { font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: .05em; margin: 0 0 8px; }
    .btn { display: inline-block; background: #059669; color: #fff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; }
    .note-box { background: #fffbeb; border-left: 3px solid #d97706; border-radius: 4px; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #78350f; }
    .footer { text-align: center; padding: 16px; color: #aaa; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>🚀 New Brief Assigned to ${dept.charAt(0).toUpperCase() + dept.slice(1)}</h1>
      <p>Approved by management — action required</p>
    </div>
    <div class="body">
      <p>A new project brief has been approved by management and assigned to your department. Please review the details and reach out to the submitter to get started.</p>

      <div class="meta">
        <p><strong>Project:</strong> ${brief.project_title ?? 'Untitled'}</p>
        <p><strong>Client:</strong> ${brief.submitter_name} (${brief.submitter_email})</p>
        ${brief.submitter_phone ? `<p><strong>Phone:</strong> ${brief.submitter_phone}</p>` : ''}
        <p><strong>Priority:</strong> ${brief.priority.toUpperCase()}</p>
        ${brief.deadline ? `<p><strong>Deadline:</strong> ${new Date(brief.deadline).toLocaleDateString()}</p>` : ''}
        <p><strong>Brief ID:</strong> #${brief.id.substring(0, 8).toUpperCase()}</p>
      </div>

      ${goalsList ? `
      <div class="section">
        <h3>Goals</h3>
        <ul style="margin:0;padding-left:20px;color:#333">${goalsList}</ul>
      </div>` : ''}

      ${brief.manager_notes ? `
      <div class="note-box">
        <strong>Manager Notes:</strong> ${brief.manager_notes}
      </div>` : ''}

      <p style="margin-top:20px">View the full structured brief here:</p>
      <a href="${shareUrl}" class="btn">Open Full Brief →</a>
    </div>
    <div class="footer">Softworks Brief Assistant &bull; Department Routing</div>
  </div>
</body>
</html>`;

  const subject = `[New Assignment] ${brief.project_title ?? 'New Brief'} — ${dept.charAt(0).toUpperCase() + dept.slice(1)} Team (#${brief.id.substring(0, 8).toUpperCase()})`;

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: deptEmail,
    subject,
    html,
  });

  await logEmail(brief.id, deptEmail, subject, 'dept_routing', data?.id, error);
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: log every email send to the DB
// ─────────────────────────────────────────────────────────────────────────────
async function logEmail(
  briefId: string,
  recipient: string,
  subject: string,
  type: 'submitter_confirmation' | 'manager_notification' | 'dept_routing',
  resendId?: string,
  error?: unknown
): Promise<void> {
  await supabaseAdmin.from('email_log').insert({
    brief_id: briefId,
    recipient,
    subject,
    type,
    resend_id: resendId,
    status: error ? 'failed' : 'sent',
  });

  if (error) {
    console.error(`[email] Failed to send ${type} to ${recipient}:`, error);
  }
}
