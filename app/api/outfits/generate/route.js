import { NextResponse } from 'next/server';
import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';
import { getWeatherForDate } from '@/lib/weather';
import { generateOutfits } from '@/lib/outfitEngine';
import { summarizeRatedLooks } from '@/lib/claude';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Turn a weather result into a short line we can store on the saved outfit.
function weatherContext(weather) {
  if (!weather?.ok) return null;
  let s = `${weather.location}: ~${weather.high}°F / ${weather.low}°F, ${weather.description}`;
  if (weather.precip != null) s += `, ${weather.precip}% precip`;
  if (weather.source === 'seasonal') s += ' (seasonal estimate)';
  return s;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { date, occasion, count, tripLength, location } = body;

    const supabaseAdmin = getSupabaseAdmin();

    // Load wardrobe + settings + loved-look references together.
    const [wardrobeRes, settingsRes, tasteRes] = await Promise.all([
      supabaseAdmin
        .from('wardrobe_items')
        .select('*')
        .eq('user_id', PHASE1_USER_ID)
        .eq('is_active', true)
        .eq('status', 'owned'),
      supabaseAdmin
        .from('user_settings')
        .select('*')
        .eq('user_id', PHASE1_USER_ID)
        .maybeSingle(),
      supabaseAdmin
        .from('taste_references')
        .select('read, love_part')
        .eq('user_id', PHASE1_USER_ID),
    ]);

    if (wardrobeRes.error) {
      return NextResponse.json({ error: wardrobeRes.error.message }, { status: 500 });
    }
    const wardrobe = wardrobeRes.data || [];
    if (wardrobe.length < 3) {
      return NextResponse.json({ error: 'Add a few more pieces before generating outfits.' }, { status: 400 });
    }

    const settings = settingsRes.data || {};

    // Learned preferences from the user's yes/no ratings. Cached on
    // user_settings; the summarization only reruns when new ratings have
    // landed since the last summary, so generation stays fast. Learning is
    // additive: if anything here fails, generation proceeds without it.
    let learned = settings.learned_preferences || null;
    try {
      const { data: rated } = await supabaseAdmin
        .from('saved_outfits')
        .select('title, item_ids, user_notes, rating_proportions, rating_aesthetic, rating_cohesion, rating_style, rating_submitted_at')
        .eq('user_id', PHASE1_USER_ID)
        .not('rating_submitted_at', 'is', null)
        .order('rating_submitted_at', { ascending: false })
        .limit(40);

      const ratedLooks = rated || [];
      const newest = ratedLooks[0]?.rating_submitted_at || null;
      const stale =
        ratedLooks.length !== (settings.learned_preferences_rated_count || 0) ||
        (newest && (!settings.learned_preferences_updated_at ||
          new Date(newest) > new Date(settings.learned_preferences_updated_at)));

      if (ratedLooks.length && stale) {
        const itemById = new Map(wardrobeRes.data.map((it) => [it.id, it]));
        const describe = (ids) => (ids || [])
          .map((i) => {
            const it = itemById.get(i);
            if (!it) return null;
            return [it.color?.primary, it.silhouette, it.subcategory || it.category].filter(Boolean).join(' ');
          })
          .filter(Boolean);
        const verdictOf = (r) => {
          const vals = ['rating_proportions', 'rating_aesthetic', 'rating_cohesion', 'rating_style']
            .map((k) => Number(r[k]))
            .filter((n) => !Number.isNaN(n) && n > 0);
          if (!vals.length) return null;
          const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
          return avg >= 3.5 ? 'yes' : 'no';
        };
        const payload = ratedLooks
          .map((r) => ({ verdict: verdictOf(r), title: r.title, pieces: describe(r.item_ids), note: r.user_notes || undefined }))
          .filter((r) => r.verdict && r.pieces.length);

        if (payload.length) {
          learned = await summarizeRatedLooks(payload);
          await supabaseAdmin
            .from('user_settings')
            .update({
              learned_preferences: learned,
              learned_preferences_rated_count: ratedLooks.length,
              learned_preferences_updated_at: new Date().toISOString(),
            })
            .eq('user_id', PHASE1_USER_ID);
        }
      }
    } catch (e) {
      // never block styling on the learning pass
    }

    // Turn each loved look's read into a short reference line for the engine.
    const tasteRefs = (tasteRes?.data || [])
      .map((t) => {
        const r = t.read || {};
        const bits = [r.summary, r.palette, r.proportion].filter(Boolean);
        let s = bits.join('; ');
        if (t.love_part && t.love_part !== 'the whole vibe') s += ` (they love ${t.love_part})`;
        return s.trim();
      })
      .filter(Boolean);

    const baseSig = settings.style_signature || {};
    const existingRefs = Array.isArray(baseSig.references) ? baseSig.references : [];

    // Fold styling guidance + playbook + loved-look reads into the signature.
    const signature = {
      ...baseSig,
      references: [...existingRefs, ...tasteRefs],
      styling_rules: settings.styling_rules || null,
      proportion_playbook: settings.proportion_playbook || null,
      learned_preferences: learned,
    };
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

    const wctx = weatherContext(weather);

    // Persist each look so it can be rated, slotted into a plan, or favorited
    // later. Best-effort: if saving fails, we still return the outfits.
    let savedRows = [];
    try {
      const toInsert = result.outfits.map((o) => ({
        user_id: PHASE1_USER_ID,
        occasion: occasion || null,
        location: useLocation || null,
        forecast_date: date || null,
        weather_context: wctx,
        title: o.title,
        item_ids: o.item_ids,
        why: o.why,
        styling_tip: o.styling_tip,
        engine_scores: o.scores,
        gap_suggested: o.gap_suggested,
        gap_workaround: o.gap_workaround,
        gap_impact: o.gap_impact,
      }));
      const { data, error } = await supabaseAdmin.from('saved_outfits').insert(toInsert).select('id');
      if (!error && data) savedRows = data;
    } catch (e) {
      // ignore — persistence is best-effort in this build
    }

    // Attach real item data (image + tags) to each chosen id for display,
    // plus the saved id (so the UI can later rate / slot / favorite it).
    const byId = new Map(wardrobe.map((it) => [it.id, it]));
    const outfits = result.outfits.map((o, i) => ({
      id: savedRows[i]?.id || null,
      title: o.title,
      why: o.why || '',
      styling_tip: o.styling_tip || '',
      scores: o.scores || null,
      gap: o.gap || null,
      gap_suggested: o.gap_suggested || null,
      gap_workaround: o.gap_workaround || null,
      gap_impact: o.gap_impact ?? null,
      items: (o.item_ids || []).map((id) => byId.get(id)).filter(Boolean),
    }));

    return NextResponse.json({ outfits, weather });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
