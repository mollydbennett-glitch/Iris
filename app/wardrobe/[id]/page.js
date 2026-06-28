'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

const CATEGORIES = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'bag', 'accessory'];
const SILHOUETTES = ['fitted', 'relaxed', 'oversized', 'structured', 'flowy', 'tailored'];
const PATTERNS = ['solid', 'striped', 'plaid', 'floral', 'print', 'textured', 'other'];
const SEASONS = ['spring', 'summer', 'fall', 'winter'];
const SUBCATEGORIES = {
  top: ['blouse', 't-shirt', 'sweater', 'tank', 'button-down', 'bodysuit', 'cami'],
  bottom: ['jeans', 'trousers', 'skirt', 'shorts', 'leggings'],
  dress: ['mini', 'midi', 'maxi', 'gown', 'slip'],
  outerwear: ['blazer', 'coat', 'jacket', 'cardigan', 'vest'],
  shoes: ['heels', 'flats', 'boots', 'sneakers', 'sandals', 'loafers'],
  bag: ['tote', 'crossbody', 'clutch', 'shoulder', 'backpack'],
  accessory: ['belt', 'scarf', 'hat', 'jewelry', 'sunglasses'],
};

export default function ItemDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [it, setIt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error
  const [rotating, setRotating] = useState(false);
  const [rotatedAt, setRotatedAt] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/wardrobe/items/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        setIt(normalize(data.item));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  function normalize(item) {
    return {
      id: item.id,
      image_url: item.image_url,
      cutout_url: item.cutout_url || null,
      category: item.category || '',
      subcategory: item.subcategory || '',
      colorPrimary: item.color?.primary || '',
      pattern: item.color?.pattern || 'solid',
      fabric: item.fabric || '',
      silhouette: item.silhouette || '',
      season: item.season || { spring: false, summer: false, fall: false, winter: false },
      styleVibe: Array.isArray(item.style_vibe) ? item.style_vibe.join(', ') : '',
      notes: item.ai_tags?.notes || '',
    };
  }

  function set(patch) {
    setIt((prev) => ({ ...prev, ...patch }));
    setStatus('idle');
  }
  function changeCategory(category) {
    const valid = SUBCATEGORIES[category] || [];
    setIt((prev) => ({ ...prev, category, subcategory: valid.includes(prev.subcategory) ? prev.subcategory : '' }));
    setStatus('idle');
  }
  function toggleSeason(key) {
    setIt((prev) => ({ ...prev, season: { ...prev.season, [key]: !prev.season[key] } }));
    setStatus('idle');
  }

  async function rotate(degrees) {
    setRotating(true);
    try {
      const res = await fetch(`/api/wardrobe/items/${id}/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ degrees }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Rotate failed');
      }
      setRotatedAt(Date.now());
    } catch (err) {
      setError(err.message);
    } finally {
      setRotating(false);
    }
  }

  async function save() {
    setStatus('saving');
    const body = {
      category: it.category,
      subcategory: it.subcategory,
      color: { primary: it.colorPrimary, secondary: null, pattern: it.pattern },
      fabric: it.fabric,
      silhouette: it.silhouette,
      season: it.season,
      style_vibe: it.styleVibe.split(',').map((s) => s.trim()).filter(Boolean),
    };
    try {
      const res = await fetch(`/api/wardrobe/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Save failed');
      }
      setStatus('saved');
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  }

  async function remove() {
    if (!window.confirm('Remove this piece from your wardrobe?')) return;
    try {
      const res = await fetch(`/api/wardrobe/items/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      router.push('/wardrobe');
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeHard() {
    if (!window.confirm('Permanently delete this piece and its photo? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/wardrobe/items/${id}?mode=hard`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      router.push('/wardrobe');
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="lede">Loading…</p>;
  if (!it) return <p className="status err" style={{ display: 'block' }}>{error || 'Item not found.'}</p>;

  const subs = SUBCATEGORIES[it.category] || [];
  const showCutout = it.cutout_url && !rotatedAt;
  const imgSrc = rotatedAt ? `${it.image_url.split('?')[0]}?t=${rotatedAt}` : (it.cutout_url || it.image_url);

  return (
    <div>
      <a href="/wardrobe" className="navlink" style={{ color: 'var(--ink-soft)' }}>← Back to wardrobe</a>

      <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 28 }}>
        <div style={{ flex: '0 0 320px', maxWidth: 320 }}>
          <div style={{ width: '100%', aspectRatio: '3 / 4', background: showCutout ? '#fff' : 'var(--gold-soft)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--line)' }}>
            <img src={imgSrc} alt="" style={{ width: '100%', height: '100%', objectFit: showCutout ? 'contain' : 'cover', padding: showCutout ? 12 : 0, display: 'block' }} />
          </div>
          <div className="rotate-row" style={{ justifyContent: 'flex-start' }}>
            <button className="rotate-btn" onClick={() => rotate(270)} disabled={rotating} title="Rotate left">↺</button>
            <button className="rotate-btn" onClick={() => rotate(90)} disabled={rotating} title="Rotate right">↻</button>
            {rotating && <span className="spinner" />}
          </div>
        </div>

        <div style={{ flex: '1 1 280px', minWidth: 260, maxWidth: 420 }}>
          <div className="field">
            <label>Category</label>
            <select value={it.category} onChange={(e) => changeCategory(e.target.value)}>
              <option value="">—</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Subcategory</label>
            <select value={it.subcategory} onChange={(e) => set({ subcategory: e.target.value })} disabled={!it.category}>
              <option value="">{it.category ? '—' : 'pick a category first'}</option>
              {subs.map((s) => <option key={s} value={s}>{s}</option>)}
              {it.subcategory && !subs.includes(it.subcategory) && <option value={it.subcategory}>{it.subcategory}</option>}
            </select>
          </div>
          <div className="field">
            <label>Color</label>
            <input value={it.colorPrimary} onChange={(e) => set({ colorPrimary: e.target.value })} />
          </div>
          <div className="field">
            <label>Pattern</label>
            <select value={it.pattern} onChange={(e) => set({ pattern: e.target.value })}>
              {PATTERNS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Fabric</label>
            <input value={it.fabric} onChange={(e) => set({ fabric: e.target.value })} />
          </div>
          <div className="field">
            <label>Silhouette</label>
            <select value={it.silhouette} onChange={(e) => set({ silhouette: e.target.value })}>
              <option value="">—</option>
              {SILHOUETTES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Season</label>
            <div className="seasons">
              {SEASONS.map((s) => (
                <label key={s}>
                  <input type="checkbox" checked={!!it.season[s]} onChange={() => toggleSeason(s)} />
                  {s}
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Style vibe (comma separated)</label>
            <input value={it.styleVibe} onChange={(e) => set({ styleVibe: e.target.value })} />
          </div>
          {it.notes && <p className="note">Iris: {it.notes}</p>}

          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn" onClick={save} disabled={status === 'saving'}>
              {status === 'saving' ? 'Saving…' : 'Save changes'}
            </button>
            {status === 'saved' && <span className="status saved">✓ Saved</span>}
            {status === 'error' && <span className="status err">Couldn’t save</span>}
            <button
              onClick={remove}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--ink-soft)', cursor: 'pointer', fontSize: 13 }}
            >
              Remove from wardrobe
            </button>
          </div>
          <div style={{ marginTop: 10, textAlign: 'right' }}>
            <button
              onClick={removeHard}
              style={{ background: 'none', border: 'none', color: 'var(--bad)', cursor: 'pointer', fontSize: 12 }}
              title="Permanently deletes the item and its photo"
            >
              Delete permanently
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
