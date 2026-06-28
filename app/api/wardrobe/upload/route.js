import { NextResponse } from 'next/server';
import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';
import { tagClothingImage } from '@/lib/claude';

export const runtime = 'nodejs';
export const maxDuration = 60; // give the vision call room (per-function, explicit)

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('image');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No image provided.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    // The client resizes everything to JPEG before sending.
    const mediaType = 'image/jpeg';

    // 1) Ask Claude to tag the item.
    const tags = await tagClothingImage(base64, mediaType);

    // 2) Upload the image to Supabase Storage.
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const storagePath = `${PHASE1_USER_ID}/${filename}`;

    const supabaseAdmin = getSupabaseAdmin();
    const { error: uploadError } = await supabaseAdmin.storage
      .from('wardrobe')
      .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: `Storage: ${uploadError.message}` }, { status: 500 });
    }

    const { data: pub } = supabaseAdmin.storage.from('wardrobe').getPublicUrl(storagePath);
    const imageUrl = pub.publicUrl;

    // 3) Insert the row. user_verified_tags starts as a copy of the AI tags;
    //    the confirm step lets Molly correct them.
    const { data: item, error: dbError } = await supabaseAdmin
      .from('wardrobe_items')
      .insert({
        user_id: PHASE1_USER_ID,
        image_url: imageUrl,
        category: tags.category ?? null,
        color: tags.color ?? null,
        fabric: tags.fabric ?? null,
        season: tags.season ?? null,
        style_vibe: tags.style_vibe ?? null,
        silhouette: tags.silhouette ?? null,
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
