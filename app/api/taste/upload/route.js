import { NextResponse } from 'next/server';
import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';
import { readTasteImage } from '@/lib/claude';

export const runtime = 'nodejs';
export const maxDuration = 60;

function isHeic(buffer) {
  if (buffer.length < 12) return false;
  if (buffer.toString('ascii', 4, 8) !== 'ftyp') return false;
  const brand = buffer.toString('ascii', 8, 12).toLowerCase();
  return ['heic', 'heix', 'hevc', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1', 'heif'].includes(brand);
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('image');
    const lovePart = formData.get('love_part') || null;
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No image provided.' }, { status: 400 });
    }

    let buffer = Buffer.from(await file.arrayBuffer());
    if (isHeic(buffer)) {
      const heicConvert = (await import('heic-convert')).default;
      const out = await heicConvert({ buffer, format: 'JPEG', quality: 0.85 });
      buffer = Buffer.from(out);
    }
    {
      const { Jimp } = await import('jimp');
      const img = await Jimp.fromBuffer(buffer, { 'image/jpeg': { maxMemoryUsageInMB: 8192 } });
      if (img.width > 1400 || img.height > 1400) img.scaleToFit({ w: 1400, h: 1400 });
      buffer = await img.getBuffer('image/jpeg', { quality: 80 });
    }

    const base64 = buffer.toString('base64');
    const supabaseAdmin = getSupabaseAdmin();

    // Read the taste from the picture (best-effort; never blocks the save).
    let read = null;
    try {
      read = await readTasteImage(base64, 'image/jpeg');
    } catch (e) {
      read = { summary: '', vibe: [] };
    }

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const storagePath = `${PHASE1_USER_ID}/taste/${filename}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from('wardrobe')
      .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: false });
    if (upErr) return NextResponse.json({ error: `Storage: ${upErr.message}` }, { status: 500 });

    const imageUrl = supabaseAdmin.storage.from('wardrobe').getPublicUrl(storagePath).data.publicUrl;

    const { data: row, error: dbErr } = await supabaseAdmin
      .from('taste_references')
      .insert({ user_id: PHASE1_USER_ID, image_url: imageUrl, read, love_part: lovePart })
      .select()
      .single();
    if (dbErr) return NextResponse.json({ error: `Database: ${dbErr.message}` }, { status: 500 });

    return NextResponse.json({ reference: row });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
