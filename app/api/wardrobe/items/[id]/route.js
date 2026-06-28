import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

// Save Molly's tag corrections.
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Mirror the corrected fields into both the top-level columns and
    // user_verified_tags so the gallery and the engine read clean data.
    const update = {
      category: body.category ?? null,
      color: body.color ?? null,
      fabric: body.fabric ?? null,
      season: body.season ?? null,
      style_vibe: body.style_vibe ?? null,
      silhouette: body.silhouette ?? null,
      user_verified_tags: body,
    };

    const supabaseAdmin = getSupabaseAdmin();
    const { data: item, error } = await supabaseAdmin
      .from('wardrobe_items')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
