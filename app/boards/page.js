'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function fmtRange(start, end) {
  if (!start) return 'No dates set';
  const opts = { month: 'short', day: 'numeric' };
  const s = new Date(`${start}T00:00:00`).toLocaleDateString(undefined, opts);
  if (!end || end === start) return s;
  const e = new Date(`${end}T00:00:00`).toLocaleDateString(undefined, opts);
  return `${s} – ${e}`;
}

export default function BoardsPage() {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [plans, setPlans] = useState(null);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [type, setType] = useState('weekly');
  const [location, setLocation] = useState('');
  const [start, setStart] = useState(today);
  const [days, setDays] = useState(7);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/plans');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        setPlans(data.plans || []);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  async function create() {
    if (!name.trim()) { setError('Give the board a name.'); return; }
    setCreating(true);
    setError('');
    try {
      const end = addDays(start, Math.max(1, Number(days)) - 1);
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_name: name.trim(), plan_type: type, location: location.trim() || null, start_date: start, end_date: end }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create the board');
      router.push(`/boards/${data.plan.id}`);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  const selectStyle = { padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 2, background: '#fff', color: 'var(--ink)', fontSize: 14, width: '100%' };

  return (
    <div>
      <h1 className="display">Boards</h1>
      <p className="lede">Plan a week or a trip. Each day shows its weather, and you drop in looks you’ve kept.</p>

      <div style={{ marginTop: 24, padding: 18, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 4, maxWidth: 640 }}>
        <p style={{ margin: '0 0 14px', fontFamily: 'Georgia, serif', fontSize: 18 }}>New board</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Italy trip, Week of Jul 1…" style={selectStyle} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} style={selectStyle}>
              <option value="weekly">Weekly</option>
              <option value="trip">Trip</option>
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Chicago, Florence…" style={selectStyle} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Start date</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={selectStyle} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>How many days</label>
            <input type="number" min="1" max="14" value={days} onChange={(e) => setDays(Number(e.target.value))} style={selectStyle} />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="btn" onClick={create} disabled={creating}>
            {creating ? <><span className="spinner" />&nbsp; Creating…</> : 'Create board'}
          </button>
        </div>
        {error && <p className="status err" style={{ display: 'block', marginTop: 10 }}>{error}</p>}
      </div>

      <div style={{ marginTop: 30 }}>
        {plans === null && !error && <p className="note"><span className="spinner" />&nbsp; Loading…</p>}
        {plans && plans.length === 0 && <p className="note">No boards yet. Create your first above.</p>}
        {plans && plans.length > 0 && (
          <div className="cards">
            {plans.map((p) => (
              <a key={p.id} href={`/boards/${p.id}`} className="card" style={{ textDecoration: 'none', color: 'var(--ink)', alignItems: 'center' }}>
                <div className="card-body">
                  <p style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 19 }}>{p.plan_name}</p>
                  <p className="note" style={{ marginTop: 4, fontStyle: 'normal' }}>
                    <span className="pill">{p.plan_type === 'trip' ? 'Trip' : 'Weekly'}</span>
                    {fmtRange(p.start_date, p.end_date)}{p.location ? ` · ${p.location}` : ''}
                  </p>
                  <p className="note" style={{ marginTop: 6 }}>{p.filled} look{p.filled === 1 ? '' : 's'} slotted</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
