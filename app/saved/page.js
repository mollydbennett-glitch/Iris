'use client';

import { useState, useEffect } from 'react';
import { FlatLay } from '@/components/FlatLay';

export default function SavedPage() {
  const [outfits, setOutfits] = useState(null);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState(null);
  const [filter, setFilter] = useState('All');
  const [wearBusyId, setWearBusyId] = useState(null);
  const [wornIds, setWornIds] = useState(new Set());

  const todayISO = new Date().toISOString().slice(0, 10);

  // Wore this: records today's wear for every item in the look in one tap.
  // Tapping again undoes it. Same idempotent endpoint the Planner uses, so
  // marking here and in the Planner on the same day never double-counts.
  async function toggleWore(o) {
    setWearBusyId(o.id);
    try {
      const worn = wornIds.has(o.id);
      const res = await fetch('/api/wear', {
        method: worn ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saved_outfit_id: o.id, worn_on: todayISO }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Could not record the wear');
      }
      setWornIds((prev) => {
        const next = new Set(prev);
        if (worn) next.delete(o.id); else next.add(o.id);
        return next;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setWearBusyId(null);
    }
  }

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

      {outfits && outfits.length > 0 && (() => {
        const occasions = Array.from(new Set(outfits.map((o) => o.occasion).filter(Boolean)));
        const chips = ['All', ...occasions];
        const visible = filter === 'All' ? outfits : outfits.filter((o) => o.occasion === filter);
        return (
          <>
            {occasions.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {chips.map((c) => {
                  const on = c === filter;
                  return (
                    <button key={c} onClick={() => setFilter(c)}
                      style={{ fontSize: 13, padding: '5px 13px', borderRadius: 999, cursor: 'pointer',
                        border: on ? '1px solid var(--gold)' : '1px solid var(--line)',
                        background: on ? 'var(--card)' : '#fff', color: on ? 'var(--gold)' : 'var(--ink-soft)' }}>
                      {c}
                    </button>
                  );
                })}
              </div>
            )}
            <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 30 }}>
              {visible.map((o, idx) => (
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
                    <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
                      <button className="btn btn-ghost" onClick={() => toggleWore(o)} disabled={wearBusyId === o.id}
                        style={{ padding: '8px 16px', fontSize: 13, color: wornIds.has(o.id) ? 'var(--gold)' : undefined,
                          borderColor: wornIds.has(o.id) ? 'var(--gold)' : undefined }}>
                        {wearBusyId === o.id ? 'Recording…' : wornIds.has(o.id) ? '✓ Worn today · undo' : 'Wore this'}
                      </button>
                      <button className="btn btn-ghost" onClick={() => remove(o.id)} disabled={removingId === o.id}
                        style={{ padding: '8px 16px', fontSize: 13 }}>
                        {removingId === o.id ? 'Removing…' : '♥ Remove'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        );
      })()}
    </div>
  );
}
