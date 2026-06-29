'use client';

import { useState, useEffect } from 'react';

const OCCASIONS = ['Everyday', 'Work', 'Dinner', 'Date night', 'Weekend', 'Event / party', 'Workout', 'Trip'];

// ---- Aspect-aware flat-lay ------------------------------------------------
// Pack like a charcuterie board: every piece is sized to its OWN proportions
// (measured from the image) so it fills its spot instead of floating in a box.
// Bigger pieces dominate, accessories stay small, smaller pieces layer on top,
// edges bleed off the frame. The longest vertical piece anchors one side; the
// spine side alternates per outfit. Cards are all one size; a count-based scale
// factor makes sparse looks bigger so the frame never goes empty.

function roleOf(it) {
  const c = ((it.category || '') + ' ' + (it.subcategory || '')).toLowerCase();
  if (/dress|gown|jumpsuit|romper|overall|maxi/.test(c)) return 'dress';
  if (/pant|trouser|jean|denim|skirt|legging|slack|chino|culotte|flare|wide.?leg/.test(c)) return 'bottomLong';
  if (/short/.test(c)) return 'bottomShort';
  if (/coat|jacket|blazer|outerwear|trench|parka|cardigan|vest/.test(c)) return 'outer';
  if (/top|shirt|blouse|sweater|knit|tee|t.?shirt|tank|cami|bodysuit|turtleneck|pullover|hoodie|henley/.test(c)) return 'top';
  if (/shoe|heel|sandal|boot|sneaker|flat|loafer|mule|pump|footwear|slide/.test(c)) return 'shoes';
  if (/bag|clutch|tote|purse|handbag|crossbody|satchel|pouch|basket/.test(c)) return 'bag';
  if (/sunglass|glasses|eyewear|shade/.test(c)) return 'sunnies';
  if (/belt|scarf|hat|cap|glove|tights|sock/.test(c)) return 'accMed';
  if (/jewel|earring|necklace|ring|bracelet|watch|pendant|brooch|cuff|stud/.test(c)) return 'jewel';
  return 'accMed';
}

const GARMENT = new Set(['outer', 'top', 'bottomLong', 'bottomShort']);
const SPINE_PREF = ['dress', 'bottomLong', 'outer', 'top', 'bottomShort'];
const ACC_RANK = { bag: 0, shoes: 1, accMed: 2, sunnies: 3, jewel: 4 };
const DEFAULT_AR = { dress: 0.42, bottomLong: 0.45, bottomShort: 1.05, outer: 0.92, top: 0.95, shoes: 1.45, bag: 1.3, sunnies: 2.3, jewel: 1.0, accMed: 1.3 };

function srcOf(it) { return it.cutout_url || it.image_url; }

function place(slot, ar, f, maxH) {
  let h = Math.min(slot.targetH * f, maxH || 108);
  let w = h * ar;
  const mw = slot.maxW * f;
  if (w > mw) { w = mw; h = w / ar; }
  const left = slot.anchorH === 'l' ? slot.ax : slot.ax - w;
  const top = slot.anchorV === 't' ? slot.ay : slot.ay - h;
  return { left, top, width: w, height: h, z: slot.z, pos: slot.pos || 'center' };
}

