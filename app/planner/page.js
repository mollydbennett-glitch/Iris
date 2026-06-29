'use client';

import { useState, useEffect, useCallback } from 'react';
import { FlatLay } from '@/components/FlatLay';

function fmtDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function fmtRange(a, b) {
  if (!a) return '';
  const s = fmtDate(a);
  if (!b || b === a) return s;
  return `${s} – ${fmtDate(b)}`;
}
function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function LookThumb({ look, size = 64 }) {
  return <div style={{ width: size, flexShrink: 0 }}><FlatLay outfit={look} idx={0} /></div>;
}

export default function PlannerPage() {
  const [tripId, setTripId] = useState(null);
  const [data, setData] = useState(null);
  const [lookbook, setLookbook] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [picker, setPicker] = useState({ open: false, date: null });
  const [busyDate, setBusyDate] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [cLoc, setCLoc] = useState('');
  const [cStart, setCStart] = useState(today);
  const [cDays, setCDays] = useState(5);
  const [cName, setCName] = useState('');
  const [creating, setCreating] = useState(false);

  const [tripName, setTripName] = useState('');
  const [tripLoc, setTripLoc] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tid = new URLSearchParams(window.location.search).get('trip');
      setTripId(tid);
      const [aRes, lRes] = await Promise.all([
        fetch(`/api/agenda${tid ? `?trip=${tid}` : '?days=14'}`),
        fetch('/api/outfits/saved'),
      ]);
      const aData = await aRes.json();
      if (!aRes.ok) throw new Error(aData.error || 'Failed to load planner');
      const lData = await lRes.json();
      setData(aData);
      setLookbook(lData.outfits || []);
      if (aData.trip) { setTripName(aData.trip.name || ''); setTripLoc(aData.trip.location || ''); }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addLook(date, lookId) {
    await fetch('/api/day-looks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, saved_outfit_id: lookId }),
    });
    setPicker({ open: false, date: null });
    await load();
  }
  async function removeLook(dayLookId) {
    await fetch(`/api/day-looks/${dayLookId}`, { method: 'DELETE' });
    await load();
  }
  async function styleThisDay(date, location) {
    setBusyDate(date);
    try {
      const res = await fetch('/api/outfits/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, occasion: 'Everyday', count: 1, location: location || null }),
      });
      const d = await res.json();
      const look = d.outfits && d.outfits[0];
      if (look?.id) {
        await fetch('/api/day-looks', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, saved_outfit_id: look.id }),
        });
      }
      await load();
    } finally {
      setBusyDate(null);
    }
  }
  async function createTrip() {
    setCreating(true);
    try {
      const end = addDays(cStart, Math.max(1, Number(cDays)) - 1);
      const res = await fetch('/api/plans', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cName.trim() || null, location: cLoc.trim() || null, start_date: cStart, end_date: end }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Could not create trip'); }
      setShowCreate(false); setCName(''); setCLoc('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }
  async function saveTrip() {
    await fetch(`/api/plans/${tripId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: tripName, location: tripLoc }),
    });
    await load();
  }
  async function deleteTrip() {
    if (!confirm('Delete this trip? The looks you placed stay on those days.')) return;
    await fetch(`/api/plans/${tripId}`, { method: 'DELETE' });
    window.location.href = '/planner';
  }

  const selectStyle = { padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 2, background: '#fff', color: 'var(--ink)', fontSize: 14, width: '100%' };

  if (loading) return <p className="note"><span className="spinner" />&nbsp; Loading…</p>;
  if (error) return <p className="status err" style={{ display: 'block' }}>{error}</p>;
  if (!data) return null;

  // Group consecutive days that belong to the same trip.
  const groups = [];
  for (const d of data.days) {
    const last = groups[groups.length - 1];
    if (last && last.trip_id === d.trip_id) last.days.push(d);
    else groups.push({ trip_id: d.trip_id, trip_name: d.trip_name, days: [d] });
  }

  function DayRow({ d }) {
    return (
      <div style={{ display: 'flex', gap: 14, padding: '12px 0', borderTop: '0.5px solid var(--line)' }}>
        <div style={{ width: 92, flexShrink: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>{d.day_name}</div>
          <div className="note" style={{ fontStyle: 'normal', marginTop: 0 }}>{fmtDate(d.date)}</div>
          {d.weather ? (
            <div className="note" style={{ marginTop: 6 }}>{d.weather.high}°/{d.weather.low}°F · {d.weather.description}{d.weather.source === 'seasonal' ? ' (est.)' : ''}</div>
          ) : (
            <div className="note" style={{ marginTop: 6 }}>{d.location ? '—' : 'no location'}</div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
          {d.looks.map((sl) => (
            <div key={sl.day_look_id} style={{ width: 72 }}>
              <LookThumb look={sl.look} size={72} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
                <span className="note" style={{ fontStyle: 'normal' }}>{sl.slot_label}</span>
                <button onClick={() => removeLook(sl.day_look_id)} aria-label="Remove look"
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
              </div>
            </div>
          ))}

          <button className="btn btn-ghost" onClick={() => setPicker({ open: true, date: d.date })}
            style={{ width: 72, height: 90, padding: 0, fontSize: 13, color: 'var(--ink-soft)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <span style={{ fontSize: 18 }}>+</span> Add
          </button>

          {d.looks.length === 0 && (
            <button className="btn btn-ghost" onClick={() => styleThisDay(d.date, d.location)} disabled={busyDate === d.date}
              style={{ height: 90, padding: '0 14px', fontSize: 13 }}>
              {busyDate === d.date ? <><span className="spinner" />&nbsp; Styling…</> : 'Style this day'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {picker.open && (
        <div style={{ marginBottom: 22, padding: 16, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 17 }}>Place a look on {fmtDate(picker.date)}</span>
            <button className="btn btn-ghost" onClick={() => setPicker({ open: false, date: null })} style={{ padding: '6px 12px', fontSize: 13 }}>Cancel</button>
          </div>
          {lookbook.length === 0 ? (
            <p className="note">Your Lookbook is empty. Love some looks on <a href="/style" style={{ color: 'var(--gold)' }}>Style</a> first.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 12 }}>
              {lookbook.map((l) => (
                <button key={l.id} onClick={() => addLook(picker.date, l.id)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                  <LookThumb look={l} size="100%" />
                  <div className="note" style={{ fontStyle: 'normal', marginTop: 4 }}>{l.title}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {data.mode === 'trip' ? (
        <div>
          <a href="/planner" className="navlink" style={{ display: 'inline-block', marginBottom: 10 }}>← Planner</a>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', maxWidth: 560 }}>
            <div className="field" style={{ margin: 0, flex: '1 1 200px' }}>
              <label>Trip name</label>
              <input value={tripName} onChange={(e) => setTripName(e.target.value)} style={selectStyle} />
            </div>
            <div className="field" style={{ margin: 0, flex: '1 1 160px' }}>
              <label>Location</label>
              <input value={tripLoc} onChange={(e) => setTripLoc(e.target.value)} placeholder="Florence…" style={selectStyle} />
            </div>
            <button className="btn btn-ghost" onClick={saveTrip} style={{ padding: '9px 16px' }}>Save</button>
          </div>
          <p className="note" style={{ fontStyle: 'normal', marginTop: 8 }}>{fmtRange(data.trip.start_date, data.trip.end_date)}</p>
        </div>
      ) : (
        <div>
          <h1 className="display">Planner</h1>
          <p className="lede">Your next two weeks. Drop looks onto days, or let Iris style one for the weather.</p>

          {data.trips.length > 0 && (
            <div style={{ marginTop: 18, display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 6 }}>
              {data.trips.map((t) => (
                <a key={t.id} href={`/planner?trip=${t.id}`} style={{ textDecoration: 'none', color: 'var(--ink)', width: 120, flexShrink: 0 }}>
                  <div style={{ borderRadius: 10, overflow: 'hidden', border: '0.5px solid var(--line)', background: 'var(--card)', aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {t.cover ? <FlatLay outfit={t.cover} idx={0} /> : <span className="note">no looks yet</span>}
                  </div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, marginTop: 6 }}>{t.name}</div>
                  <div className="note" style={{ fontStyle: 'normal' }}>{fmtRange(t.start_date, t.end_date)} · {t.look_count} look{t.look_count === 1 ? '' : 's'}</div>
                </a>
              ))}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            {!showCreate ? (
              <button className="btn btn-ghost" onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', fontSize: 14 }}>+ Plan a trip</button>
            ) : (
              <div style={{ padding: 16, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 4, maxWidth: 600 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
                  <div className="field" style={{ margin: 0 }}><label>Location</label><input value={cLoc} onChange={(e) => setCLoc(e.target.value)} placeholder="Florence…" style={selectStyle} /></div>
                  <div className="field" style={{ margin: 0 }}><label>Name (optional)</label><input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="defaults to the place" style={selectStyle} /></div>
                  <div className="field" style={{ margin: 0 }}><label>Start</label><input type="date" value={cStart} onChange={(e) => setCStart(e.target.value)} style={selectStyle} /></div>
                  <div className="field" style={{ margin: 0 }}><label>Days</label><input type="number" min="1" max="14" value={cDays} onChange={(e) => setCDays(Number(e.target.value))} style={selectStyle} /></div>
                </div>
                <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                  <button className="btn" onClick={createTrip} disabled={creating}>{creating ? 'Creating…' : 'Create trip'}</button>
                  <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        {groups.map((g, gi) =>
          g.trip_id ? (
            <div key={gi} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: '6px 14px 12px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 0 2px' }}>
                <a href={`/planner?trip=${g.trip_id}`} style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: 'var(--ink)', textDecoration: 'none' }}>{g.trip_name}</a>
                <span className="note" style={{ fontStyle: 'normal' }}>{fmtRange(g.days[0].date, g.days[g.days.length - 1].date)}</span>
              </div>
              {g.days.map((d) => <DayRow key={d.date} d={d} />)}
            </div>
          ) : (
            <div key={gi}>{g.days.map((d) => <DayRow key={d.date} d={d} />)}</div>
          )
        )}
      </div>

      {data.mode === 'trip' && (
        <div style={{ marginTop: 26 }}>
          <button className="btn btn-ghost" onClick={deleteTrip} style={{ padding: '8px 16px', fontSize: 13, color: 'var(--bad)' }}>Delete trip</button>
        </div>
      )}
    </div>
  );
}
