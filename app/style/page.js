'use client';

import { useState } from 'react';

const OCCASIONS = ['Everyday', 'Work', 'Dinner', 'Date night', 'Weekend', 'Event / party', 'Workout', 'Trip'];

function Cell({ it, style }) {
  const src = it.cutout_url || it.image_url;
  return (
    <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
      <img src={src} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
    </div>
  );
}

// Uniform packed grid: cells tile the frame with no gaps and stay near-square,
// so no piece gets a giant tall/wide slot full of white. Odd last item spans
// the full width. Cards are small and shown two-up, so white reads as minimal.
function FlatLay({ outfit }) {
  const items = outfit.items;
  const n = items.length;
  const cols = n === 1 ? 1 : 2;
  const rows = Math.ceil(n / cols);
  const oddSpan = n > 1 && n % 2 === 1;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8, paddingLeft: 1 }}>
        <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 15, color: 'var(--ink)' }}>Iris</span>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: 'var(--ink)' }}>{outfit.title}</span>
      </div>
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: `${cols} / ${rows}`,
          background: '#fff',
          border: '1px solid var(--line)',
          borderRadius: 5,
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridAutoRows: '1fr',
          gap: 0,
        }}
      >
        {items.map((it, i) => {
          const isLast = i === n - 1;
          const span = oddSpan && isLast ? { gridColumn: '1 / 3' } : {};
          return <Cell key={it.id} it={it} style={span} />;
        })}
        <span style={{ position: 'absolute', bottom: 6, right: 9, fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 11, color: 'var(--line)', letterSpacing: 1, zIndex: 5 }}>Iris</span>
      </div>
    </div>
  );
}

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

  const selectStyle = { padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 2, background: '#fff', color: 'var(--ink)', fontSize: 14, width: '100%' };

  return (
    <div>
      <h1 className="display">What to wear</h1>
      <p className="lede">Tell Iris the plan. She’ll style complete looks from your closet, weather and occasion considered.</p>

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
            <input type="number" min="1" max="10" value={tripLength} onChange={(e) => setTripLength(Number(e.target.value))} style={selectStyle} />
          </div>
        ) : (
          <div className="field" style={{ margin: 0 }}>
            <label>How many outfits</label>
            <input type="number" min="1" max="10" value={count} onChange={(e) => setCount(Number(e.target.value))} style={selectStyle} />
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
        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 30 }}>
          {outfits.map((o, idx) => (
            <div key={idx}>
              <FlatLay outfit={o} />
              <div style={{ padding: '14px 4px 0' }}>
                {o.why && <p style={{ fontSize: 14, lineHeight: 1.55, margin: 0 }}>{o.why}</p>}
                {o.styling_tip && (
                  <p style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 8 }}>
                    <strong style={{ color: 'var(--gold)' }}>Styling tip · </strong>{o.styling_tip}
                  </p>
                )}
                {o.gap && <p className="note" style={{ marginTop: 10 }}>Gap to complete it: {o.gap}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {outfits && outfits.length === 0 && (
        <p className="lede" style={{ marginTop: 20 }}>Iris couldn’t assemble a look this time. Try a different occasion or add a few pieces.</p>
      )}
    </div>
  );
}
