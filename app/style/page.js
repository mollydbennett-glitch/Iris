'use client';

import { useState } from 'react';

const OCCASIONS = ['Everyday', 'Work', 'Dinner', 'Date night', 'Weekend', 'Event / party', 'Workout', 'Trip'];

// Sort an outfit's items into a flat-lay arrangement.
function arrange(items) {
  const isTop = (c) => ['top', 'dress', 'outerwear'].includes(c);
  const heroTop = items.find((i) => isTop(i.category)) || items[0];
  const heroBottom = items.find((i) => i.category === 'bottom' && i !== heroTop);
  const rest = items.filter((i) => i !== heroTop && i !== heroBottom);
  return { heroTop, heroBottom, rest };
}

function ItemImg({ it, style }) {
  const src = it.cutout_url || it.image_url;
  return (
    <img
      src={src}
      alt=""
      style={{
        maxWidth: '100%',
        maxHeight: '100%',
        objectFit: 'contain',
        display: 'block',
        margin: '0 auto',
        ...style,
      }}
    />
  );
}

function FlatLay({ outfit }) {
  const { heroTop, heroBottom, rest } = arrange(outfit.items);
  return (
    <div
      style={{
        position: 'relative',
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: 6,
        padding: '22px 24px 28px',
        overflow: 'hidden',
      }}
    >
      {/* header: Iris wordmark + outfit title */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
        <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 18, color: 'var(--ink)' }}>Iris</span>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 19, color: 'var(--ink)' }}>{outfit.title}</span>
      </div>

      {/* composition: hero top + small items on the left, hero bottom on the right */}
      <div style={{ display: 'flex', gap: 18, alignItems: 'stretch', minHeight: 320 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          {heroTop && (
            <div style={{ height: heroBottom ? 230 : 300 }}>
              <ItemImg it={heroTop} />
            </div>
          )}
          {rest.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', justifyContent: 'center' }}>
              {rest.map((it) => (
                <div key={it.id} style={{ width: 92, height: 92 }}>
                  <ItemImg it={it} />
                </div>
              ))}
            </div>
          )}
        </div>
        {heroBottom && (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
            <ItemImg it={heroBottom} style={{ maxHeight: 360 }} />
          </div>
        )}
      </div>

      {/* faint Iris mark, like the reference watermark */}
      <span style={{ position: 'absolute', bottom: 8, right: 12, fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 12, color: 'var(--line)', letterSpacing: 1 }}>
        Iris
      </span>
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
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 28 }}>
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
