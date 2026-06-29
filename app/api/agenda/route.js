import { NextResponse } from 'next/server';
import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';
import { getWeatherForDate } from '@/lib/weather';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const todayStr = () => new Date().toISOString().slice(0, 10);

function eachDate(start, end, cap = 14) {
  const out = [];
  if (!start) return out;
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end || start}T00:00:00`);
  for (let d = new Date(s); d <= e && out.length < cap; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
function within(date, start, end) {
  if (!start) return false;
  return date >= start && date <= (end || start);
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const tripId = url.searchParams.get('trip');
    const windowDays = Math.min(21, Math.max(1, Number(url.searchParams.get('days')) || 14));
    const db = getSupabaseAdmin();

    // settings (default location) + all trips + all day_looks for this user
    const [settingsRes, tripsRes, dayLooksRes] = await Promise.all([
      db.from('user_settings').select('default_location').eq('user_id', PHASE1_USER_ID).maybeSingle(),
      db.from('outfit_plans').select('*').eq('user_id', PHASE1_USER_ID).order('start_date', { ascending: true }),
      db.from('day_looks').select('*').eq('user_id', PHASE1_USER_ID).order('position', { ascending: true }),
    ]);

    const defaultLocation = settingsRes.data?.default_location || '';
    const allTrips = tripsRes.data || [];
    const allDayLooks = dayLooksRes.data || [];

    // Which dates are we rendering, and what location does each use?
    let dates = [];
    let activeTrip = null;
    if (tripId) {
      activeTrip = allTrips.find((t) => t.id === tripId) || null;
      if (!activeTrip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
      dates = eachDate(activeTrip.start_date, activeTrip.end_date);
    } else {
      const start = todayStr();
      const s = new Date(`${start}T00:00:00`);
      for (let i = 0; i < windowDays; i++) {
        const d = new Date(s);
        d.setDate(d.getDate() + i);
        dates.push(d.toISOString().slice(0, 10));
      }
    }

    const tripForDate = (date) =>
      activeTrip || allTrips.find((t) => within(date, t.start_date, t.end_date)) || null;
    const locationForDate = (date) => {
      const t = tripForDate(date);
      return (t && t.location) || defaultLocation || '';
    };

    // Hydrate every look we need: those on the window days, plus one cover per trip.
    const looksByDate = {};
    for (const dl of allDayLooks) {
      (looksByDate[dl.date] = looksByDate[dl.date] || []).push(dl);
    }

    const neededIds = new Set();
    for (const d of dates) for (const dl of looksByDate[d] || []) neededIds.add(dl.saved_outfit_id);

    // trip covers = the earliest-placed look inside each trip's range
    const tripCoverDL = {};
    for (const t of allTrips) {
      const inRange = allDayLooks
        .filter((dl) => within(dl.date, t.start_date, t.end_date))
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.position - b.position));
      if (inRange[0]) {
        tripCoverDL[t.id] = inRange[0];
        neededIds.add(inRange[0].saved_outfit_id);
      }
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
        (looks || []).map((l) => [
          l.id,
          { id: l.id, title: l.title, items: (l.item_ids || []).map((i) => itemById.get(i)).filter(Boolean) },
        ])
      );
    }

    // Weather for the rendered dates (parallel, best-effort).
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
        .map((dl) => ({
          day_look_id: dl.id,
          slot_label: dl.slot_label || 'Look',
          look: lookById[dl.saved_outfit_id] || null,
        }))
        .filter((x) => x.look);
      return {
        date: d,
        day_name: DOW[new Date(`${d}T00:00:00`).getDay()],
        trip_id: t ? t.id : null,
        trip_name: t ? t.plan_name : null,
        location: locationForDate(d),
        weather: w ? { high: w.high, low: w.low, description: w.description, source: w.source } : null,
        looks,
      };
    });

    const trips = allTrips.map((t) => ({
      id: t.id,
      name: t.plan_name,
      location: t.location,
      start_date: t.start_date,
      end_date: t.end_date,
      look_count: allDayLooks.filter((dl) => within(dl.date, t.start_date, t.end_date)).length,
      cover: tripCoverDL[t.id] ? lookById[tripCoverDL[t.id].saved_outfit_id] || null : null,
    }));

    return NextResponse.json({
      mode: tripId ? 'trip' : 'agenda',
      trip: activeTrip ? { id: activeTrip.id, name: activeTrip.plan_name, location: activeTrip.location, start_date: activeTrip.start_date, end_date: activeTrip.end_date } : null,
      default_location: defaultLocation,
      days,
      trips,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}
