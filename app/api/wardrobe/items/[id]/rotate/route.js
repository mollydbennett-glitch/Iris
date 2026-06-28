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
  let stage = 'start';
  try {
    const { id } = await params;
    const { degrees } = await request.json();
    const supabaseAdmin = getSupabaseAdmin();

    stage = 'fetch-row';
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

    stage = 'download';
    const { data: blob, error: dlErr } = await supabaseAdmin.storage.from('wardrobe').download(oldPath);
    if (dlErr || !blob) return NextResponse.json({ error: dlErr?.message || 'Download failed' }, { status: 500 });

    stage = 'jimp-import';
    const jimpMod = await import('jimp');
    const Jimp = jimpMod.Jimp;

    stage = 'read';
    const inputBuffer = Buffer.from(await blob.arrayBuffer());
    const image = await Jimp.fromBuffer(inputBuffer, { 'image/jpeg': { maxMemoryUsageInMB: 8192 } });

    stage = 'rotate';
    const deg = Number(degrees) || 90;
    image.rotate(deg);

    stage = 'resize';
    if (image.width > 1400 || image.height > 1400) image.scaleToFit({ w: 1400, h: 1400 });

    stage = 'encode';
    const outBuffer = await image.getBuffer('image/jpeg', { quality: 80 });

    stage = 'upload';
    const newPath = `${PHASE1_USER_ID}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error: upErr } = await supabaseAdmin.storage
      .from('wardrobe')
      .upload(newPath, outBuffer, { contentType: 'image/jpeg', upsert: false });
    if (upErr) return NextResponse.json({ error: `upload: ${upErr.message}` }, { status: 500 });

    const newUrl = supabaseAdmin.storage.from('wardrobe').getPublicUrl(newPath).data.publicUrl;

    stage = 'update-row';
    const { error: updErr } = await supabaseAdmin
      .from('wardrobe_items')
      .update({ image_url: newUrl, cutout_url: null })
      .eq('id', id);
    if (updErr) return NextResponse.json({ error: `db: ${updErr.message}` }, { status: 500 });

    stage = 'cleanup';
    const toRemove = [oldPath, storagePathFromUrl(row.cutout_url)].filter(Boolean);
    if (toRemove.length) { try { await supabaseAdmin.storage.from('wardrobe').remove(toRemove); } catch {} }

    return NextResponse.json({ ok: true, image_url: newUrl });
  } catch (err) {
    // The stage label tells us exactly which step blew up.
    return NextResponse.json({ error: `rotate failed at [${stage}]: ${err.message}` }, { status: 500 });
  }
}
