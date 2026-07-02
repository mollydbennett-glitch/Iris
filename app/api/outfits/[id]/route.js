import { NextResponse } from 'next/server';
import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Full detail for one look (used by the "tap to open" view): collage items,
// the why, the styling tip, Iris's scores, and any gap.
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const db = getSupabaseAdmin();
    const { data: o, error } = await db.from('saved_outfits').select('*').eq('id', id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });

    let items = [];
    if (o.item_ids?.length) {
      const { data } = await db.from('wardrobe_items').select('*').in('id', o.item_ids);
      const byId = new Map((data || []).map((it) => [it.id, it]));
      items = o.item_ids.map((i) => byId.get(i)).filter(Boolean);
    }

    return NextResponse.json({
      look: {
        id: o.id,
        title: o.title,
        why: o.why || '',
        styling_tip: o.styling_tip || '',
        scores: o.engine_scores || null,
        gap: o.gap_suggested || null,
        gap_workaround: o.gap_workaround || null,
        occasion: o.occasion || null,
        is_favorite: o.is_favorite || false,
        ratings: { proportions: o.rating_proportions, aesthetic: o.rating_aesthetic, cohesion: o.rating_cohesion, style: o.rating_style },
        user_notes: o.user_notes || '',
        items,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}

// Update a saved outfit: favorite it, un-favorite it, or attach ratings later.
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const update = { updated_at: new Date().toISOString() };

    if (typeof body.is_favorite === 'boolean') update.is_favorite = body.is_favorite;
    if (typeof body.user_acted_on === 'boolean') update.user_acted_on = body.user_acted_on;
    if (typeof body.user_notes === 'string') update.user_notes = body.user_notes;

    let ratedAny = false;
    for (const k of ['rating_proportions', 'rating_aesthetic', 'rating_cohesion', 'rating_style']) {
      if (body[k] != null) { update[k] = body[k]; ratedAny = true; }
    }
    if (ratedAny) update.rating_submitted_at = new Date().toISOString();

    const db = getSupabaseAdmin();
    const { data, error } = await db.from('saved_outfits').update(update).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ outfit: data });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
