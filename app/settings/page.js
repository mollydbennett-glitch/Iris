'use client';

import { useState, useEffect, useRef } from 'react';

const CONTRAST = [
  { value: 'clean', label: 'Clean', hint: 'cohesive, harmonious' },
  { value: 'balanced', label: 'Balanced', hint: 'mostly cohesive, one tasteful twist' },
  { value: 'bold', label: 'Bold', hint: 'lean into unexpected contrast' },
];
const LOVE_PARTS = ['the whole vibe', 'the top', 'the bottom', 'the shoes', 'the color', 'the proportions'];

export default function SettingsPage() {
  const [location, setLocation] = useState('');
  const [leanPolished, setLeanPolished] = useState(50);
  const [leanStatement, setLeanStatement] = useState(50);
  const [contrast, setContrast] = useState('balanced');

  const [bodyEnabled, setBodyEnabled] = useState(false);
  const [bodyType, setBodyType] = useState('');
  const [colorEnabled, setColorEnabled] = useState(false);
  const [colorSeason, setColorSeason] = useState('');

  const [refs, setRefs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('idle');
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [sRes, tRes] = await Promise.all([fetch('/api/settings'), fetch('/api/taste')]);
        const sData = await sRes.json();
        const s = sData.settings || {};
        setLocation(s.default_location || '');
        const sig = s.style_signature || {};
        setLeanPolished(sig.leanPolished ?? 50);
        setLeanStatement(sig.leanStatement ?? 50);
        setContrast(sig.contrast || 'balanced');
        const r = s.styling_rules || {};
        setBodyEnabled(!!r.body_type?.enabled);
        setBodyType(r.body_type?.type || '');
        setColorEnabled(!!r.color_season?.enabled);
        setColorSeason(r.color_season?.season || '');
        const tData = await tRes.json();
        setRefs(tData.references || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onPickFile(e) {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append('image', file);
        fd.append('love_part', 'the whole vibe');
        const res = await fetch('/api/taste/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (res.ok && data.reference) setRefs((prev) => [data.reference, ...prev]);
      } finally {
        setUploading(false);
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  }
  async function removeRef(id) {
    setRefs((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/taste/${id}`, { method: 'DELETE' });
  }
  async function setLove(id, value) {
    setRefs((prev) => prev.map((r) => (r.id === id ? { ...r, love_part: value } : r)));
    await fetch(`/api/taste/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ love_part: value }) });
  }

  async function save() {
    setStatus('saving');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_location: location,
          style_signature: { leanPolished, leanStatement, references: [], contrast },
          styling_rules: {
            body_type: { enabled: bodyEnabled, type: bodyType },
            color_season: { enabled: colorEnabled, season: colorSeason },
          },
        }),
      });
      if (!res.ok) throw new Error();
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  if (loading) return <p className="lede">Loading…</p>;

  const inputStyle = { padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 2, background: '#fff', color: 'var(--ink)', fontSize: 14, width: '100%' };
  const Toggle = ({ on, onClick }) => (
    <button onClick={onClick} aria-pressed={on}
      style={{ width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', position: 'relative', background: on ? 'var(--gold)' : 'var(--line)', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .12s' }} />
    </button>
  );

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 className="display">Settings</h1>

      <div className="field" style={{ marginTop: 18 }}>
        <label>Default location (for weather)</label>
        <input value={location} onChange={(e) => { setLocation(e.target.value); setStatus('idle'); }} placeholder="e.g. Chicago, IL" />
      </div>

      <h2 className="serif" style={{ fontWeight: 400, fontSize: 22, marginTop: 30 }}>Looks you love</h2>
      <p className="note" style={{ fontStyle: 'normal' }}>Add pictures of looks you love. Iris reads the taste from each one, so you don’t have to describe it.</p>

      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
        {refs.map((r) => (
          <div key={r.id}>
            <div style={{ position: 'relative' }}>
              <img src={r.image_url} alt="" style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', borderRadius: 10, border: '0.5px solid var(--line)', display: 'block' }} />
              <button onClick={() => removeRef(r.id)} aria-label="Remove"
                style={{ position: 'absolute', top: 5, right: 5, width: 20, height: 20, lineHeight: '18px', textAlign: 'center', borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.92)', color: 'var(--ink-soft)', cursor: 'pointer', fontSize: 13 }}>×</button>
            </div>
            <p className="note" style={{ fontStyle: 'normal', marginTop: 5, lineHeight: 1.4 }}>
              {r.read?.summary || (Array.isArray(r.read?.vibe) ? r.read.vibe.join(' · ') : 'Reading…')}
            </p>
            <select value={r.love_part || 'the whole vibe'} onChange={(e) => setLove(r.id, e.target.value)}
              style={{ ...inputStyle, padding: '5px 8px', fontSize: 12, marginTop: 4 }}>
              {LOVE_PARTS.map((p) => <option key={p} value={p}>I love {p}</option>)}
            </select>
          </div>
        ))}

        <label style={{ aspectRatio: '4/5', border: '1.5px dashed var(--line)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', color: 'var(--ink-soft)', fontSize: 13 }}>
          {uploading ? <><span className="spinner" /> Reading…</> : <><span style={{ fontSize: 22 }}>+</span> Upload</>}
          <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} style={{ display: 'none' }} />
        </label>
      </div>
      <p className="note" style={{ marginTop: 8 }}>Saving from the web with a bookmarklet is coming next.</p>

      <h2 className="serif" style={{ fontWeight: 400, fontSize: 22, marginTop: 32 }}>How you lean</h2>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Relaxed ⟷ polished ({leanPolished})</label>
        <input type="range" min="0" max="100" value={leanPolished} onChange={(e) => { setLeanPolished(Number(e.target.value)); setStatus('idle'); }} style={{ width: '100%' }} />
      </div>
      <div className="field">
        <label>Understated ⟷ statement ({leanStatement})</label>
        <input type="range" min="0" max="100" value={leanStatement} onChange={(e) => { setLeanStatement(Number(e.target.value)); setStatus('idle'); }} style={{ width: '100%' }} />
      </div>
      <div className="field">
        <label>Contrast</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CONTRAST.map((c) => (
            <button key={c.value} onClick={() => { setContrast(c.value); setStatus('idle'); }}
              className={contrast === c.value ? 'btn' : 'btn btn-ghost'} style={{ padding: '8px 14px' }} title={c.hint}>
              {c.label}
            </button>
          ))}
        </div>
        <p className="note">{CONTRAST.find((c) => c.value === contrast)?.hint}</p>
      </div>

      <h2 className="serif" style={{ fontWeight: 400, fontSize: 22, marginTop: 32 }}>Styling guidance</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15 }}>Dress for my body type</div>
          <div className="note" style={{ fontStyle: 'normal' }}>prefer flattering proportions</div>
        </div>
        <Toggle on={bodyEnabled} onClick={() => { setBodyEnabled(!bodyEnabled); setStatus('idle'); }} />
      </div>
      {bodyEnabled && (
        <input value={bodyType} onChange={(e) => { setBodyType(e.target.value); setStatus('idle'); }} placeholder="e.g. pear, long torso" style={{ ...inputStyle, marginTop: 8 }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15 }}>Flatter my color season</div>
          <div className="note" style={{ fontStyle: 'normal' }}>lean toward colors that suit me</div>
        </div>
        <Toggle on={colorEnabled} onClick={() => { setColorEnabled(!colorEnabled); setStatus('idle'); }} />
      </div>
      {colorEnabled && (
        <input value={colorSeason} onChange={(e) => { setColorSeason(e.target.value); setStatus('idle'); }} placeholder="e.g. True Autumn, Cool Summer" style={{ ...inputStyle, marginTop: 8 }} />
      )}
      <p className="note" style={{ marginTop: 12, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 11px' }}>
        Your loved looks always win over these rules.
      </p>

      <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn" onClick={save} disabled={status === 'saving'}>
          {status === 'saving' ? 'Saving…' : 'Save settings'}
        </button>
        {status === 'saved' && <span className="status saved">✓ Saved</span>}
        {status === 'error' && <span className="status err">Couldn’t save</span>}
      </div>
      <p className="note" style={{ marginTop: 8 }}>Loved looks save on their own. This button saves the dials and guidance.</p>
    </div>
  );
}
