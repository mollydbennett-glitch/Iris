import { NextResponse } from 'next/server';
import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('wardrobe_items')
    .select('*')
    .eq('user_id', PHASE1_USER_ID)
    .eq('status', 'considering')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}
