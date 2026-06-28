'use client';

import { useState, useEffect } from 'react';

const CONTRAST = [
  { value: 'clean', label: 'Clean', hint: 'cohesive, harmonious' },
  { value: 'balanced', label: 'Balanced', hint: 'mostly cohesive, one tasteful twist' },
  { value: 'bold', label: 'Bold', hint: 'lean into unexpected contrast' },
];

export default function SettingsPage() {
  const [location, setLocation] = useState('');
  const [leanPolished, setLeanPolished] = useState(50);
  const [leanStatement, setLeanStatement] = useState(50);
  const [references, setReferences] = useState([]);
  const [refInput, setRefInput] = useState('');
  const [contrast, setContrast] = useState('balanced');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        const s = data.settings || {};
        setLocation(s.default_location || '');
        const sig = s.style_signature || {};
        setLeanPolished(sig.leanPolished ?? 50);
        setLeanStatement(sig.leanStatement ?? 50);
        setReferences(Array.isArray(sig.references) ? sig.references : []);
        setContrast(sig.contrast || 'balanced');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function addRef() {
    const v = refInput.trim();
    if (v && !references.includes(v)) setReferences([...references, v]);
    setRefInput('');
  }

  async function save() {
    setStatus('saving');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_location: location,
          style_signature: { leanPolished, leanStatement, references, contrast },
        }),
      });
      if (!res.ok) throw new Error();
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  if (loading) return <p className="lede">Loading…</p>;

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 className="display">Settings</h1>

      <div className="field" style={{ marginTop: 18 }}>
        <label>Default location (for weather)</label>
        <input value={location} onChange={(e) => { setLocation(e.target.value); setStatus('idle'); }} placeholder="e.g. Chicago, IL" />
      </div>

      <h2 className="serif" style={{ fontWeight: 400, fontSize: 22, marginTop: 30 }}>Your Style Signature</h2>
      <p className="note" style={{ fontStyle: 'normal' }}>How Iris reasons about what feels like you.</p>

      <div className="field" style={{ marginTop: 16 }}>
        <label>Lean — relaxed ⟷ polished ({leanPolished})</label>
        <input type="range" min="0" max="100" value={leanPolished}
          onChange={(e) => { setLeanPolished(Number(e.target.value)); setStatus('idle'); }} style={{ width: '100%' }} />
      </div>
      <div className="field">
        <label>Lean — understated ⟷ statement ({leanStatement})</label>
        <input type="range" min="0" max="100" value={leanStatement}
          onChange={(e) => { setLeanStatement(Number(e.target.value)); setStatus('idle'); }} style={{ width: '100%' }} />
      </div>

      <div className="field">
        <label>Style references (people, brands, accounts you pull toward)</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={refInput} onChange={(e) => setRefInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRef(); } }}
            placeholder="e.g. The Row, @stylistcheck, Julia Berolzheimer" />
          <button className="btn btn-ghost" style={{ padding: '8px 14px' }} onClick={addRef}>Add</button>
        </div>
        {references.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {references.map((r) => (
              <span key={r} className="pill" style={{ marginRight: 0, cursor: 'pointer' }}
                onClick={() => { setReferences(references.filter((x) => x !== r)); setStatus('idle'); }}
                title="Click to remove">
                {r} ✕
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <label>Contrast dial</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CONTRAST.map((c) => (
            <button key={c.value}
              onClick={() => { setContrast(c.value); setStatus('idle'); }}
              className={contrast === c.value ? 'btn' : 'btn btn-ghost'}
              style={{ padding: '8px 14px', flexDirection: 'column' }}
              title={c.hint}>
              {c.label}
            </button>
          ))}
        </div>
        <p className="note">{CONTRAST.find((c) => c.value === contrast)?.hint}</p>
      </div>

      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn" onClick={save} disabled={status === 'saving'}>
          {status === 'saving' ? 'Saving…' : 'Save settings'}
        </button>
        {status === 'saved' && <span className="status saved">✓ Saved</span>}
        {status === 'error' && <span className="status err">Couldn’t save</span>}
      </div>
    </div>
  );
}
