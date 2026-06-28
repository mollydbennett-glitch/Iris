'use client';

import { useState } from 'react';

const OCCASIONS = ['Everyday', 'Work', 'Dinner', 'Date night', 'Weekend', 'Event / party', 'Workout', 'Trip'];

function PositionedItem({ it, slot, z }) {
  const src = it.cutout_url || it.image_url;
  return (
    <div
      style={{
        position: 'absolute',
        ...slot,
        zIndex: z,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img src={src} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
    </div>
  );
}

// Editorial collage layout, modeled on the reference flat-lays:
// big top-left garment, tall garment on the right, accessories clustered
// lower-left, with slight overlaps so it reads styled, not catalog.
function FlatLay({ outfit }) {
  const items = outfit.items;
  const tops = items.filter((i) => ['top', 'dress', 'outerwear'].includes(i.category));
  const bottom = items.find((i) => i.category === 'bottom');
  const heroTop = tops[0];
  const secondTop = tops[1];
  const used = new Set([heroTop, secondTop, bottom].filter(Boolean));
  const extras = items.filter((i) => !used.has(i));

  // Lower-left cluster slots for accessories (shoes, bag, sunglasses, jewelry…).
  const extraSlots = [
    { left: '2%', top: '54%', width: '27%', height: '22%' },
    { left: '28%', top: '64%', width: '28%', height: '26%' },
    { left: '3%', top: '76%', width: '24%', height: '22%' },
    { left: '31%', top: '44%', width: '18%', height: '15%' },
    { left: '15%', top: '40%', width: '14%', height: '12%' },
  ];

  return (
    <div>
      {/* header sits above the canvas, clean */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, paddingLeft: 2 }}>
        <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 18, color: 'var(--ink)' }}>Iris</span>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 19, color: 'var(--ink)' }}>{outfit.title}</span>
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '4 / 5',
          background: '#fff',
          border: '1px solid var(--line)',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        {heroTop && <PositionedItem it={heroTop} z={2} slot={{ top: '5%', left: '1%', width: '50%', height: '46%' }} />}
        {secondTop && <PositionedItem it={secondTop} z={3} slot={{ top: '20%', left: '24%', width: '40%', height: '40%' }} />}
        {bottom && <PositionedItem it={bottom} z={1} slot={{ top: '3%', right: '0%', width: '47%', height: '90%' }} />}
        {extras.map((it, i) => (extraSlots[i] ? <PositionedItem key={it.id} it={it} z={4} slot={extraSlots[i]} /> : null))}

        {/* faint Iris mark, like the reference watermark */}
        <span style={{ position: 'absolute', bottom: 10, right: 14, fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 13, color: 'var(--line)', letterSpacing: 1, zIndex: 6 }}>
          Iris
        </span>
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
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 36, alignItems: 'center' }}>
          {outfits.map((o, idx) => (
            <div key={idx} style={{ width: '100%', maxWidth: 460 }}>
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
