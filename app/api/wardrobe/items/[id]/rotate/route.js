import { NextResponse } from 'next/server';
import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

function storagePathFromUrl(url) {
  if (!url) return null;
  const marker = '/wardrobe/';
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return url.slice(i + marker.length).split('?')[0];
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { degrees } = await request.json();
    const supabaseAdmin = getSupabaseAdmin();

    const { data: row, error: rowErr } = await supabaseAdmin
      .from('wardrobe_items')
      .select('image_url, cutout_url')
      .eq('id', id)
      .single();
    if (rowErr || !row) {
      return NextResponse.json({ error: rowErr?.message || 'Item not found' }, { status: 404 });
    }

    const oldPath = storagePathFromUrl(row.image_url);
    if (!oldPath) return NextResponse.json({ error: 'Could not locate stored image.' }, { status: 500 });

    const { data: blob, error: dlErr } = await supabaseAdmin.storage.from('wardrobe').download(oldPath);
    if (dlErr || !blob) return NextResponse.json({ error: dlErr?.message || 'Download failed' }, { status: 500 });

    const { Jimp } = await import('jimp');
    const image = await Jimp.read(Buffer.from(await blob.arrayBuffer()));
    image.rotate(Number(degrees) || 90);
    if (image.width > 1400 || image.height > 1400) image.scaleToFit({ w: 1400, h: 1400 });
    const outBuffer = await image.getBuffer('image/jpeg', { quality: 80 });

    // Write to a NEW path so no CDN cache can serve a stale copy.
    const newPath = `${PHASE1_USER_ID}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error: upErr } = await supabaseAdmin.storage
      .from('wardrobe')
      .upload(newPath, outBuffer, { contentType: 'image/jpeg', upsert: false });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const newUrl = supabaseAdmin.storage.from('wardrobe').getPublicUrl(newPath).data.publicUrl;

    // Point the row at the new image and clear the now-stale cutout.
    const { error: updErr } = await supabaseAdmin
      .from('wardrobe_items')
      .update({ image_url: newUrl, cutout_url: null })
      .eq('id', id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    // Best-effort cleanup of the old files.
    const toRemove = [oldPath, storagePathFromUrl(row.cutout_url)].filter(Boolean);
    if (toRemove.length) { try { await supabaseAdmin.storage.from('wardrobe').remove(toRemove); } catch {} }

    return NextResponse.json({ ok: true, image_url: newUrl });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
