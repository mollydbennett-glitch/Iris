import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { removeBackground } from '@/lib/photoroom';

export const runtime = 'nodejs';
export const maxDuration = 60;

function storagePathFromUrl(url) {
  const marker = '/wardrobe/';
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return url.slice(i + marker.length).split('?')[0];
}

// Generate (or regenerate) a transparent cutout for one existing item.
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabaseAdmin = getSupabaseAdmin();

    const { data: row, error: rowErr } = await supabaseAdmin
      .from('wardrobe_items')
      .select('image_url')
      .eq('id', id)
      .single();
    if (rowErr || !row) {
      return NextResponse.json({ error: rowErr?.message || 'Item not found' }, { status: 404 });
    }

    const path = storagePathFromUrl(row.image_url);
    if (!path) return NextResponse.json({ error: 'Could not locate stored image.' }, { status: 500 });

    const { data: blob, error: dlErr } = await supabaseAdmin.storage.from('wardrobe').download(path);
    if (dlErr || !blob) return NextResponse.json({ error: dlErr?.message || 'Download failed' }, { status: 500 });

    const inputBuffer = Buffer.from(await blob.arrayBuffer());
    const rb = await removeBackground(inputBuffer);
    if (!rb.ok) {
      return NextResponse.json({ error: rb.message }, { status: 502 });
    }
    const cutout = rb.buffer;

    const cutoutPath = path.replace(/^(.*)\/([^/]+)\.[^.]+$/, '$1/cutouts/$2.png');
    const { error: upErr } = await supabaseAdmin.storage
      .from('wardrobe')
      .upload(cutoutPath, cutout, { contentType: 'image/png', upsert: true });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const cutoutUrl = supabaseAdmin.storage.from('wardrobe').getPublicUrl(cutoutPath).data.publicUrl;
    const { error: updErr } = await supabaseAdmin
      .from('wardrobe_items')
      .update({ cutout_url: cutoutUrl })
      .eq('id', id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, cutout_url: cutoutUrl });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
