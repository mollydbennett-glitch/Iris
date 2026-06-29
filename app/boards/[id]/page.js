'use client';

import { useState, useEffect, useCallback, use as usePromise } from 'react';
import { useRouter } from 'next/navigation';
import { FlatLay } from '@/components/FlatLay';

function fmtDay(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function weatherLine(w) {
  if (!w) return null;
  let s = `${w.location} · ${w.high}°/${w.low}°F · ${w.description}`;
  if (w.source === 'seasonal') s += ' (seasonal estimate)';
  return s;
}

export default function BoardPage({ params }) {
  const { id } = usePromise(params); // Next 15+: params is a promise
  const router = useRouter();

  const [plan, setPlan] = useState(null);
  const [days, setDays] = useState([]);
  const [looks, setLooks] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [locInput, setLocInput] = useState('');
  const [savingLoc, setSavingLoc] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [planRes, looksRes] = await Promise.all([
        fetch(`/api/plans/${id}`),
        fetch('/api/outfits/saved'),
      ]);
      const planData = await planRes.json();
      if (!planRes.ok) throw new Error(planData.error || 'Failed to load board');
      const looksData = await looksRes.json();
      setPlan(planData.plan);
      setDays(planData.days || []);
      setLocInput(planData.plan?.location || '');
      setLooks(looksData.outfits || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function updateLocation() {
    setSavingLoc(true);
    try {
      await fetch(`/api/plans/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: locInput.trim() || null }),
      });
      await load(); // refresh so weather recomputes for the new location
    } finally {
      setSavingLoc(false);
    }
  }

  async function assignLook(date, lookId) {
    if (!lookId) return;
    const look = looks.find((l) => l.id === lookId) || null;
    setDays((prev) => prev.map((d) => (d.date === date ? { ...d, saved_outfit_id: lookId, look } : d)));
    await fetch(`/api/plans/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setDay: { date, saved_outfit_id: lookId } }),
    });
  }

  async function clearDay(date) {
    setDays((prev) => prev.map((d) => (d.date === date ? { ...d, saved_outfit_id: null, look: null } : d)));
    await fetch(`/api/plans/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setDay: { date, saved_outfit_id: null } }),
    });
  }

  async function deleteBoard() {
    if (!confirm('Delete this board? The looks you kept stay in your Kept looks.')) return;
    await fetch(`/api/plans/${id}`, { method: 'DELETE' });
    router.push('/boards');
  }

  if (loading) return <p className="note"><span className="spinner" />&nbsp; Loading board…</p>;
  if (error) return <p className="status err" style={{ display: 'block' }}>{error}</p>;
  if (!plan) return null;

  const selectStyle = { padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 2, background: '#fff', color: 'var(--ink)', fontSize: 14, width: '100%' };

  return (
    <div>
      <a href="/boards" className="navlink" style={{ display: 'inline-block', marginBottom: 10 }}>← All boards</a>
      <h1 className="display" style={{ marginBottom: 6 }}>{plan.plan_name}</h1>
      <p className="note" style={{ fontStyle: 'normal', marginTop: 0 }}>
        <span className="pill">{plan.plan_type === 'trip' ? 'Trip' : 'Weekly'}</span>
        {days.length} day{days.length === 1 ? '' : 's'}
      </p>

      <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'flex-end', maxWidth: 460 }}>
        <div className="field" style={{ margin: 0, flex: 1 }}>
          <label>Location (sets the weather)</label>
          <input value={locInput} onChange={(e) => setLocInput(e.target.value)} placeholder="Chicago, Florence…" style={selectStyle} />
        </div>
        <button className="btn btn-ghost" onClick={updateLocation} disabled={savingLoc} style={{ padding: '9px 16px' }}>
          {savingLoc ? 'Saving…' : 'Update'}
        </button>
      </div>

      {looks.length === 0 && (
        <p className="note" style={{ marginTop: 18 }}>
          No kept looks yet. Generate some on <a href="/style" style={{ color: 'var(--gold)' }}>What to wear</a> and tap the heart, then slot them here.
        </p>
      )}

      <div style={{ marginTop: 22, display: 'grid', gap: 14 }}>
        {days.map((d) => (
          <div key={d.date} style={{ display: 'flex', gap: 16, padding: 14, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 4 }}>
            <div style={{ width: 160, flexShrink: 0 }}>
              <p style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 17 }}>{d.day_name}</p>
              <p className="note" style={{ marginTop: 2, fontStyle: 'normal' }}>{fmtDay(d.date)}</p>
              <p className="note" style={{ marginTop: 8 }}>
                {weatherLine(d.weather) || (plan.location ? 'Weather unavailable' : 'Add a location above for weather')}
              </p>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {d.look ? (
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ width: 150, flexShrink: 0 }}>
                    <FlatLay outfit={d.look} idx={0} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 15 }}>{d.look.title}</p>
                    <button className="btn btn-ghost" onClick={() => clearDay(d.date)} style={{ padding: '6px 14px', fontSize: 13, marginTop: 8 }}>
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ maxWidth: 320 }}>
                  <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--ink-soft)', marginBottom: 4 }}>
                    Slot a kept look
                  </label>
                  <select
                    value=""
                    onChange={(e) => assignLook(d.date, e.target.value)}
                    disabled={looks.length === 0}
                    style={selectStyle}
                  >
                    <option value="">Choose a look…</option>
                    {looks.map((l) => (
                      <option key={l.id} value={l.id}>{l.title}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28 }}>
        <button className="btn btn-ghost" onClick={deleteBoard} style={{ padding: '8px 16px', fontSize: 13, color: 'var(--bad)', borderColor: 'var(--line)' }}>
          Delete board
        </button>
      </div>
    </div>
  );
}
