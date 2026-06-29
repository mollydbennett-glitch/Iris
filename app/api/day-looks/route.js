import { NextResponse } from 'next/server';
import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AUTO_LABELS = ['Day', 'Night', 'Dinner', 'Evening', 'Travel'];

// Place a look on a day. Slot label is auto unless one is passed.
export async function POST(request) {
  try {
    const b = await request.json();
    if (!b.date || !b.saved_outfit_id) {
      return NextResponse.json({ error: 'A date and a look are required.' }, { status: 400 });
    }
    const db = getSupabaseAdmin();

    const { data: existing } = await db
      .from('day_looks')
      .select('id')
      .eq('user_id', PHASE1_USER_ID)
      .eq('date', b.date);
    const n = existing?.length || 0;

    const { data, error } = await db
      .from('day_looks')
      .insert({
        user_id: PHASE1_USER_ID,
        date: b.date,
        saved_outfit_id: b.saved_outfit_id,
        slot_label: b.slot_label || AUTO_LABELS[n] || `Look ${n + 1}`,
        position: n,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ day_look: data });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}
