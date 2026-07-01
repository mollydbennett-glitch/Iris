import { NextResponse } from 'next/server';
import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';
import { readTasteImage } from '@/lib/claude';
import { storeRemoteImage, fetchOg, CORS } from '@/lib/capture';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}

// "Love this": add an image to the taste board from a URL (bookmarklet) or a
// product link (we pull the og:image).
export async function POST(request) {
  try {
    const b = await request.json();
    let imageUrl = b.imageUrl;
    if (!imageUrl && b.url) {
      const og = await fetchOg(b.url);
      imageUrl = og.imageUrl;
    }
    if (!imageUrl) return NextResponse.json({ error: 'No image found on that page.' }, { status: 400, headers: CORS });

    const { publicUrl, base64, mediaType } = await storeRemoteImage(imageUrl, 'taste');
    let read = null;
    try { read = await readTasteImage(base64, mediaType); } catch (e) { read = { summary: '', vibe: [] }; }

    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('taste_references')
      .insert({ user_id: PHASE1_USER_ID, image_url: publicUrl, read, love_part: 'the whole vibe' })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });
    return NextResponse.json({ reference: data }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500, headers: CORS });
  }
}
