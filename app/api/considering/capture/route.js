import { NextResponse } from 'next/server';
import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';
import { tagClothingImage } from '@/lib/claude';
import { storeRemoteImage, fetchOg, hostBrand, CORS } from '@/lib/capture';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}

// "Consider this": save a shoppable piece (url + image + price) into the
// Considering list, tagged like a real garment so Buy or Cry can use it.
// Works from the bookmarklet (imageUrl supplied) or a pasted product link
// (we pull og:image / title / price).
export async function POST(request) {
  try {
    const b = await request.json();
    const url = b.url || null;

    let imageUrl = b.imageUrl;
    let name = b.name || null;
    let price = b.price != null ? Number(b.price) || null : null;
    let source = b.source || null;

    if ((!imageUrl || !name || !price) && url) {
      const og = await fetchOg(url);
      if (!imageUrl) imageUrl = og.imageUrl;
      if (!name) name = og.title || null;
      if (!price && og.price) price = og.price;
      if (!source) source = og.source || null;
    }
    if (!source && url) source = hostBrand(url);
    if (!imageUrl) return NextResponse.json({ error: 'No image found on that page.' }, { status: 400, headers: CORS });

    const { publicUrl, base64, mediaType } = await storeRemoteImage(imageUrl, 'considering');

    let tags = {};
    try { tags = await tagClothingImage(base64, mediaType); } catch (e) { tags = {}; }

    const db = getSupabaseAdmin();
    const { data: item, error } = await db
      .from('wardrobe_items')
      .insert({
        user_id: PHASE1_USER_ID,
        status: 'considering',
        image_url: publicUrl,
        name,
        price,
        source,
        source_url: url,
        category: tags.category ?? null,
        subcategory: tags.subcategory ?? null,
        color: tags.color ?? null,
        fabric: tags.fabric ?? null,
        season: tags.season ?? null,
        style_vibe: tags.style_vibe ?? null,
        silhouette: tags.silhouette ?? null,
        formality: tags.formality ?? null,
        proportion_descriptors: tags.proportion_descriptors ?? null,
        color_role: tags.color_role ?? null,
        statement_level: tags.statement_level ?? null,
        ai_tags: tags,
        user_verified_tags: tags,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });

    return NextResponse.json({ item }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500, headers: CORS });
  }
}
