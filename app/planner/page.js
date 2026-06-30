'use client';

import { useState, useEffect, useCallback } from 'react';
import { FlatLay } from '@/components/FlatLay';

const ISO = (d) => d.toISOString().slice(0, 10);
function weekMonday(dateStr) {
  const x = new Date(`${dateStr}T00:00:00`);
  const back = (x.getDay() + 6) % 7; // days since Monday
  x.setDate(x.getDate() - back);
  return ISO(x);
}
function shift(dateStr, n) {
  const x = new Date(`${dateStr}T00:00:00`);
  x.setDate(x.getDate() + n);
  return ISO(x);
}
function fmtDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function fmtRange(a, b) {
  if (!a) return '';
  const s = fmtDate(a);
  return !b || b === a ? s : `${s} – ${fmtDate(b)}`;
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(40,36,32,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 };
const sheet = { background: '#fff', borderRadius: 8, padding: 20, maxWidth: 560, width: '100%', maxHeight: '85vh', overflowY: 'auto' };
const inputStyle = { padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 2, background: '#fff', color: 'var(--ink)', fontSize: 14, width: '100%' };

export default function PlannerPage() {
  const today = ISO(new Date());
  const [weekStart, setWeekStart] = useState(weekMonday(today));
  const [data, setData] = useState(null);
  const [lookbook, setLookbook] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [picker, setPicker] = useState({ open: false, date: null });
  const [detail, setDetail] = useState({ open: false, loading: false, look: null, dayLookId: null });
  const [busyDate, setBusyDate] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [cLoc, setCLoc] = useState('');
  const [cName, setCName] = useState('');
  const [cStart, setCStart] = useState(today);
  const [cDays, setCDays] = useState(5);
  const [renaming, setRenaming] = useState(null);
  const [renameVal, setRenameVal] = useState('');

  const load = useCallback(async (start) => {
    setLoading(true);
    try {
      const [aRes, lRes] = await Promise.all([
        fetch(`/api/agenda?start=${start}&days=7`),
        fetch('/api/outfits/saved'),
      ]);
      const aData = await aRes.json();
      if (!aRes.ok) throw new Error(aData.error || 'Failed to load planner');
      const lData = await lRes.json();
      setData(aData);
      setLookbook(lData.outfits || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(weekStart); }, [load, weekStart]);
  const reload = () => load(weekStart);

  async function addLook(date, lookId) {
    await fetch('/api/day-looks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, saved_outfit_id: lookId }) });
    setPicker({ open: false, date: null });
    reload();
  }
  async function moveLook(dayLookId, toDate) {
    await fetch(`/api/day-looks/${dayLookId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: toDate }) });
    reload();
  }
  async function removeLook(dayLookId) {
    await fetch(`/api/day-looks/${dayLookId}`, { method: 'DELETE' });
    setDetail({ open: false, loading: false, look: null, dayLookId: null });
    reload();
  }
  async function styleThisDay(date, location) {
    setBusyDate(date);
    try {
      const res = await fetch('/api/outfits/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, occasion: 'Everyday', count: 1, location: location || null }) });
      const d = await res.json();
      const look = d.outfits && d.outfits[0];
      if (look?.id) await fetch('/api/day-looks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, saved_outfit_id: look.id }) });
      reload();
    } finally { setBusyDate(null); }
  }
  async function openDetail(lookId, dayLookId) {
    setDetail({ open: true, loading: true, look: null, dayLookId });
    try {
      const res = await fetch(`/api/outfits/${lookId}`);
      const d = await res.json();
      setDetail({ open: true, loading: false, look: d.look, dayLookId });
    } catch { setDetail({ open: false, loading: false, look: null, dayLookId: null }); }
  }
  async function createTrip() {
    const end = shift(cStart, Math.max(1, Number(cDays)) - 1);
    const res = await fetch('/api/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: cName.trim() || null, location: cLoc.trim() || null, start_date: cStart, end_date: end }) });
    if (res.ok) { setShowCreate(false); setCName(''); setCLoc(''); setWeekStart(weekMonday(cStart)); }
  }
  async function saveRename(id) {
    await fetch(`/api/plans/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: renameVal }) });
    setRenaming(null); reload();
  }
  async function deleteTrip(id) {
    if (!confirm('Delete this trip? The looks you placed stay on those days.')) return;
    await fetch(`/api/plans/${id}`, { method: 'DELETE' });
    reload();
  }

  function onDragStart(e, payload) { e.dataTransfer.setData('text/plain', JSON.stringify(payload)); e.dataTransfer.effectAllowed = 'move'; }
  function onDrop(e, date) {
    e.preventDefault();
    let p; try { p = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
    if (p.type === 'lookbook') addLook(date, p.lookId);
    else if (p.type === 'placed' && p.fromDate !== date) moveLook(p.dayLookId, date);
  }

  if (loading && !data) return <p className="note"><span className="spinner" />&nbsp; Loading…</p>;
  if (error) return <p className="status err" style={{ display: 'block' }}>{error}</p>;
  if (!data) return null;

  const weekEnd = data.days.length ? data.days[data.days.length - 1].date : weekStart;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h1 className="display" style={{ margin: 0 }}>Planner</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => setWeekStart(shift(weekStart, -7))} aria-label="Previous week" style={{ padding: '6px 12px' }}>‹</button>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 16, minWidth: 130, textAlign: 'center' }}>{fmtRange(weekStart, weekEnd)}</span>
          <button className="btn btn-ghost" onClick={() => setWeekStart(shift(weekStart, 7))} aria-label="Next week" style={{ padding: '6px 12px' }}>›</button>
          <button className="btn btn-ghost" onClick={() => setWeekStart(weekMonday(today))} style={{ padding: '6px 12px', fontSize: 13 }}>Today</button>
        </div>
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" onClick={() => setShowCreate(true)} style={{ padding: '7px 14px', fontSize: 13 }}>+ Plan a trip</button>
        <span className="note" style={{ fontStyle: 'normal' }}>Drag a look between days, or onto a day from your Lookbook.</span>
      </div>

      {data.trips.map((t) => (
        <div key={t.id} style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px' }}>
          {renaming === t.id ? (
            <>
              <input value={renameVal} onChange={(e) => setRenameVal(e.target.value)} style={{ ...inputStyle, width: 200 }} />
              <button className="btn btn-ghost" onClick={() => saveRename(t.id)} style={{ padding: '6px 12px', fontSize: 13 }}>Save</button>
            </>
          ) : (
            <>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: 16 }}>{t.name}</span>
              <span className="note" style={{ fontStyle: 'normal' }}>{t.location ? `${t.location} · ` : ''}{fmtRange(t.start_date, t.end_date)}</span>
              <button onClick={() => { setRenaming(t.id); setRenameVal(t.name); }} className="note" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)' }}>rename</button>
              <button onClick={() => deleteTrip(t.id)} className="note" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bad)' }}>delete</button>
            </>
          )}
        </div>
      ))}

      <div style={{ marginTop: 18, overflowX: 'auto', paddingBottom: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, minWidth: 760 }}>
          {data.days.map((d) => {
            const inTrip = !!d.trip_id;
            return (
              <div key={d.date}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, d.date)}
                style={{ background: inTrip ? 'var(--card)' : 'transparent', border: inTrip ? '1px solid var(--line)' : '1px solid transparent', borderRadius: 8, padding: 8, minHeight: 200 }}>
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{d.day_name.slice(0, 3)}</div>
                  <div className="note" style={{ fontStyle: 'normal' }}>{fmtDate(d.date)}</div>
                  <div className="note" style={{ marginTop: 2 }}>{d.weather ? `${d.weather.high}°/${d.weather.low}°` : (d.location ? '—' : 'set loc')}</div>
                </div>

                <div style={{ display: 'grid', gap: 6 }}>
                  {d.looks.map((sl) => (
                    <div key={sl.day_look_id} draggable
                      onDragStart={(e) => onDragStart(e, { type: 'placed', dayLookId: sl.day_look_id, fromDate: d.date })}
                      style={{ position: 'relative', cursor: 'grab' }}>
                      <div onClick={() => openDetail(sl.look.id, sl.day_look_id)} style={{ cursor: 'pointer' }}>
                        <FlatLay outfit={sl.look} idx={0} />
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); removeLook(sl.day_look_id); }} aria-label="Remove"
                        style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, lineHeight: '16px', textAlign: 'center', borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.9)', color: 'var(--ink-soft)', cursor: 'pointer', fontSize: 12 }}>×</button>
                      <div className="note" style={{ fontStyle: 'normal', textAlign: 'center', marginTop: 2 }}>{sl.slot_label}</div>
                    </div>
                  ))}

                  <button className="btn btn-ghost" onClick={() => setPicker({ open: true, date: d.date })}
                    style={{ padding: '10px 0', fontSize: 12, color: 'var(--ink-soft)' }}>+ Add</button>

                  {d.looks.length === 0 && (
                    <button className="btn btn-ghost" onClick={() => styleThisDay(d.date, d.location)} disabled={busyDate === d.date}
                      style={{ padding: '8px 0', fontSize: 12 }}>
                      {busyDate === d.date ? '…' : 'Style this day'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showCreate && (
        <div style={overlay} onClick={() => setShowCreate(false)}>
          <div style={sheet} onClick={(e) => e.stopPropagation()}>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 19, margin: '0 0 14px' }}>Plan a trip</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="field" style={{ margin: 0 }}><label>Location</label><input value={cLoc} onChange={(e) => setCLoc(e.target.value)} placeholder="Florence…" style={inputStyle} /></div>
              <div className="field" style={{ margin: 0 }}><label>Name (optional)</label><input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="defaults to the place" style={inputStyle} /></div>
              <div className="field" style={{ margin: 0 }}><label>Start</label><input type="date" value={cStart} onChange={(e) => setCStart(e.target.value)} style={inputStyle} /></div>
              <div className="field" style={{ margin: 0 }}><label>Days</label><input type="number" min="1" max="14" value={cDays} onChange={(e) => setCDays(Number(e.target.value))} style={inputStyle} /></div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button className="btn" onClick={createTrip}>Create trip</button>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {picker.open && (
        <div style={overlay} onClick={() => setPicker({ open: false, date: null })}>
          <div style={sheet} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: 18 }}>Add a look to {fmtDate(picker.date)}</span>
              <button className="btn btn-ghost" onClick={() => setPicker({ open: false, date: null })} style={{ padding: '6px 12px', fontSize: 13 }}>Cancel</button>
            </div>
            {lookbook.length === 0 ? (
              <p className="note">Your Lookbook is empty. Love some looks on <a href="/style" style={{ color: 'var(--gold)' }}>Style</a> first.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 12 }}>
                {lookbook.map((l) => (
                  <button key={l.id} onClick={() => addLook(picker.date, l.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                    <FlatLay outfit={l} idx={0} />
                    <div className="note" style={{ fontStyle: 'normal', marginTop: 4 }}>{l.title}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {detail.open && (
        <div style={overlay} onClick={() => setDetail({ open: false, loading: false, look: null, dayLookId: null })}>
          <div style={sheet} onClick={(e) => e.stopPropagation()}>
            {detail.loading || !detail.look ? (
              <p className="note"><span className="spinner" />&nbsp; Loading…</p>
            ) : (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ width: 180, flexShrink: 0 }}><FlatLay outfit={detail.look} idx={0} /></div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ fontFamily: 'Georgia, serif', fontSize: 19, margin: 0 }}>{detail.look.title}</p>
                  {detail.look.why && <p style={{ fontSize: 14, lineHeight: 1.55, marginTop: 8 }}>{detail.look.why}</p>}
                  {detail.look.styling_tip && <p style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 8 }}><strong style={{ color: 'var(--gold)' }}>Styling tip · </strong>{detail.look.styling_tip}</p>}
                  {detail.look.scores && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                      {[['Proportions', 'proportions'], ['Aesthetic', 'aesthetic'], ['Cohesion', 'cohesion'], ['Style', 'style']].map(([lab, k]) => (
                        <span key={k} className="note" style={{ fontStyle: 'normal', border: '1px solid var(--line)', borderRadius: 999, padding: '2px 9px' }}>{lab} {detail.look.scores[k] ?? '–'}</span>
                      ))}
                    </div>
                  )}
                  {detail.look.gap && <p className="note" style={{ marginTop: 10 }}>Missing piece · {detail.look.gap}{detail.look.gap_workaround ? ` — for now, ${detail.look.gap_workaround}` : ''}</p>}
                  <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                    {detail.dayLookId && <button className="btn btn-ghost" onClick={() => removeLook(detail.dayLookId)} style={{ padding: '8px 16px', fontSize: 13, color: 'var(--bad)' }}>Remove from day</button>}
                    <button className="btn btn-ghost" onClick={() => setDetail({ open: false, loading: false, look: null, dayLookId: null })} style={{ padding: '8px 16px', fontSize: 13 }}>Close</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
