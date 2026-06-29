'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

const SEASONS = ['spring', 'summer', 'fall', 'winter'];

function seasonList(season) {
  if (!season) return [];
  return Object.keys(season).filter((k) => season[k]);
}

export default function WardrobePage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [fCategory, setFCategory] = useState('');
  const [fSeason, setFSeason] = useState('');
  const [fColor, setFColor] = useState('');
  const [fVibe, setFVibe] = useState('');

  const [cutoutBusy, setCutoutBusy] = useState(false);
  const [cutoutProgress, setCutoutProgress] = useState(null);
  const [tightenBusy, setTightenBusy] = useState(false);
  const [tightenProgress, setTightenProgress] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/wardrobe/items');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        setItems(data.items);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const categories = useMemo(() => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(), [items]);
  const colors = useMemo(() => [...new Set(items.map((i) => i.color?.primary).filter(Boolean))].sort(), [items]);
  const vibes = useMemo(() => [...new Set(items.flatMap((i) => (Array.isArray(i.style_vibe) ? i.style_vibe : [])).filter(Boolean))].sort(), [items]);

  const filtered = items.filter((it) => {
    if (fCategory && it.category !== fCategory) return false;
    if (fSeason && !(it.season && it.season[fSeason])) return false;
    if (fColor && it.color?.primary !== fColor) return false;
    if (fVibe && !(Array.isArray(it.style_vibe) && it.style_vibe.includes(fVibe))) return false;
    return true;
  });

  const anyFilter = fCategory || fSeason || fColor || fVibe;
  function clearFilters() { setFCategory(''); setFSeason(''); setFColor(''); setFVibe(''); }

  const needCutouts = items.filter((it) => !it.cutout_url);

  async function makeCutouts() {
    setCutoutBusy(true);
    setError('');
    const todo = items.filter((it) => !it.cutout_url);
    let firstError = '';
    let done = 0;
    for (let i = 0; i < todo.length; i++) {
      setCutoutProgress(`${i + 1} / ${todo.length}`);
      try {
        const res = await fetch(`/api/wardrobe/items/${todo[i].id}/cutout`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.cutout_url) {
          done++;
          setItems((prev) => prev.map((x) => (x.id === todo[i].id ? { ...x, cutout_url: data.cutout_url, cutout_tight: data.cutout_tight !== false } : x)));
        } else if (!firstError) {
          firstError = data.error || `HTTP ${res.status}`;
          break; // if the first one fails, stop — they'll all fail the same way
        }
      } catch (err) {
        if (!firstError) { firstError = err.message; break; }
      }
    }
    setCutoutBusy(false);
    setCutoutProgress(null);
    if (firstError) setError(`Background removal failed — ${firstError}`);
  }

  // One click: re-cut each existing cutout through Photoroom with crop-to-subject
  // on, so every piece comes back tight to its edges no matter how it was shot.
  // Only runs on items not already tightened, so the button clears when it's done.
  async function tightenImages() {
    setTightenBusy(true);
    setError('');
    const todo = items.filter((it) => it.cutout_url && !it.cutout_tight);
    let firstError = '';
    for (let i = 0; i < todo.length; i++) {
      setTightenProgress(`${i + 1} / ${todo.length}`);
      try {
        const res = await fetch(`/api/wardrobe/items/${todo[i].id}/cutout`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.cutout_url) {
          setItems((prev) => prev.map((x) => (x.id === todo[i].id ? { ...x, cutout_url: data.cutout_url, cutout_tight: data.cutout_tight !== false } : x)));
        } else if (!res.ok && !firstError) {
          firstError = data.error || `HTTP ${res.status}`;
          break;
        }
      } catch (err) {
        if (!firstError) { firstError = err.message; break; }
      }
    }
    setTightenBusy(false);
    setTightenProgress(null);
    if (firstError) setError(`Tighten failed — ${firstError}`);
  }

  async function removeItem(e, it) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Remove this piece from your wardrobe?')) return;
    setItems((prev) => prev.filter((x) => x.id !== it.id));
    try {
      const res = await fetch(`/api/wardrobe/items/${it.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
    } catch (err) {
      setItems((prev) => [it, ...prev]);
      setError(err.message);
    }
  }

  const selectStyle = { padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 2, background: '#fff', color: 'var(--ink)', fontSize: 14 };

  return (
    <div>
      <h1 className="display">Wardrobe</h1>
      <p className="lede">
        {loading ? 'Loading your closet…' : `${filtered.length}${anyFilter ? ` of ${items.length}` : ''} piece${filtered.length === 1 ? '' : 's'}.`}
      </p>

      {error && <p className="status err" style={{ display: 'block' }}>{error}</p>}

      {!loading && items.length > 0 && (
        <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <select style={selectStyle} value={fCategory} onChange={(e) => setFCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select style={selectStyle} value={fSeason} onChange={(e) => setFSeason(e.target.value)}>
            <option value="">All seasons</option>
            {SEASONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select style={selectStyle} value={fColor} onChange={(e) => setFColor(e.target.value)}>
            <option value="">All colors</option>
            {colors.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select style={selectStyle} value={fVibe} onChange={(e) => setFVibe(e.target.value)}>
            <option value="">All vibes</option>
            {vibes.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          {anyFilter && <button className="btn btn-ghost" style={{ padding: '7px 14px' }} onClick={clearFilters}>Clear</button>}
        </div>
      )}

      {!loading && needCutouts.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button className="btn btn-ghost" style={{ padding: '8px 14px' }} onClick={makeCutouts} disabled={cutoutBusy}>
            {cutoutBusy ? <><span className="spinner" />&nbsp; Removing backgrounds {cutoutProgress}</> : `Clean up backgrounds (${needCutouts.length})`}
          </button>
          <p className="note" style={{ marginTop: 6 }}>Removes the photo backgrounds for a clean catalog look.</p>
        </div>
      )}

      {!loading && items.some((it) => it.cutout_url && !it.cutout_tight) && (
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-ghost" style={{ padding: '8px 14px' }} onClick={tightenImages} disabled={tightenBusy}>
            {tightenBusy ? <><span className="spinner" />&nbsp; Tightening {tightenProgress}</> : `Tighten images (${items.filter((it) => it.cutout_url && !it.cutout_tight).length})`}
          </button>
          <p className="note" style={{ marginTop: 6 }}>Re-cuts each piece cropped tight to its edges so it fills the outfit boards.</p>
        </div>
      )}

      {!loading && items.length === 0 && (
        <div style={{ marginTop: 24 }}><a href="/upload" className="btn">Add items</a></div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 18 }}>
          {filtered.map((it) => {
            const seasons = seasonList(it.season);
            const hasCutout = !!it.cutout_url;
            const src = it.cutout_url || it.image_url;
            return (
              <div key={it.id} onClick={() => router.push(`/wardrobe/${it.id}`)}
                style={{ position: 'relative', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 4, overflow: 'hidden', color: 'var(--ink)', display: 'block', cursor: 'pointer' }}>
                <button type="button" onClick={(e) => removeItem(e, it)} title="Remove from wardrobe"
                  style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'rgba(26,23,20,0.6)', color: '#fff', fontSize: 15, lineHeight: 1, cursor: 'pointer', zIndex: 2 }}>×</button>
                <div style={{ width: '100%', aspectRatio: '3 / 4', background: hasCutout ? '#fff' : 'var(--gold-soft)' }}>
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: hasCutout ? 'contain' : 'cover', padding: hasCutout ? 10 : 0, display: 'block' }} />
                </div>
                <div style={{ padding: '10px 12px 12px' }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, textTransform: 'capitalize' }}>
                    {it.color?.primary ? `${it.color.primary} ` : ''}{it.subcategory || it.category || 'item'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3, textTransform: 'capitalize' }}>
                    {[it.category, it.fabric].filter(Boolean).join(' · ')}
                  </div>
                  {seasons.length > 0 && (
                    <div style={{ marginTop: 7, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {seasons.map((s) => <span key={s} className="pill" style={{ marginRight: 0 }}>{s}</span>)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && items.length > 0 && filtered.length === 0 && (
        <p className="lede" style={{ marginTop: 24 }}>No pieces match these filters.</p>
      )}
    </div>
  );
}
