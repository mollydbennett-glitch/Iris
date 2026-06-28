'use client';

import { useState, useRef } from 'react';

const CATEGORIES = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'bag', 'accessory'];
const SILHOUETTES = ['fitted', 'relaxed', 'oversized', 'structured', 'flowy', 'tailored'];
const PATTERNS = ['solid', 'striped', 'plaid', 'floral', 'print', 'textured', 'other'];
const SEASONS = ['spring', 'summer', 'fall', 'winter'];

// Subcategory options depend on the chosen category.
const SUBCATEGORIES = {
  top: ['blouse', 't-shirt', 'sweater', 'tank', 'button-down', 'bodysuit', 'cami'],
  bottom: ['jeans', 'trousers', 'skirt', 'shorts', 'leggings'],
  dress: ['mini', 'midi', 'maxi', 'gown', 'slip'],
  outerwear: ['blazer', 'coat', 'jacket', 'cardigan', 'vest'],
  shoes: ['heels', 'flats', 'boots', 'sneakers', 'sandals', 'loafers'],
  bag: ['tote', 'crossbody', 'clutch', 'shoulder', 'backpack'],
  accessory: ['belt', 'scarf', 'hat', 'jewelry', 'sunglasses'],
};

// Browsers can't draw HEIC/HEIF to a canvas, so we can't resize those here.
// We detect them and send the original file; the server converts to JPEG.
function isHeicFile(file) {
  const name = (file.name || '').toLowerCase();
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
}

// Shrink any photo to a max edge of 1200px and re-encode as JPEG in the browser.
// Keeps uploads small/fast and normalizes phone photos before they hit Claude.
function resizeToJpeg(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 1200;
      let { width, height } = img;
      if (width > height && width > max) {
        height = Math.round((height * max) / width);
        width = max;
      } else if (height > max) {
        width = Math.round((width * max) / height);
        height = max;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not process image'))),
        'image/jpeg',
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this image (HEIC files may need to be JPEG).'));
    };
    img.src = url;
  });
}