function planBoxes(items, idx, aspects) {
  const roled = items.map((it) => ({ it, role: roleOf(it) }));
  const spineRight = idx % 2 === 0;
  let spine = null;
  for (const w of SPINE_PREF) { spine = roled.find((r) => r.role === w); if (spine) break; }
  if (!spine) spine = roled[0];
  const rest = roled.filter((r) => r !== spine);
  const tops = rest.filter((r) => GARMENT.has(r.role));
  const accs = rest.filter((r) => !GARMENT.has(r.role));
  accs.sort((a, b) => (ACC_RANK[a.role] ?? 2) - (ACC_RANK[b.role] ?? 2));
  const n = items.length;
  const hasTops = tops.length > 0;
  const f = Math.max(0.82, Math.min(1.22, 1 + (5 - n) * 0.06));
  const arOf = (r) => (aspects && aspects[r.it.id]) || DEFAULT_AR[r.role] || 1;

  const spineSlot = hasTops
    ? { ax: 104, ay: -1, anchorH: 'r', anchorV: 't', targetH: 101, maxW: 55, z: 1 }
    : { ax: 104, ay: -1, anchorH: 'r', anchorV: 't', targetH: 101, maxW: 58, z: 1 };
  let topSlots = [];
  if (tops.length === 1) topSlots = [{ ax: -4, ay: -2, anchorH: 'l', anchorV: 't', targetH: 60, maxW: 60, z: 2 }];
  else if (tops.length === 2) topSlots = [
    { ax: -4, ay: -2, anchorH: 'l', anchorV: 't', targetH: 56, maxW: 42, z: 2 },
    { ax: 30, ay: 1, anchorH: 'l', anchorV: 't', targetH: 50, maxW: 34, z: 3 }];
  else topSlots = [
    { ax: -4, ay: -2, anchorH: 'l', anchorV: 't', targetH: 52, maxW: 38, z: 2 },
    { ax: 26, ay: -2, anchorH: 'l', anchorV: 't', targetH: 46, maxW: 33, z: 3 },
    { ax: 6, ay: 30, anchorH: 'l', anchorV: 't', targetH: 38, maxW: 36, z: 4 },
    { ax: 30, ay: 28, anchorH: 'l', anchorV: 't', targetH: 34, maxW: 28, z: 5 }];
  const accSlots = hasTops ? [
    { ax: -3, ay: 50, anchorH: 'l', anchorV: 't', targetH: 42, maxW: 42, z: 6 },
    { ax: 24, ay: 55, anchorH: 'l', anchorV: 't', targetH: 42, maxW: 42, z: 7 },
    { ax: 0, ay: 38, anchorH: 'l', anchorV: 't', targetH: 20, maxW: 36, z: 9 },
    { ax: 37, ay: 46, anchorH: 'l', anchorV: 't', targetH: 19, maxW: 22, z: 10 },
    { ax: 9, ay: 84, anchorH: 'l', anchorV: 't', targetH: 19, maxW: 26, z: 11 },
    { ax: 39, ay: 81, anchorH: 'l', anchorV: 't', targetH: 17, maxW: 20, z: 12 },
  ] : [
    { ax: 0, ay: 1, anchorH: 'l', anchorV: 't', targetH: 48, maxW: 50, z: 6 },
    { ax: 2, ay: 50, anchorH: 'l', anchorV: 't', targetH: 48, maxW: 50, z: 7 },
    { ax: 30, ay: 30, anchorH: 'l', anchorV: 't', targetH: 26, maxW: 28, z: 9 },
    { ax: 2, ay: 84, anchorH: 'l', anchorV: 't', targetH: 20, maxW: 26, z: 10 },
    { ax: 30, ay: 80, anchorH: 'l', anchorV: 't', targetH: 18, maxW: 22, z: 11 },
    { ax: 16, ay: 18, anchorH: 'l', anchorV: 't', targetH: 17, maxW: 20, z: 12 },
  ];

  const mirS = (sl) => (spineRight ? sl : { ...sl, ax: 100 - sl.ax, anchorH: sl.anchorH === 'l' ? 'r' : 'l', pos: 'center' });
  const out = [];
  out.push({ it: spine.it, box: place(mirS(spineSlot), arOf(spine), f) });
  tops.forEach((r, i) => { const sl = topSlots[i] || topSlots[topSlots.length - 1]; out.push({ it: r.it, box: place(mirS(sl), arOf(r), f) }); });
  accs.forEach((r, i) => { const sl = accSlots[i] || { ax: 6 + (i * 9) % 40, ay: 62 + (i * 4) % 28, anchorH: 'l', anchorV: 't', targetH: 16, maxW: 18, z: 13 + i }; out.push({ it: r.it, box: place(mirS(sl), arOf(r), f) }); });
  return out;
}

function FlatLay({ outfit, idx = 0 }) {
  const items = outfit.items || [];
  const [aspects, setAspects] = useState({});

  useEffect(() => {
    let alive = true;
    items.forEach((it) => {
      const im = new window.Image();
      im.onload = () => {
        if (!alive || !im.naturalWidth || !im.naturalHeight) return;
        setAspects((prev) => (prev[it.id] ? prev : { ...prev, [it.id]: im.naturalWidth / im.naturalHeight }));
      };
      im.src = srcOf(it);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outfit]);

  if (!items.length) return null;
  const boxes = planBoxes(items, idx, aspects);

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
          aspectRatio: '4 / 5',
          background: '#fff',
          border: '1px solid var(--line)',
          borderRadius: 5,
          overflow: 'hidden',
        }}
      >
        {boxes.map(({ it, box }) => (
          <div
            key={it.id}
            style={{
              position: 'absolute',
              left: `${box.left}%`,
              top: `${box.top}%`,
              width: `${box.width}%`,
              height: `${box.height}%`,
              zIndex: box.z,
            }}
          >
            <img
              src={srcOf(it)}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: box.pos, display: 'block' }}
            />
          </div>
        ))}
        <span style={{ position: 'absolute', bottom: 6, right: 9, fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 11, color: 'var(--line)', letterSpacing: 1, zIndex: 60 }}>Iris</span>
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
              <FlatLay outfit={o} idx={idx} />
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
