import { NextResponse } from 'next/server';
import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// List trips (kept for completeness; the Planner reads trips via /api/agenda).
export async function GET() {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('outfit_plans')
    .select('*')
    .eq('user_id', PHASE1_USER_ID)
    .order('start_date', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trips: data || [] });
}

// Create a trip. The name defaults to the place, and is renamable later.
export async function POST(request) {
  try {
    const b = await request.json();
    const name = (b.name && b.name.trim()) || (b.location && b.location.trim()) || 'Trip';
    if (!b.start_date) return NextResponse.json({ error: 'A start date is required.' }, { status: 400 });

    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('outfit_plans')
      .insert({
        user_id: PHASE1_USER_ID,
        plan_name: name,
        plan_type: 'trip',
        location: b.location?.trim() || null,
        start_date: b.start_date,
        end_date: b.end_date || b.start_date,
        entries: {},
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ trip: data });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}
