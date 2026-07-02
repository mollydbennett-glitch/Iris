import { NextResponse } from 'next/server';
import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// List the looks the user has favorited, newest first, with each piece's full
// item data attached so the flat-lay can render exactly like on the Style page.
export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data: rows, error } = await supabaseAdmin
      .from('saved_outfits')
      .select('*')
      .eq('user_id', PHASE1_USER_ID)
      .eq('is_favorite', true)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Gather every item id referenced across the saved looks, fetch those
    // pieces once, then stitch them back onto each outfit.
    const ids = new Set();
    for (const r of rows || []) {
      for (const id of r.item_ids || []) ids.add(id);
    }

    let byId = new Map();
    if (ids.size) {
      const { data: items } = await supabaseAdmin
        .from('wardrobe_items')
        .select('*')
        .in('id', [...ids]);
      byId = new Map((items || []).map((it) => [it.id, it]));
    }

    const outfits = (rows || []).map((r) => ({
      id: r.id,
      title: r.title,
      why: r.why || '',
      styling_tip: r.styling_tip || '',
      gap: r.gap_suggested || null,
      gap_workaround: r.gap_workaround || null,
      occasion: r.occasion || null,
      weather_context: r.weather_context || null,
      created_at: r.created_at,
      ratings: { proportions: r.rating_proportions, aesthetic: r.rating_aesthetic, cohesion: r.rating_cohesion, style: r.rating_style },
      user_notes: r.user_notes || '',
      items: (r.item_ids || []).map((id) => byId.get(id)).filter(Boolean),
    }));

    return NextResponse.json({ outfits });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
