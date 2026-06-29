'use client';

import { useState } from 'react';

const OCCASIONS = ['Everyday', 'Work', 'Dinner', 'Date night', 'Weekend', 'Event / party', 'Workout', 'Trip'];

// ---- Spine flat-lay layout -------------------------------------------------
// One flexible recipe (from the stylistcheck references): the longest vertical
// piece becomes the "spine" and runs full height down one side; the other
// garments sit big up top; accessories cluster small in the lower opposite
// corner. Pieces are scaled up to command the white. Spine side alternates per
// outfit so looks don't come out as identical twins. Grows to any piece count.

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
// spine preference: tallest vertical anchor first
const SPINE_PREF = ['dress', 'bottomLong', 'outer', 'top', 'bottomShort'];
// accessory sizing as % of the cluster band width, plus box aspect ratio
const ACC = {
  bag:     { w: 47, ar: '1 / 1' },
  shoes:   { w: 45, ar: '1 / 1' },
  accMed:  { w: 39, ar: '1 / 1' },
  sunnies: { w: 38, ar: '3 / 2' },
  jewel:   { w: 25, ar: '1 / 1' },
};
const ACC_RANK = { bag: 0, shoes: 1, accMed: 2, sunnies: 3, jewel: 4 };

function buildLayout(items) {
  const roled = items.map((it) => ({ it, role: roleOf(it) }));
  let spine = null;
  for (const want of SPINE_PREF) {
    spine = roled.find((r) => r.role === want);
    if (spine) break;
  }
  if (!spine) spine = roled[0];
  const rest = roled.filter((r) => r !== spine);
  const tops = rest.filter((r) => GARMENT.has(r.role));
  const accs = rest.filter((r) => !GARMENT.has(r.role));
  accs.sort((a, b) => (ACC_RANK[a.role] ?? 2) - (ACC_RANK[b.role] ?? 2));
  return { spine, tops, accs };
}

function srcOf(it) { return it.cutout_url || it.image_url; }

function FlatLay({ outfit, idx = 0 }) {
  const items = outfit.items || [];
  if (!items.length) return null;
  const { spine, tops, accs } = buildLayout(items);
  const total = items.length;
  const spineRight = idx % 2 === 0;

  const aspect = total <= 3 ? '1 / 1' : total <= 4 ? '6 / 7' : total <= 5 ? '4 / 5' : '3 / 4';
  const spineW = spine.role === 'dress' ? 46 : GARMENT.has(spine.role) && spine.role !== 'top' && spine.role !== 'outer' ? 44 : 42;
  const topsFlex = tops.length >= 2 ? 1.25 : 1.1;
  const accFlex = accs.length ? Math.min(1.75, 0.55 + accs.length * 0.22) : 0;
  const topEdge = spineRight ? 'left top' : 'right top';

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
          display: 'flex',
          flexDirection: spineRight ? 'row-reverse' : 'row',
        }}
      >
        <div style={{ flex: `0 0 ${spineW}%`, display: 'flex', padding: 6, minWidth: 0 }}>
          <img
            src={srcOf(spine.it)}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: spineRight ? 'right top' : 'left top', display: 'block' }}
          />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 6, minWidth: 0 }}>
          {tops.length > 0 && (
            <div style={{ flex: topsFlex, display: 'flex', flexWrap: 'wrap', gap: '3%', minHeight: 0 }}>
              {tops.map((r) => (
                <div key={r.it.id} style={{ flex: tops.length >= 2 ? '1 1 45%' : '1 1 100%', display: 'flex', minWidth: 0, minHeight: 0 }}>
                  <img src={srcOf(r.it)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: topEdge, display: 'block' }} />
                </div>
              ))}
            </div>
          )}

          {accs.length > 0 && (
            <div style={{ flex: accFlex, display: 'flex', flexWrap: 'wrap', alignContent: 'center', justifyContent: 'center', gap: '4%', minHeight: 0, paddingTop: tops.length ? 4 : 0 }}>
              {accs.map((r) => {
                const a = ACC[r.role] || ACC.accMed;
                return (
                  <div key={r.it.id} style={{ flex: `0 0 ${a.w}%`, aspectRatio: a.ar, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
                    <img src={srcOf(r.it)} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
