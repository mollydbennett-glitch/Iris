import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { Jimp } from 'jimp';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Pull the storage path (everything after the bucket name) out of a public URL.
function storagePathFromUrl(url) {
  const marker = '/wardrobe/';
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return url.slice(i + marker.length).split('?')[0];
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { degrees } = await request.json(); // 90 or 270
    const supabaseAdmin = getSupabaseAdmin();

    // 1) Find the item's stored image.
    const { data: row, error: rowErr } = await supabaseAdmin
      .from('wardrobe_items')
      .select('image_url')
      .eq('id', id)
      .single();
    if (rowErr || !row) {
      return NextResponse.json({ error: rowErr?.message || 'Item not found' }, { status: 404 });
    }

    const path = storagePathFromUrl(row.image_url);
    if (!path) {
      return NextResponse.json({ error: 'Could not locate stored image.' }, { status: 500 });
    }

    // 2) Download current bytes.
    const { data: blob, error: dlErr } = await supabaseAdmin.storage.from('wardrobe').download(path);
    if (dlErr || !blob) {
      return NextResponse.json({ error: dlErr?.message || 'Download failed' }, { status: 500 });
    }
    const inputBuffer = Buffer.from(await blob.arrayBuffer());

    // 3) Rotate and re-encode as JPEG.
    const image = await Jimp.read(inputBuffer);
    image.rotate(Number(degrees) || 90);
    const outBuffer = await image.getBuffer('image/jpeg', { quality: 85 });

    // 4) Overwrite the same path.
    const { error: upErr } = await supabaseAdmin.storage
      .from('wardrobe')
      .upload(path, outBuffer, { contentType: 'image/jpeg', upsert: true });
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
