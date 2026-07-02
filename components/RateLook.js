'use client';

import { useState } from 'react';

// Yes / no on a look, with an optional note. One tap stores the verdict (the
// four rating dials are set high or low together so the learning pass gets a
// clean signal); the note field appears once a verdict is picked. Used on
// Style, in the Lookbook, and in the Planner's look detail.
export function RateLook({ outfitId, initialRatings, initialNote }) {
  const derive = (r) => {
    if (!r) return null;
    const vals = ['proportions', 'aesthetic', 'cohesion', 'style']
      .map((k) => Number(r[k]))
      .filter((n) => !Number.isNaN(n) && n > 0);
    if (!vals.length) return null;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return avg >= 3.5 ? 'yes' : 'no';
  };

  const [verdict, setVerdict] = useState(derive(initialRatings));
  const [note, setNote] = useState(initialNote || '');
  const [noteOpen, setNoteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  async function rate(v) {
    if (!outfitId || busy || v === verdict) return;
    const prev = verdict;
    setVerdict(v);
    setBusy(true);
    try {
      const n = v === 'yes' ? 5 : 2;
      const res = await fetch(`/api/outfits/${outfitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating_proportions: n, rating_aesthetic: n, rating_cohesion: n, rating_style: n }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setVerdict(prev);
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    if (!outfitId || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/outfits/${outfitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_notes: note.trim() }),
      });
      if (!res.ok) throw new Error();
      setNoteSaved(true);
    } catch {
      setNoteSaved(false);
    } finally {
      setBusy(false);
    }
  }

  if (!outfitId) return null;

  const pill = (on, color) => ({
    fontSize: 12,
    padding: '5px 12px',
    borderRadius: 999,
    cursor: 'pointer',
    border: on ? `1px solid ${color}` : '1px solid var(--line)',
    background: on ? 'var(--card)' : '#fff',
    color: on ? color : 'var(--ink-soft)',
  });

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span className="note" style={{ fontStyle: 'normal', marginTop: 0 }}>This one?</span>
        <button type="button" onClick={() => rate('yes')} disabled={busy} style={pill(verdict === 'yes', 'var(--gold)')}>Yes</button>
        <button type="button" onClick={() => rate('no')} disabled={busy} style={pill(verdict === 'no', 'var(--bad)')}>Not for me</button>
        {verdict && (
          <button type="button" onClick={() => setNoteOpen((o) => !o)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--ink-soft)', padding: 0 }}>
            {noteOpen ? 'hide note' : note ? 'edit note' : '+ note'}
          </button>
        )}
      </div>
      {verdict && noteOpen && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <input
            value={note}
            onChange={(e) => { setNote(e.target.value); setNoteSaved(false); }}
            placeholder="what worked or didn't"
            style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 2, fontSize: 13, color: 'var(--ink)', background: '#fff' }}
          />
          <button type="button" className="btn btn-ghost" onClick={saveNote} disabled={busy}
            style={{ padding: '6px 12px', fontSize: 12 }}>
            {noteSaved ? '✓' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}
