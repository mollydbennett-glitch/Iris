'use client';

import { useState } from 'react';

const OCCASIONS = ['Everyday', 'Work', 'Dinner', 'Date night', 'Weekend', 'Event / party', 'Workout', 'Trip'];

export default function StylePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [occasion, setOccasion] = useState('Everyday');
  const [count, setCount] = useState(5);
  const [tripLength, setTripLength] = useState(3);
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [outfits, setOutfits] = useState(null);
  const [weather, setWeather] = useState(null);

  const isTrip = occasion === 'Trip';

  async function generate() {
    setLoading(true);
    setError('');
    setOutfits(null);
    setWeather(null);
    try {
      const res = await fetch('/api/outfits/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          occasion,
          count: isTrip ? tripLength : count,
          tripLength: isTrip ? tripLength : null,
          location: location.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setOutfits(data.outfits);
      setWeather(data.weather);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const selectStyle = {
    padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 2,
    background: '#fff', color: 'var(--ink)', fontSize: 14, width: '100%',
  };

  return (
    <div>
      <h1 className="display">What to wear</h1>
      <p className="lede">Tell Iris the plan. She’ll style complete looks from your closet — weather and occasion considered.</p>

      <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, maxWidth: 620 }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={selectStyle} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Occasion</label>
          <select value={occasion} onChange={(e) => setOccasion(e.target.value)} style={selectStyle}>
            {OCCASIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        {isTrip ? (
          <div className="field" style={{ margin: 0 }}>
            <label>Trip length (days)</label>
            <input type="number" min="1" max="10" value={tripLength}
              onChange={(e) => setTripLength(Number(e.target.value))} style={selectStyle} />
          </div>
        ) : (
          <div className="field" style={{ margin: 0 }}>
            <label>How many outfits</label>
            <input type="number" min="1" max="10" value={count}
              onChange={(e) => setCount(Number(e.target.value))} style={selectStyle} />
          </div>
        )}
        <div className="field" style={{ margin: 0 }}>
          <label>Location (blank = default)</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="from Settings" style={selectStyle} />
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <button className="btn" onClick={generate} disabled={loading}>
          {loading ? <><span className="spinner" />&nbsp; Styling…</> : 'Generate outfits'}
        </button>
        {error && <p className="status err" style={{ display: 'block', marginTop: 10 }}>{error}</p>}
      </div>

      {weather?.ok && (
        <p className="note" style={{ marginTop: 16, fontStyle: 'normal' }}>
          {weather.location} · ~{weather.high}°F / {weather.low}°F · {weather.description}
          {weather.source === 'seasonal' ? ' (seasonal estimate)' : ''}
        </p>
      )}

      {outfits && outfits.length > 0 && (
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {outfits.map((o, idx) => (
            <div key={idx} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 4, padding: 18 }}>
              <h3 className="serif" style={{ fontWeight: 400, fontSize: 20, margin: '0 0 12px' }}>{o.title}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {o.items.map((it) => (
                  <div key={it.id} style={{ width: 96 }}>
                    <div style={{ width: 96, height: 120, background: it.cutout_url ? '#fff' : 'var(--gold-soft)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--line)' }}>
                      <img src={it.cutout_url || it.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: it.cutout_url ? 'contain' : 'cover', padding: it.cutout_url ? 6 : 0, display: 'block' }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4, textTransform: 'capitalize' }}>
                      {it.subcategory || it.category}
                    </div>
                  </div>
                ))}
              </div>
              {o.why && <p style={{ fontSize: 14, lineHeight: 1.55, marginTop: 14 }}>{o.why}</p>}
              {o.styling_tip && (
                <p style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 8 }}>
                  <strong style={{ color: 'var(--gold)' }}>Styling tip · </strong>{o.styling_tip}
                </p>
              )}
              {o.gap && (
                <p className="note" style={{ marginTop: 10 }}>Gap to complete it: {o.gap}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {outfits && outfits.length === 0 && (
        <p className="lede" style={{ marginTop: 20 }}>Iris couldn’t assemble a look this time — try a different occasion or add a few pieces.</p>
      )}
    </div>
  );
}
