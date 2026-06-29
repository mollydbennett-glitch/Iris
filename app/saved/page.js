'use client';

import { useState, useEffect } from 'react';
import { FlatLay } from '@/components/FlatLay';

export default function SavedPage() {
  const [outfits, setOutfits] = useState(null);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/outfits/saved');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        setOutfits(data.outfits || []);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  async function remove(id) {
    setRemovingId(id);
    const prev = outfits;
    setOutfits((list) => list.filter((o) => o.id !== id)); // optimistic
    try {
      const res = await fetch(`/api/outfits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite: false }),
      });
      if (!res.ok) throw new Error();
    } catch (e) {
      setOutfits(prev); // roll back
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div>
      <h1 className="display">Lookbook</h1>
      <p className="lede">The looks you’ve loved. Style anytime, drop them onto days in your Planner.</p>

      {error && <p className="status err" style={{ display: 'block', marginTop: 16 }}>{error}</p>}

      {outfits === null && !error && (
        <p className="note" style={{ marginTop: 20 }}><span className="spinner" />&nbsp; Loading…</p>
      )}

      {outfits && outfits.length === 0 && (
        <p className="lede" style={{ marginTop: 20 }}>
          Nothing here yet. Generate looks on <a href="/style" style={{ color: 'var(--gold)' }}>Style</a> and tap the heart to love the ones you want to keep.
        </p>
      )}

      {outfits && outfits.length > 0 && (
        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 30 }}>
          {outfits.map((o, idx) => (
            <div key={o.id || idx}>
              <FlatLay outfit={o} idx={idx} />
              <div style={{ padding: '14px 4px 0' }}>
                {(o.occasion || o.weather_context) && (
                  <p className="note" style={{ marginTop: 0, fontStyle: 'normal' }}>
                    {[o.occasion, o.weather_context].filter(Boolean).join(' · ')}
                  </p>
                )}
                {o.why && <p style={{ fontSize: 14, lineHeight: 1.55, marginTop: 8 }}>{o.why}</p>}
                {o.styling_tip && (
                  <p style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 8 }}>
                    <strong style={{ color: 'var(--gold)' }}>Styling tip · </strong>{o.styling_tip}
                  </p>
                )}
                {o.gap && (
                  <p className="note" style={{ marginTop: 10 }}>
                    Missing piece · you don’t own {o.gap}
                    {o.gap_workaround ? ` — for now, ${o.gap_workaround}` : ''}
                  </p>
                )}
                <div style={{ marginTop: 12 }}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => remove(o.id)}
                    disabled={removingId === o.id}
                    style={{ padding: '8px 16px', fontSize: 13 }}
                  >
                    {removingId === o.id ? 'Removing…' : '♥ Remove'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
