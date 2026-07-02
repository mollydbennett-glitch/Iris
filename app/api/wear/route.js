import { NextResponse } from 'next/server';
import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const todayStr = () => new Date().toISOString().slice(0, 10);

// Record a wear. Accepts a look (writes one event per item in it), a list of
// item ids (manual wear), or both. Safe to call twice: the same look or item
// on the same day never double-counts. wear_count and last_worn_at on
// wardrobe_items are kept in sync by a database trigger, so nothing here
// touches counts by hand.
export async function POST(request) {
  try {
    const b = await request.json();
    const wornOn = b.worn_on || todayStr();
    const db = getSupabaseAdmin();

    const rows = [];

    if (b.saved_outfit_id) {
      const { data: look, error } = await db
        .from('saved_outfits')
        .select('id, item_ids')
        .eq('id', b.saved_outfit_id)
        .single();
      if (error || !look) return NextResponse.json({ error: 'Look not found.' }, { status: 404 });

      // Skip any (look, item, day) rows that already exist.
      const { data: existing } = await db
        .from('wear_events')
        .select('item_id')
        .eq('saved_outfit_id', look.id)
        .eq('worn_on', wornOn);
      const already = new Set((existing || []).map((e) => e.item_id));

      for (const itemId of new Set(look.item_ids || [])) {
        if (!already.has(itemId)) {
          rows.push({
            user_id: PHASE1_USER_ID,
            saved_outfit_id: look.id,
            item_id: itemId,
            worn_on: wornOn,
            source: b.source || 'planner',
          });
        }
      }
    }

    if (Array.isArray(b.item_ids) && b.item_ids.length) {
      const { data: existing } = await db
        .from('wear_events')
        .select('item_id')
        .is('saved_outfit_id', null)
        .eq('worn_on', wornOn)
        .in('item_id', b.item_ids);
      const already = new Set((existing || []).map((e) => e.item_id));

      for (const itemId of new Set(b.item_ids)) {
        if (!already.has(itemId)) {
          rows.push({
            user_id: PHASE1_USER_ID,
            saved_outfit_id: null,
            item_id: itemId,
            worn_on: wornOn,
            source: 'manual',
          });
        }
      }
    }

    if (!rows.length) return NextResponse.json({ ok: true, recorded: 0 });

    const { error: insErr } = await db.from('wear_events').insert(rows);
    // 23505 = a duplicate slipped in between the check and the insert; the
    // unique indexes did their job, so it is already recorded.
    if (insErr && insErr.code !== '23505') {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, recorded: rows.length, worn_on: wornOn });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}

// Undo a wear: removes the events for a look (or items) on a given day. The
// trigger walks each item's wear_count back down and recomputes last_worn_at.
export async function DELETE(request) {
  try {
    const b = await request.json();
    if (!b.worn_on) return NextResponse.json({ error: 'A date is required.' }, { status: 400 });
    const db = getSupabaseAdmin();

    if (b.saved_outfit_id) {
      const { error } = await db
        .from('wear_events')
        .delete()
        .eq('saved_outfit_id', b.saved_outfit_id)
        .eq('worn_on', b.worn_on);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (Array.isArray(b.item_ids) && b.item_ids.length) {
      const { error } = await db
        .from('wear_events')
        .delete()
        .is('saved_outfit_id', null)
        .eq('worn_on', b.worn_on)
        .in('item_id', b.item_ids);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}
