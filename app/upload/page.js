'use client';

import { useState, useRef } from 'react';

const CATEGORIES = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'bag', 'accessory'];
const SILHOUETTES = ['fitted', 'relaxed', 'oversized', 'structured', 'flowy', 'tailored'];
const PATTERNS = ['solid', 'striped', 'plaid', 'floral', 'print', 'textured', 'other'];
const SEASONS = ['spring', 'summer', 'fall', 'winter'];

// iPhone photos are often HEIC/HEIF, which browsers can't draw to a canvas.
// Convert those to JPEG first (in the browser) before resizing.
async function ensureBrowserReadable(file) {
  const name = (file.name || '').toLowerCase();
  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif');
  if (!isHeic) return file;
  const heic2any = (await import('heic2any')).default;
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  return new File([blob], name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
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
  const [items, setItems] = useState([]); // {id, image_url, fields..., _status}
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
        const readable = await ensureBrowserReadable(file);
        const jpeg = await resizeToJpeg(readable);
        const fd = new FormData();
        fd.append('image', jpeg, 'item.jpg');
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
      category: item.category || '',
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

  function update(id, patch) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch, _status: 'idle' } : it)));
  }
  function toggleSeason(id, key) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, season: { ...it.season, [key]: !it.season[key] }, _status: 'idle' } : it
      )
    );
  }

  async function save(it) {
    update(it.id, { _status: 'saving' });
    const body = {
      category: it.category,
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
      update(it.id, { _status: 'saved' });
    } catch (err) {
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, _status: 'error' } : x)));
      setError(err.message);
    }
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
            {items.map((it) => (
              <div className="card" key={it.id}>
                <img className="card-img" src={it.image_url} alt="" />
                <div className="card-body">
                  <div className="field">
                    <label>Category</label>
                    <select value={it.category} onChange={(e) => update(it.id, { category: e.target.value })}>
                      <option value="">—</option>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Color</label>
                    <input value={it.colorPrimary} onChange={(e) => update(it.id, { colorPrimary: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Pattern</label>
                    <select value={it.pattern} onChange={(e) => update(it.id, { pattern: e.target.value })}>
                      {PATTERNS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Fabric (best guess)</label>
                    <input value={it.fabric} onChange={(e) => update(it.id, { fabric: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Silhouette</label>
                    <select value={it.silhouette} onChange={(e) => update(it.id, { silhouette: e.target.value })}>
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
                    <input value={it.styleVibe} onChange={(e) => update(it.id, { styleVibe: e.target.value })} />
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
