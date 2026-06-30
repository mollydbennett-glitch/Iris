import { NextResponse } from 'next/server';
import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// List wardrobe items. Defaults to owned pieces; pass ?status=considering for
// the Considering list. Considering items never show in the normal wardrobe.
export async function GET(request) {
  const status = new URL(request.url).searchParams.get('status') || 'owned';
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('wardrobe_items')
    .select('*')
    .eq('user_id', PHASE1_USER_ID)
    .eq('is_active', true)
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data || [] });
}
