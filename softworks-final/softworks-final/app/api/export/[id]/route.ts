/**
 * GET /api/export/[id]
 * Member 2 deliverable: PDF export bonus.
 * Generates the PDF if not cached, then returns a signed download URL.
 *
 * Header: Authorization: Bearer <MANAGER_SECRET>  (or share_token query param)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { generateBriefPDF } from '../../../../lib/pdf';
import type { Brief, BriefAsset } from '../../../../types';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const shareToken = searchParams.get('token');

  // Auth: manager secret OR valid share token
  const auth = req.headers.get('authorization');
  const isManager = auth === `Bearer ${process.env.MANAGER_SECRET}`;

  const { data: brief, error } = await supabaseAdmin
    .from('briefs')
    .select('*, brief_assets(*)')
    .eq('id', id)
    .single();

  if (error || !brief) {
    return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
  }

  // Validate access
  if (!isManager) {
    if (!shareToken || brief.share_token !== shareToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (brief.share_token_expires_at && new Date(brief.share_token_expires_at) < new Date()) {
      return NextResponse.json({ error: 'Share link expired' }, { status: 410 });
    }
  }

  let pdfPath = brief.pdf_path as string | undefined;

  // Generate PDF if not yet created or force refresh requested
  const forceRefresh = searchParams.get('refresh') === 'true';
  if (!pdfPath || forceRefresh) {
    pdfPath = await generateBriefPDF(brief as Brief, (brief.brief_assets ?? []) as BriefAsset[]);
  }

  // Create a signed URL valid for 5 minutes
  const { data: signedData, error: signErr } = await supabaseAdmin.storage
    .from('brief-pdfs')
    .createSignedUrl(pdfPath, 300);

  if (signErr || !signedData) {
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 });
  }

  return NextResponse.json({
    download_url: signedData.signedUrl,
    pdf_path: pdfPath,
    expires_in: 300,
  });
}
