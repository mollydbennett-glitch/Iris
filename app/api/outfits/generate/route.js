import { NextResponse } from 'next/server';
import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';
import { getWeatherForDate } from '@/lib/weather';
import { generateOutfits } from '@/lib/outfitEngine';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request) {
  try {
    const body = await request.json();
    const { date, occasion, count, tripLength, location } = body;

    const supabaseAdmin = getSupabaseAdmin();

    // Load wardrobe + settings together.
    const [wardrobeRes, settingsRes] = await Promise.all([
      supabaseAdmin
        .from('wardrobe_items')
        .select('*')
        .eq('user_id', PHASE1_USER_ID)
        .eq('is_active', true),
      supabaseAdmin
        .from('user_settings')
        .select('*')
        .eq('user_id', PHASE1_USER_ID)
        .maybeSingle(),
    ]);

    if (wardrobeRes.error) {
      return NextResponse.json({ error: wardrobeRes.error.message }, { status: 500 });
    }
    const wardrobe = wardrobeRes.data || [];
    if (wardrobe.length < 3) {
      return NextResponse.json({ error: 'Add a few more pieces before generating outfits.' }, { status: 400 });
    }

    const settings = settingsRes.data || {};
    const signature = settings.style_signature || {};
    const useLocation = location || settings.default_location || '';

    // Weather (best-effort; never blocks generation).
    let weather = { ok: false };
    if (useLocation && date) {
      weather = await getWeatherForDate(useLocation, date);
    }

    const result = await generateOutfits({
      wardrobe,
      signature,
      occasion,
      weather,
      count: Math.max(1, Math.min(10, Number(count) || 3)),
      tripLength: tripLength || null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Attach real item data (image + tags) to each chosen id for display.
    const byId = new Map(wardrobe.map((it) => [it.id, it]));
    const outfits = result.outfits.map((o) => ({
      title: o.title || 'Outfit',
      why: o.why || '',
      styling_tip: o.styling_tip || '',
      gap: o.gap || null,
      items: (o.item_ids || []).map((id) => byId.get(id)).filter(Boolean),
    }));

    return NextResponse.json({ outfits, weather });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
