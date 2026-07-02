import { NextResponse } from 'next/server';
import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Per-item wear stats, read straight off the denormalized columns on
// wardrobe_items (kept in sync by the wear_events trigger).
//
// ?not_worn_since=YYYY-MM-DD returns only owned pieces not worn since that
// date, including never-worn pieces. This is the query that will drive
// cleanout ("haven't worn in N months") later.
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const notWornSince = url.searchParams.get('not_worn_since');
    const db = getSupabaseAdmin();

    let q = db
      .from('wardrobe_items')
      .select('id, name, category, subcategory, price, wear_count, last_worn_at')
      .eq('user_id', PHASE1_USER_ID)
      .eq('is_active', true)
      .eq('status', 'owned');

    if (notWornSince) {
      q = q.or(`last_worn_at.is.null,last_worn_at.lt.${notWornSince}`);
    }

    const { data, error } = await q.order('last_worn_at', { ascending: true, nullsFirst: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ items: data || [] });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}
