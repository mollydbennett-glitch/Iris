import { NextResponse } from 'next/server';
import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// List the user's boards (weekly plans + trips), soonest first.
export async function GET() {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('outfit_plans')
    .select('*')
    .eq('user_id', PHASE1_USER_ID)
    .order('start_date', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const plans = (data || []).map((p) => ({
    id: p.id,
    plan_name: p.plan_name,
    plan_type: p.plan_type,
    location: p.location,
    start_date: p.start_date,
    end_date: p.end_date,
    filled: p.entries ? Object.values(p.entries).filter((e) => e && e.saved_outfit_id).length : 0,
  }));
  return NextResponse.json({ plans });
}

// Create a new board.
export async function POST(request) {
  try {
    const b = await request.json();
    if (!b.plan_name || !b.plan_name.trim()) {
      return NextResponse.json({ error: 'Give the board a name.' }, { status: 400 });
    }
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('outfit_plans')
      .insert({
        user_id: PHASE1_USER_ID,
        plan_name: b.plan_name.trim(),
        plan_type: b.plan_type || 'weekly',
        location: b.location || null,
        start_date: b.start_date || null,
        end_date: b.end_date || null,
        entries: {},
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ plan: data });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}
