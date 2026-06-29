'use client';

import { useState } from 'react';

const OCCASIONS = ['Everyday', 'Work', 'Dinner', 'Date night', 'Weekend', 'Event / party', 'Workout', 'Trip'];

// ---- Charcuterie flat-lay -------------------------------------------------
// Pack like a charcuterie board: pieces big, scaled by role, edges bleeding off
// the frame, smaller pieces layered on top of bigger ones, minimal gaps. Works
// because cutouts are transparent, so overlap reads as a real flat-lay pile.
// The longest vertical piece anchors one side; garments sit big up top;
// accessories cluster lower. Spine side alternates so looks aren't twins. Frame
// height is tuned to the piece count so it stays dense, never sparse.

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

function srcOf(it) { return it.cutout_url || it.image_url; }
function flipPos(p) { if (!p) return 'center'; return p.replace('left', '\u00a7').replace('right', 'left').replace('\u00a7', 'right'); }

function aspectFor(n, hasTops) {
  if (!hasTops) { if (n <= 3) return '1 / 1'; if (n <= 4) return '6 / 7'; return '4 / 5'; }
  if (n <= 3) return '6 / 7';
  if (n <= 4) return '5 / 6';
  if (n <= 5) return '4 / 5';
  if (n <= 7) return '3 / 4';
  return '5 / 7';
}

function planBoxes(items, idx) {
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
  const out = [];
  const mir = (b) => (spineRight ? b : { ...b, left: 100 - b.left - b.width, pos: flipPos(b.pos) });

  const spineBox = hasTops
    ? { left: 50, top: -3, width: 53, height: 106, z: 1, pos: 'center' }
    : { left: 44, top: -2, width: 56, height: 104, z: 1, pos: 'center' };
  out.push({ it: spine.it, box: mir(spineBox) });

  if (tops.length === 1) {
    out.push({ it: tops[0].it, box: mir({ left: -3, top: -2, width: 57, height: 56, z: 2, pos: 'left top' }) });
  } else if (tops.length === 2) {
    out.push({ it: tops[0].it, box: mir({ left: -4, top: -2, width: 40, height: 54, z: 2, pos: 'left top' }) });
    out.push({ it: tops[1].it, box: mir({ left: 28, top: 2, width: 32, height: 46, z: 3, pos: 'center top' }) });
  } else if (tops.length >= 3) {
    out.push({ it: tops[0].it, box: mir({ left: -4, top: -2, width: 36, height: 50, z: 2, pos: 'left top' }) });
    out.push({ it: tops[1].it, box: mir({ left: 26, top: -2, width: 32, height: 44, z: 3, pos: 'center top' }) });
    out.push({ it: tops[2].it, box: mir({ left: 8, top: 30, width: 34, height: 36, z: 4, pos: 'center' }) });
    for (let i = 3; i < tops.length; i++) out.push({ it: tops[i].it, box: mir({ left: 30, top: 28, width: 26, height: 32, z: 4 + i, pos: 'center' }) });
  }

  const accSlots = hasTops ? [
    { left: -2, top: 50, width: 34, height: 38, z: 5 },
    { left: 23, top: 54, width: 36, height: 38, z: 6 },
    { left: 2, top: 38, width: 30, height: 16, z: 9 },
    { left: 34, top: 44, width: 17, height: 17, z: 10 },
    { left: 12, top: 84, width: 19, height: 17, z: 11 },
    { left: 37, top: 80, width: 16, height: 16, z: 12 },
  ] : [
    { left: 2, top: 4, width: 46, height: 40, z: 5 },
    { left: 6, top: 46, width: 44, height: 42, z: 6 },
    { left: 30, top: 30, width: 24, height: 22, z: 9 },
    { left: 4, top: 84, width: 22, height: 16, z: 10 },
    { left: 32, top: 78, width: 20, height: 18, z: 11 },
    { left: 18, top: 20, width: 16, height: 16, z: 12 },
  ];
  accs.forEach((r, i) => {
    const sl = accSlots[i] || { left: 6 + (i * 7) % 40, top: 60 + (i * 5) % 30, width: 16, height: 16, z: 13 + i };
    const b = { ...sl };
    if (r.role === 'jewel') { b.width *= 0.72; b.height *= 0.72; }
    if (r.role === 'sunnies') { b.height = b.width * 0.55; }
    out.push({ it: r.it, box: mir({ ...b, pos: 'center' }) });
  });

  return { boxes: out, aspect: aspectFor(n, hasTops) };
}

function FlatLay({ outfit, idx = 0 }) {
  const items = outfit.items || [];
  if (!items.length) return null;
  const { boxes, aspect } = planBoxes(items, idx);

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
          aspectRatio: aspect,
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
        <span style={{ position: 'absolute', bottom: 6, right: 9, fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 11, color: 'var(--line)', letterSpacing: 1, zIndex: 50 }}>Iris</span>
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
