import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

function storagePathFromUrl(url) {
  if (!url) return null;
  const marker = '/wardrobe/';
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return url.slice(i + marker.length).split('?')[0];
}

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

// DELETE with ?mode=hard permanently removes the row AND its stored images.
// Default (soft) just flips is_active=false so it can be recovered / routed to
// donate/sell later.
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const supabaseAdmin = getSupabaseAdmin();
    const mode = new URL(request.url).searchParams.get('mode');

    if (mode === 'hard') {
      // Look up the image paths so we can also clear storage.
      const { data: row } = await supabaseAdmin
        .from('wardrobe_items')
        .select('image_url, cutout_url')
        .eq('id', id)
        .single();

      const paths = [storagePathFromUrl(row?.image_url), storagePathFromUrl(row?.cutout_url)].filter(Boolean);
      if (paths.length) {
        await supabaseAdmin.storage.from('wardrobe').remove(paths);
      }

      const { error } = await supabaseAdmin.from('wardrobe_items').delete().eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, hard: true });
    }

    const { error } = await supabaseAdmin
      .from('wardrobe_items')
      .update({ is_active: false })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
