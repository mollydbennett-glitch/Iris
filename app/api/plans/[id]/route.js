import { NextResponse } from 'next/server';
import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';
import { getWeatherForDate } from '@/lib/weather';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Every date from start..end, capped at 14 days so a long trip can't fan out
// into dozens of weather calls.
function eachDate(start, end) {
  const out = [];
  if (!start) return out;
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end || start}T00:00:00`);
  for (let d = new Date(s); d <= e && out.length < 14; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// Read a board, with each day's weather and the look slotted into it.
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const db = getSupabaseAdmin();

    const { data: plan, error } = await db.from('outfit_plans').select('*').eq('id', id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });

    const entries = plan.entries || {};
    const dates = eachDate(plan.start_date, plan.end_date);

    // Weather per day (parallel, best-effort). Only if the board has a location.
    let weatherByDate = {};
    if (plan.location) {
      const results = await Promise.all(
        dates.map((d) =>
          getWeatherForDate(plan.location, d)
            .then((w) => [d, w])
            .catch(() => [d, { ok: false }])
        )
      );
      weatherByDate = Object.fromEntries(results);
    }

    // Hydrate any looks that have been slotted in.
    const lookIds = [...new Set(dates.map((d) => entries[d]?.saved_outfit_id).filter(Boolean))];
    let lookById = {};
    if (lookIds.length) {
      const { data: looks } = await db.from('saved_outfits').select('*').in('id', lookIds);
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

    const days = dates.map((d) => {
      const e = entries[d] || null;
      const w = weatherByDate[d];
      return {
        date: d,
        day_name: DOW[new Date(`${d}T00:00:00`).getDay()],
        occasion: e?.occasion || null,
        notes: e?.notes || null,
        saved_outfit_id: e?.saved_outfit_id || null,
        look: e?.saved_outfit_id ? lookById[e.saved_outfit_id] || null : null,
        weather: w?.ok
          ? { high: w.high, low: w.low, description: w.description, location: w.location, source: w.source }
          : null,
      };
    });

    return NextResponse.json({
      plan: {
        id: plan.id,
        plan_name: plan.plan_name,
        plan_type: plan.plan_type,
        location: plan.location,
        start_date: plan.start_date,
        end_date: plan.end_date,
      },
      days,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}

// Update a board: its details, or slot/clear a single day.
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const b = await request.json();
    const db = getSupabaseAdmin();

    const { data: cur, error: e0 } = await db.from('outfit_plans').select('entries').eq('id', id).single();
    if (e0) return NextResponse.json({ error: e0.message }, { status: 404 });

    const update = { updated_at: new Date().toISOString() };
    for (const k of ['plan_name', 'plan_type', 'location', 'start_date', 'end_date']) {
      if (b[k] !== undefined) update[k] = b[k];
    }

    let entries = cur.entries || {};
    if (b.entries) entries = b.entries;

    // setDay = { date, saved_outfit_id, occasion?, notes? }
    // Passing saved_outfit_id: null with nothing else clears that day.
    if (b.setDay && b.setDay.date) {
      const { date, ...rest } = b.setDay;
      const clearing = rest.saved_outfit_id === null && rest.occasion === undefined && rest.notes === undefined;
      if (clearing) {
        const cp = { ...entries };
        delete cp[date];
        entries = cp;
      } else {
        entries = { ...entries, [date]: { ...(entries[date] || {}), ...rest } };
      }
    }
    update.entries = entries;

    const { error } = await db.from('outfit_plans').update(update).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}

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
