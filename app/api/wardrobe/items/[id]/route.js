import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

// Read a single item (for the detail page).
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const supabaseAdmin = getSupabaseAdmin();
    const { data: item, error } = await supabaseAdmin
      .from('wardrobe_items')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

// Save tag corrections.
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Mirror the corrected fields into both the top-level columns and
    // user_verified_tags so the gallery and the engine read clean data.
    const update = {
      category: body.category ?? null,
      subcategory: body.subcategory ?? null,
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

// Soft-delete: remove from the active wardrobe but keep the row, so we can
// later route "removed" items into donate / sell / archive views.
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from('wardrobe_items')
      .update({ is_active: false })
      .eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
