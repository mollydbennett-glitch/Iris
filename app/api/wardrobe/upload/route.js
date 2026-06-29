import { NextResponse } from 'next/server';
import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';
import { tagClothingImage } from '@/lib/claude';
import { removeBackground } from '@/lib/photoroom';

export const runtime = 'nodejs';
export const maxDuration = 60; // give the vision + convert room (per-function, explicit)

// Detect HEIC/HEIF by its file signature (the "ftyp" box brand), which is more
// reliable than the browser-reported MIME type.
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

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No image provided.' }, { status: 400 });
    }

    let buffer = Buffer.from(await file.arrayBuffer());

    // If the phone sent a HEIC straight through, convert it to JPEG here.
    if (isHeic(buffer)) {
      const heicConvert = (await import('heic-convert')).default;
      const out = await heicConvert({ buffer, format: 'JPEG', quality: 0.85 });
      buffer = Buffer.from(out);
    }

    // Shrink so stored files stay well under storage size limits.
    {
      const { Jimp } = await import('jimp');
      const img = await Jimp.fromBuffer(buffer, { 'image/jpeg': { maxMemoryUsageInMB: 8192 } });
      if (img.width > 1400 || img.height > 1400) img.scaleToFit({ w: 1400, h: 1400 });
      buffer = await img.getBuffer('image/jpeg', { quality: 80 });
    }

    const base64 = buffer.toString('base64');
    const mediaType = 'image/jpeg';

    const supabaseAdmin = getSupabaseAdmin();

    // 0) Look up the user's styling guidance so tagging only asks about
    //    color season / body type when those are actually turned on.
    let tagOpts = {};
    try {
      const { data: settings } = await supabaseAdmin
        .from('user_settings')
        .select('styling_rules')
        .eq('user_id', PHASE1_USER_ID)
        .maybeSingle();
      const rules = settings?.styling_rules || {};
      if (rules.color_season?.enabled && rules.color_season?.season) {
        tagOpts.colorSeason = rules.color_season.season;
      }
      if (rules.body_type?.enabled && rules.body_type?.type) {
        tagOpts.bodyType = rules.body_type.type;
      }
    } catch (e) {
      // no settings yet is fine — just tag without the optional fields
    }

    // 1) Ask Claude to tag the item.
    const tags = await tagClothingImage(base64, mediaType, tagOpts);

    // 2) Upload the image to Supabase Storage.
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const storagePath = `${PHASE1_USER_ID}/${filename}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('wardrobe')
      .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: `Storage: ${uploadError.message}` }, { status: 500 });
    }

    const { data: pub } = supabaseAdmin.storage.from('wardrobe').getPublicUrl(storagePath);
    const imageUrl = pub.publicUrl;

    // Best-effort transparent cutout via Photoroom (never blocks the upload).
    let cutoutUrl = null;
    try {
      const rb = await removeBackground(buffer);
      if (rb.ok && rb.buffer) {
        const cutout = rb.buffer;
        const cutoutPath = `${PHASE1_USER_ID}/cutouts/${filename.replace(/\.jpg$/, '')}.png`;
        const { error: cErr } = await supabaseAdmin.storage
          .from('wardrobe')
          .upload(cutoutPath, cutout, { contentType: 'image/png', upsert: true });
        if (!cErr) {
          cutoutUrl = supabaseAdmin.storage.from('wardrobe').getPublicUrl(cutoutPath).data.publicUrl;
        }
      }
    } catch (e) {
      // ignore — cutout is optional
    }

    // 3) Insert the row. user_verified_tags starts as a copy of the AI tags;
    //    the confirm step lets Molly correct them.
    const { data: item, error: dbError } = await supabaseAdmin
      .from('wardrobe_items')
      .insert({
        user_id: PHASE1_USER_ID,
        image_url: imageUrl,
        cutout_url: cutoutUrl,
        category: tags.category ?? null,
        subcategory: tags.subcategory ?? null,
        color: tags.color ?? null,
        fabric: tags.fabric ?? null,
        season: tags.season ?? null,
        style_vibe: tags.style_vibe ?? null,
        silhouette: tags.silhouette ?? null,
        // new Phase A tags
        formality: tags.formality ?? null,
        proportion_descriptors: tags.proportion_descriptors ?? null,
        color_role: tags.color_role ?? null,
        statement_level: tags.statement_level ?? null,
        color_season_alignment: tags.color_season_alignment ?? null,
        body_type_notes: tags.body_type_notes ?? null,
        // full raw tag payloads
        ai_tags: tags,
        user_verified_tags: tags,
      })
      .select()
      .single();

    if (dbError) {
      return NextResponse.json({ error: `Database: ${dbError.message}` }, { status: 500 });
    }

    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
