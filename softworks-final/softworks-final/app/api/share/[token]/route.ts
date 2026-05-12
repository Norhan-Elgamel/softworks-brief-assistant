/**
 * GET /api/share/[token]
 * Member 3 deliverable: public brief lookup via share token.
 * No auth required — token IS the credential.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  const { data: brief, error } = await supabaseAdmin
    .from('briefs')
    .select('*, brief_assets(*)')
    .eq('share_token', token)
    .single();

  if (error || !brief) {
    return NextResponse.json({ error: 'Brief not found or link has expired' }, { status: 404 });
  }

  // Check token expiry
  if (brief.share_token_expires_at && new Date(brief.share_token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'This share link has expired' }, { status: 410 });
  }

  // Strip internal fields before returning to public
  const {
    share_token: _st,
    share_token_expires_at: _ste,
    pdf_path: _pp,
    ...publicBrief
  } = brief;

  // Add signed URLs for each asset so the share page can display attachments
  const assets = await Promise.all(
    (brief.brief_assets ?? []).map(async (asset: { storage_path: string; [key: string]: unknown }) => {
      const { data } = await supabaseAdmin.storage
        .from('brief-assets')
        .createSignedUrl(asset.storage_path, 3600);
      return { ...asset, signed_url: data?.signedUrl };
    })
  );

  return NextResponse.json({ brief: { ...publicBrief, brief_assets: assets } });
}
