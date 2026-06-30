import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Move a considering item into the closet (status -> owned).
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const b = await request.json();
    const update = {};
    if (b.status) update.status = b.status; // 'owned'
    if (!Object.keys(update).length) return NextResponse.json({ ok: true });
    const db = getSupabaseAdmin();
    const { error } = await db.from('wardrobe_items').update(update).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}

// Let it go (remove the considering item entirely).
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const db = getSupabaseAdmin();
    const { error } = await db.from('wardrobe_items').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}
