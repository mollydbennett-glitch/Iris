import { NextResponse } from 'next/server';
import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AUTO_LABELS = ['Day', 'Night', 'Dinner', 'Evening', 'Travel'];

// Move a placed look to another day (drag-and-drop), relabel it, or reorder it.
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const b = await request.json();
    const db = getSupabaseAdmin();

    const update = {};
    if (typeof b.slot_label === 'string') update.slot_label = b.slot_label;
    if (typeof b.position === 'number') update.position = b.position;

    // Moving to a new day: append to that day and auto-label by its new spot.
    if (b.date) {
      const { data: existing } = await db
        .from('day_looks')
        .select('id')
        .eq('user_id', PHASE1_USER_ID)
        .eq('date', b.date)
        .neq('id', id);
      const n = existing?.length || 0;
      update.date = b.date;
      if (update.position === undefined) update.position = n;
      if (update.slot_label === undefined) update.slot_label = AUTO_LABELS[n] || `Look ${n + 1}`;
    }

    if (!Object.keys(update).length) return NextResponse.json({ ok: true });

    const { error } = await db.from('day_looks').update(update).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const db = getSupabaseAdmin();
    const { error } = await db.from('day_looks').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}
