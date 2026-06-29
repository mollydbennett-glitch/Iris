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

// add a timestamp before the extension so the CDN serves the fresh file
function versioned(path) {
  return path.replace(/(\.[^.]+)$/, `-${Date.now()}$1`);
}

// Crop the empty transparent padding off a cutout so the garment sits tight to
// its own edges. This is what lets the layout scale each piece up to fill its
// slot instead of floating in a big transparent box.
async function trimTransparent(buffer) {
  const { Jimp } = await import('jimp');
  const img = await Jimp.fromBuffer(buffer);
  const { data, width, height } = img.bitmap;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  const ALPHA = 8;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > ALPHA) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return buffer; // nothing opaque; leave as-is
  const span = Math.max(maxX - minX, maxY - minY);
  const pad = Math.round(span * 0.03);
  const cx = Math.max(0, minX - pad);
  const cy = Math.max(0, minY - pad);
  const cw = Math.min(width - cx, maxX - minX + 1 + pad * 2);
  const ch = Math.min(height - cy, maxY - minY + 1 + pad * 2);
  if (cx === 0 && cy === 0 && cw === width && ch === height) return buffer; // already tight
  img.crop({ x: cx, y: cy, w: cw, h: ch });
  return await img.getBuffer('image/png');
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const mode = new URL(request.url).searchParams.get('mode');
    const supabaseAdmin = getSupabaseAdmin();

    // ---- tighten mode: just trim the existing cutout, no background removal ----
    if (mode === 'tighten') {
      const { data: row, error } = await supabaseAdmin
        .from('wardrobe_items')
        .select('cutout_url')
        .eq('id', id)
        .single();
      if (error || !row) return NextResponse.json({ error: error?.message || 'Item not found' }, { status: 404 });
      if (!row.cutout_url) return NextResponse.json({ ok: true, skipped: 'no cutout yet' });

      const path = storagePathFromUrl(row.cutout_url);
      if (!path) return NextResponse.json({ error: 'Could not locate cutout.' }, { status: 500 });

      const { data: blob, error: dlErr } = await supabaseAdmin.storage.from('wardrobe').download(path);
      if (dlErr || !blob) return NextResponse.json({ error: dlErr?.message || 'Download failed' }, { status: 500 });

      const buf = Buffer.from(await blob.arrayBuffer());
      let trimmed;
      try { trimmed = await trimTransparent(buf); } catch { return NextResponse.json({ ok: true, skipped: 'trim failed' }); }
      if (trimmed === buf) return NextResponse.json({ ok: true, cutout_url: row.cutout_url, unchanged: true });

      const newPath = versioned(path);
      const { error: upErr } = await supabaseAdmin.storage
        .from('wardrobe')
        .upload(newPath, trimmed, { contentType: 'image/png', upsert: true });
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

      const newUrl = supabaseAdmin.storage.from('wardrobe').getPublicUrl(newPath).data.publicUrl;
      const { error: updErr } = await supabaseAdmin.from('wardrobe_items').update({ cutout_url: newUrl }).eq('id', id);
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

      try { await supabaseAdmin.storage.from('wardrobe').remove([path]); } catch {}
      return NextResponse.json({ ok: true, cutout_url: newUrl });
    }

    // ---- normal mode: remove background from the original, then trim ----
    const { data: row, error: rowErr } = await supabaseAdmin
      .from('wardrobe_items')
      .select('image_url')
      .eq('id', id)
      .single();
    if (rowErr || !row) return NextResponse.json({ error: rowErr?.message || 'Item not found' }, { status: 404 });

    const path = storagePathFromUrl(row.image_url);
    if (!path) return NextResponse.json({ error: 'Could not locate stored image.' }, { status: 500 });

    const { data: blob, error: dlErr } = await supabaseAdmin.storage.from('wardrobe').download(path);
    if (dlErr || !blob) return NextResponse.json({ error: dlErr?.message || 'Download failed' }, { status: 500 });

    const inputBuffer = Buffer.from(await blob.arrayBuffer());
    const rb = await removeBackground(inputBuffer);
    if (!rb.ok) return NextResponse.json({ error: rb.message }, { status: 502 });

    let cutout = rb.buffer;
    try { cutout = await trimTransparent(cutout); } catch { /* keep untrimmed on failure */ }

    const cutoutPath = versioned(path.replace(/^(.*)\/([^/]+)\.[^.]+$/, '$1/cutouts/$2.png'));
    const { error: upErr } = await supabaseAdmin.storage
      .from('wardrobe')
      .upload(cutoutPath, cutout, { contentType: 'image/png', upsert: true });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const cutoutUrl = supabaseAdmin.storage.from('wardrobe').getPublicUrl(cutoutPath).data.publicUrl;
    const { error: updErr } = await supabaseAdmin.from('wardrobe_items').update({ cutout_url: cutoutUrl }).eq('id', id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, cutout_url: cutoutUrl });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
