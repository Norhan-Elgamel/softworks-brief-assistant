/**
 * POST /api/briefs
 * Creates a new brief record, sends submitter confirmation,
 * and notifies the manager for approval.
 *
 * Body: { submitter_name, submitter_email, submitter_phone?, raw_text? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';
import { sendSubmitterConfirmation, sendManagerNotification } from '../../../lib/email';
import type { Brief } from '../../../types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { submitter_name, submitter_email, submitter_phone, raw_text } = body;

    if (!submitter_name || !submitter_email) {
      return NextResponse.json(
        { error: 'submitter_name and submitter_email are required' },
        { status: 400 }
      );
    }

    // Insert the brief — AI fields will be filled in later by the Gemini route
    const { data: brief, error } = await supabaseAdmin
      .from('briefs')
      .insert({
        submitter_name,
        submitter_email,
        submitter_phone: submitter_phone || null,
        raw_text: raw_text || null,
        status: 'pending_ai',
      })
      .select()
      .single();

    if (error || !brief) {
      console.error('[briefs] insert error:', error);
      return NextResponse.json({ error: 'Failed to create brief' }, { status: 500 });
    }

    // Fire & forget emails — don't block the response
    sendSubmitterConfirmation(brief as Brief).catch(console.error);

    return NextResponse.json({ brief_id: brief.id, share_token: brief.share_token }, { status: 201 });
  } catch (err) {
    console.error('[briefs] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/briefs
 * Returns all briefs (for manager dashboard). Protected by a simple
 * Authorization header check — replace with proper auth in production.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.MANAGER_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const department = searchParams.get('department');

  let query = supabaseAdmin
    .from('briefs')
    .select('*, brief_assets(*)')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (department) query = query.eq('department', department);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch briefs' }, { status: 500 });
  }

  return NextResponse.json({ briefs: data });
}
