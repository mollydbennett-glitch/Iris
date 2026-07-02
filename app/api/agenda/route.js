import { NextResponse } from 'next/server';
import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';
import { getWeatherForDate } from '@/lib/weather';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const todayStr = () => new Date().toISOString().slice(0, 10);

function within(date, start, end) {
  if (!start) return false;
  return date >= start && date <= (end || start);
}

// A week (or any window) of days, with weather, the looks placed on each day,
// and any trips overlapping the window (rendered as bands by the UI).
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const start = url.searchParams.get('start') || todayStr();
    const span = Math.min(14, Math.max(1, Number(url.searchParams.get('days')) || 7));
    const db = getSupabaseAdmin();

    const [settingsRes, tripsRes, dayLooksRes] = await Promise.all([
      db.from('user_settings').select('default_location').eq('user_id', PHASE1_USER_ID).maybeSingle(),
      db.from('outfit_plans').select('*').eq('user_id', PHASE1_USER_ID).order('start_date', { ascending: true }),
      db.from('day_looks').select('*').eq('user_id', PHASE1_USER_ID).order('position', { ascending: true }),
    ]);

    const defaultLocation = settingsRes.data?.default_location || '';
    const allTrips = tripsRes.data || [];
    const allDayLooks = dayLooksRes.data || [];

    const dates = [];
    const s0 = new Date(`${start}T00:00:00`);
    for (let i = 0; i < span; i++) {
      const d = new Date(s0);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }
    const lastDate = dates[dates.length - 1];

    const tripForDate = (date) => allTrips.find((t) => within(date, t.start_date, t.end_date)) || null;
    const locationForDate = (date) => {
      const t = tripForDate(date);
      return (t && t.location) || defaultLocation || '';
    };

    const looksByDate = {};
    for (const dl of allDayLooks) (looksByDate[dl.date] = looksByDate[dl.date] || []).push(dl);

    const neededIds = new Set();
    for (const d of dates) for (const dl of looksByDate[d] || []) neededIds.add(dl.saved_outfit_id);

    // Which looks were marked worn on which days in this window, so the
    // Planner can show the worn state after a reload.
    let wornKeys = new Set();
    if (neededIds.size) {
      const { data: wornRows } = await db
        .from('wear_events')
        .select('saved_outfit_id, worn_on')
        .eq('user_id', PHASE1_USER_ID)
        .in('saved_outfit_id', [...neededIds])
        .gte('worn_on', start)
        .lte('worn_on', lastDate);
      wornKeys = new Set((wornRows || []).map((r) => `${r.worn_on}|${r.saved_outfit_id}`));
    }

    let lookById = {};
    if (neededIds.size) {
      const { data: looks } = await db.from('saved_outfits').select('*').in('id', [...neededIds]);
      const itemIds = new Set();
      (looks || []).forEach((l) => (l.item_ids || []).forEach((i) => itemIds.add(i)));
      let itemById = new Map();
      if (itemIds.size) {
        const { data: items } = await db.from('wardrobe_items').select('*').in('id', [...itemIds]);
        itemById = new Map((items || []).map((it) => [it.id, it]));
      }
      lookById = Object.fromEntries(
        (looks || []).map((l) => [l.id, { id: l.id, title: l.title, items: (l.item_ids || []).map((i) => itemById.get(i)).filter(Boolean) }])
      );
    }

    const weatherEntries = await Promise.all(
      dates.map((d) => {
        const loc = locationForDate(d);
        if (!loc) return Promise.resolve([d, null]);
        return getWeatherForDate(loc, d).then((w) => [d, w?.ok ? w : null]).catch(() => [d, null]);
      })
    );
    const weatherByDate = Object.fromEntries(weatherEntries);

    const days = dates.map((d) => {
      const t = tripForDate(d);
      const w = weatherByDate[d];
      const looks = (looksByDate[d] || [])
        .sort((a, b) => a.position - b.position)
        .map((dl) => ({ day_look_id: dl.id, slot_label: dl.slot_label || 'Look', worn: wornKeys.has(`${d}|${dl.saved_outfit_id}`), look: lookById[dl.saved_outfit_id] || null }))
        .filter((x) => x.look);
      return {
        date: d,
        day_name: DOW[new Date(`${d}T00:00:00`).getDay()],
        trip_id: t ? t.id : null,
        location: locationForDate(d),
        weather: w ? { high: w.high, low: w.low, description: w.description, source: w.source } : null,
        looks,
      };
    });

    // Trips overlapping the visible window, for the band(s) above the grid.
    const trips = allTrips
      .filter((t) => t.start_date && t.start_date <= lastDate && (t.end_date || t.start_date) >= start)
      .map((t) => ({ id: t.id, name: t.plan_name, type: t.plan_type, location: t.location, start_date: t.start_date, end_date: t.end_date }));

    return NextResponse.json({ start, days, trips, default_location: defaultLocation });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}
