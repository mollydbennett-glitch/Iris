import { NextResponse } from 'next/server';
import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULTS = {
  default_location: '',
  style_signature: { leanPolished: 50, leanStatement: 50, references: [], contrast: 'balanced' },
  styling_rules: { body_type: { enabled: false, type: '' }, color_season: { enabled: false, season: '' } },
};

export async function GET() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('user_settings')
    .select('*')
    .eq('user_id', PHASE1_USER_ID)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ settings: DEFAULTS });
  return NextResponse.json({
    settings: {
      default_location: data.default_location || '',
      style_signature: data.style_signature || DEFAULTS.style_signature,
      styling_rules: data.styling_rules || DEFAULTS.styling_rules,
    },
  });
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const supabaseAdmin = getSupabaseAdmin();
    const row = {
      user_id: PHASE1_USER_ID,
      default_location: body.default_location ?? '',
      style_signature: body.style_signature ?? DEFAULTS.style_signature,
      updated_at: new Date().toISOString(),
    };
    if (body.styling_rules !== undefined) row.styling_rules = body.styling_rules;
    const { error } = await supabaseAdmin.from('user_settings').upsert(row);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
