import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Read a trip's details.
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const db = getSupabaseAdmin();
    const { data, error } = await db.from('outfit_plans').select('*').eq('id', id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ trip: data });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}

// Rename a trip, change its place or dates.
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const b = await request.json();
    const update = { updated_at: new Date().toISOString() };
    if (typeof b.name === 'string') update.plan_name = b.name.trim() || 'Trip';
    if (typeof b.location === 'string') update.location = b.location.trim() || null;
    if (b.start_date) update.start_date = b.start_date;
    if (b.end_date) update.end_date = b.end_date;

    const db = getSupabaseAdmin();
    const { error } = await db.from('outfit_plans').update(update).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}

// Delete a trip. The looks placed on its days stay (the days just become loose).
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const db = getSupabaseAdmin();
    const { error } = await db.from('outfit_plans').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}