export default function UploadPage() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setError('');
    setBusy(true);

    for (const file of files) {
      try {
        const fd = new FormData();
        if (isHeicFile(file)) {
          fd.append('image', file, file.name || 'item.heic');
        } else {
          const jpeg = await resizeToJpeg(file);
          fd.append('image', jpeg, 'item.jpg');
        }
        const res = await fetch('/api/wardrobe/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        setItems((prev) => [normalize(data.item), ...prev]);
      } catch (err) {
        setError(err.message);
      }
    }

    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function normalize(item) {
    return {
      id: item.id,
      image_url: item.image_url,
      rotatedAt: 0, // bumped after a rotate to bust the browser cache
      category: item.category || '',
      subcategory: item.subcategory || '',
      colorPrimary: item.color?.primary || '',
      pattern: item.color?.pattern || 'solid',
      fabric: item.fabric || '',
      silhouette: item.silhouette || '',
      season: item.season || { spring: false, summer: false, fall: false, winter: false },
      styleVibe: Array.isArray(item.style_vibe) ? item.style_vibe.join(', ') : '',
      notes: item.ai_tags?.notes || '',
      _status: 'idle',
    };
  }

  // Editing a field marks the item as having unsaved changes (idle).
  function editField(id, patch) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch, _status: 'idle' } : it)));
  }
  // Status changes (saving / saved / error) are kept separate so they aren't wiped.
  function setStatus(id, status) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, _status: status } : it)));
  }

  function changeCategory(id, category) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const valid = SUBCATEGORIES[category] || [];
        const sub = valid.includes(it.subcategory) ? it.subcategory : '';
        return { ...it, category, subcategory: sub, _status: 'idle' };
      })
    );
  }

  function toggleSeason(id, key) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, season: { ...it.season, [key]: !it.season[key] }, _status: 'idle' } : it
      )
    );
  }

  async function rotate(it, degrees) {
    setStatus(it.id, 'rotating');
    try {
      const res = await fetch(`/api/wardrobe/items/${it.id}/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ degrees }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Rotate failed');
      }
      // Same URL, new bytes — bump rotatedAt so the <img> reloads.
      setItems((prev) =>
        prev.map((x) => (x.id === it.id ? { ...x, rotatedAt: Date.now(), _status: 'idle' } : x))
      );
    } catch (err) {
      setStatus(it.id, 'error');
      setError(err.message);
    }
  }

  async function save(it) {
    setStatus(it.id, 'saving');
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
      const res = await fetch(`/api/wardrobe/items/${it.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Save failed');
      }
      setStatus(it.id, 'saved');
    } catch (err) {
      setStatus(it.id, 'error');
      setError(err.message);
    }
  }

  function imgSrc(it) {
    return it.rotatedAt ? `${it.image_url.split('?')[0]}?t=${it.rotatedAt}` : it.image_url;
  }

  return (
    <div>
      <h1 className="display">Add items</h1>
      <p className="lede">
        Upload photos of individual pieces. Iris tags each one — confirm or fix the
        tags, then save. Aim for a clean background and one item per photo.
      </p>

      <div style={{ marginTop: 24 }}>
        <div className="dropzone" onClick={() => fileRef.current?.click()}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFiles}
            style={{ display: 'none' }}
          />
          <p style={{ margin: 0, fontSize: 16 }}>
            {busy ? (
              <>
                <span className="spinner" /> &nbsp;Tagging your items…
              </>
            ) : (
              'Click to choose photos (you can select several at once)'
            )}
          </p>
        </div>
        {error && <p className="status err" style={{ display: 'block', marginTop: 10 }}>{error}</p>}
      </div>

      {items.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 className="serif" style={{ fontWeight: 400, fontSize: 22 }}>
            Just added ({items.length})
          </h2>
          <div className="cards" style={{ marginTop: 12 }}>
            {items.map((it) => {
              const subs = SUBCATEGORIES[it.category] || [];
              return (
                <div className="card" key={it.id}>
                  <div>
                    <img className="card-img" src={imgSrc(it)} alt="" />
                    <div className="rotate-row">
                      <button
                        type="button"
                        className="rotate-btn"
                        onClick={() => rotate(it, 270)}
                        disabled={it._status === 'rotating'}
                        title="Rotate left"
                      >
                        ↺
                      </button>
                      <button
                        type="button"
                        className="rotate-btn"
                        onClick={() => rotate(it, 90)}
                        disabled={it._status === 'rotating'}
                        title="Rotate right"
                      >
                        ↻
                      </button>
                      {it._status === 'rotating' && <span className="spinner" />}
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="field">
                      <label>Category</label>
                      <select value={it.category} onChange={(e) => changeCategory(it.id, e.target.value)}>
                        <option value="">—</option>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Subcategory</label>
                      <select
                        value={it.subcategory}
                        onChange={(e) => editField(it.id, { subcategory: e.target.value })}
                        disabled={!it.category}
                      >
                        <option value="">{it.category ? '—' : 'pick a category first'}</option>
                        {subs.map((s) => <option key={s} value={s}>{s}</option>)}
                        {it.subcategory && !subs.includes(it.subcategory) && (
                          <option value={it.subcategory}>{it.subcategory}</option>
                        )}
                      </select>
                    </div>
                    <div className="field">
                      <label>Color</label>
                      <input value={it.colorPrimary} onChange={(e) => editField(it.id, { colorPrimary: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>Pattern</label>
                      <select value={it.pattern} onChange={(e) => editField(it.id, { pattern: e.target.value })}>
                        {PATTERNS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Fabric (best guess)</label>
                      <input value={it.fabric} onChange={(e) => editField(it.id, { fabric: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>Silhouette</label>
                      <select value={it.silhouette} onChange={(e) => editField(it.id, { silhouette: e.target.value })}>
                        <option value="">—</option>
                        {SILHOUETTES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Season</label>
                      <div className="seasons">
                        {SEASONS.map((s) => (
                          <label key={s}>
                            <input type="checkbox" checked={!!it.season[s]} onChange={() => toggleSeason(it.id, s)} />
                            {s}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <label>Style vibe (comma separated)</label>
                      <input value={it.styleVibe} onChange={(e) => editField(it.id, { styleVibe: e.target.value })} />
                    </div>
                    {it.notes && <p className="note">Iris: {it.notes}</p>}
                    <div style={{ marginTop: 8 }}>
                      <button className="btn" onClick={() => save(it)} disabled={it._status === 'saving'}>
                        {it._status === 'saving' ? 'Saving…' : 'Save'}
                      </button>
                      {it._status === 'saved' && <span className="status saved">✓ Saved</span>}
                      {it._status === 'error' && <span className="status err">Couldn’t save</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
