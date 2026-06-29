import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Update a saved outfit: favorite it, un-favorite it, or (later) attach the
// feedback-slider ratings. Only the fields present in the body are touched.
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
      if (body[k] != null) {
        update[k] = body[k];
        ratedAny = true;
      }
    }
    if (ratedAny) update.rating_submitted_at = new Date().toISOString();

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('saved_outfits')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ outfit: data });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
