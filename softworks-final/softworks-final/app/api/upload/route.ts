/**
 * POST /api/upload
 * Member 2 deliverable: handles audio/image/document uploads.
 * Stores file in Supabase "brief-assets" bucket and records metadata.
 *
 * Form data: file (File), brief_id (string)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const ALLOWED_TYPES: Record<string, 'image' | 'audio' | 'document'> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'audio/webm': 'audio',
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'text/plain': 'document',
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const briefId = formData.get('brief_id') as string | null;

    if (!file || !briefId) {
      return NextResponse.json(
        { error: 'file and brief_id are required' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB` },
        { status: 413 }
      );
    }

    // Validate MIME type
    const assetType = ALLOWED_TYPES[file.type];
    if (!assetType) {
      return NextResponse.json(
        { error: `File type "${file.type}" is not allowed` },
        { status: 415 }
      );
    }

    // Verify the brief exists
    const { data: brief, error: briefErr } = await supabaseAdmin
      .from('briefs')
      .select('id')
      .eq('id', briefId)
      .single();

    if (briefErr || !brief) {
      return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
    }

    // Build storage path: briefs/{brief_id}/{timestamp}_{filename}
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `briefs/${briefId}/${Date.now()}_${safeFileName}`;

    // Convert file to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from('brief-assets')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[upload] storage error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file to storage' },
        { status: 500 }
      );
    }

    // Record asset metadata in DB
    const { data: asset, error: dbError } = await supabaseAdmin
      .from('brief_assets')
      .insert({
        brief_id: briefId,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: storagePath,
        asset_type: assetType,
      })
      .select()
      .single();

    if (dbError || !asset) {
      console.error('[upload] db error:', dbError);
      // File uploaded but metadata not saved — still return partial success
      return NextResponse.json(
        { error: 'File uploaded but metadata save failed', storage_path: storagePath },
        { status: 207 }
      );
    }

    // Generate a signed URL (60 min) for immediate preview
    const { data: signedData } = await supabaseAdmin.storage
      .from('brief-assets')
      .createSignedUrl(storagePath, 3600);

    return NextResponse.json({
      asset_id: asset.id,
      storage_path: storagePath,
      asset_type: assetType,
      file_name: file.name,
      file_size: file.size,
      signed_url: signedData?.signedUrl,
    }, { status: 201 });

  } catch (err) {
    console.error('[upload] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/upload?brief_id=xxx
 * Returns all assets for a brief with fresh signed URLs
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const briefId = searchParams.get('brief_id');

  if (!briefId) {
    return NextResponse.json({ error: 'brief_id is required' }, { status: 400 });
  }

  const { data: assets, error } = await supabaseAdmin
    .from('brief_assets')
    .select('*')
    .eq('brief_id', briefId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
  }

  // Attach fresh signed URLs to each asset
  const assetsWithUrls = await Promise.all(
    (assets ?? []).map(async (asset) => {
      const { data } = await supabaseAdmin.storage
        .from('brief-assets')
        .createSignedUrl(asset.storage_path, 3600);
      return { ...asset, signed_url: data?.signedUrl };
    })
  );

  return NextResponse.json({ assets: assetsWithUrls });
}
