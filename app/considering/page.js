'use client';

import { useState, useEffect, useRef } from 'react';
import { FlatLay } from '@/components/FlatLay';

const overlay = { position: 'fixed', inset: 0, background: 'rgba(40,36,32,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 };
const sheet = { background: '#fff', borderRadius: 8, padding: 20, maxWidth: 600, width: '100%', maxHeight: '88vh', overflowY: 'auto' };
const inputStyle = { padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 2, background: '#fff', color: 'var(--ink)', fontSize: 14, width: '100%' };

export default function ConsideringPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [source, setSource] = useState('');
  const [adding, setAdding] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);
  const fileRef = useRef(null);

  const [panel, setPanel] = useState({ open: false, item: null, loading: false, data: null });

  async function load() {
    try {
      const res = await fetch('/api/considering');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setItems(data.items || []);
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!file) return;
    setAdding(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('status', 'considering');
      if (name.trim()) fd.append('name', name.trim());
      if (price.trim()) fd.append('price', price.trim());
      if (source.trim()) fd.append('source', source.trim());
      const res = await fetch('/api/wardrobe/upload', { method: 'POST', body: fd });
      if (res.ok) {
        setFile(null); setName(''); setPrice(''); setSource('');
        if (fileRef.current) fileRef.current.value = '';
        await load();
      }
    } finally { setAdding(false); }
  }

  async function captureUrl() {
    const u = urlInput.trim();
    if (!u) return;
    setCapturing(true);
    setError('');
    try {
      const res = await fetch('/api/considering/capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: u }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not read that link');
      setUrlInput('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCapturing(false);
    }
  }

  async function weigh(item) {
    setPanel({ open: true, item, loading: true, data: null });
    try {
      const res = await fetch(`/api/considering/${item.id}/verdict`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not weigh this');
      setPanel({ open: true, item, loading: false, data });
    } catch (err) {
      setPanel({ open: true, item, loading: false, data: { error: err.message } });
    }
  }
  async function buy(id) {
    await fetch(`/api/considering/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'owned' }) });
    setPanel({ open: false, item: null, loading: false, data: null });
    setItems((prev) => prev.filter((x) => x.id !== id));
  }
  async function letGo(id) {
    await fetch(`/api/considering/${id}`, { method: 'DELETE' });
    setPanel({ open: false, item: null, loading: false, data: null });
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  const label = (it) => it.name || [it.color?.primary, it.subcategory || it.category].filter(Boolean).join(' ') || 'Item';

  return (
    <div>
      <h1 className="display">Considering</h1>
      <p className="lede">Pieces you’re weighing. Iris tells you to buy or cry, by trying to build looks with your closet.</p>

      <div style={{ marginTop: 18, padding: 16, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 4, maxWidth: 600 }}>
        <label className="note" style={{ fontStyle: 'normal', display: 'block', marginBottom: 6 }}>Paste a product link</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://…" style={{ ...inputStyle, flex: 1 }} />
          <button className="btn" onClick={captureUrl} disabled={!urlInput.trim() || capturing}>{capturing ? <><span className="spinner" /> Reading…</> : 'Add'}</button>
        </div>
        <p className="note" style={{ marginTop: 10 }}>
          On a shopping page already? <a href="/bookmarklet" style={{ color: 'var(--gold)' }}>Install the Iris button</a> to save in one click.
          {' · '}
          <button onClick={() => setShowPhoto(!showPhoto)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', padding: 0, fontSize: 'inherit' }}>
            {showPhoto ? 'hide photo upload' : 'add by photo instead'}
          </button>
        </p>

        {showPhoto && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, alignItems: 'end' }}>
              <div className="field" style={{ margin: 0 }}>
                <label>Photo</label>
                <input ref={fileRef} type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ fontSize: 13 }} />
              </div>
              <div className="field" style={{ margin: 0 }}><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Square-toe flat" style={inputStyle} /></div>
              <div className="field" style={{ margin: 0 }}><label>Price</label><input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="180" style={inputStyle} /></div>
              <div className="field" style={{ margin: 0 }}><label>From</label><input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Everlane" style={inputStyle} /></div>
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={add} disabled={!file || adding}>{adding ? <><span className="spinner" /> Reading…</> : 'Add by photo'}</button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="status err" style={{ display: 'block', marginTop: 16 }}>{error}</p>}
      {items === null && !error && <p className="note" style={{ marginTop: 20 }}><span className="spinner" /> Loading…</p>}
      {items && items.length === 0 && <p className="note" style={{ marginTop: 20 }}>Nothing here yet. Add a piece you’re thinking about.</p>}

      {items && items.length > 0 && (
        <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 18 }}>
          {items.map((it) => (
            <div key={it.id}>
              <img src={it.cutout_url || it.image_url} alt="" style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', borderRadius: 10, border: '0.5px solid var(--line)', display: 'block' }} />
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 14 }}>{label(it)}</div>
                <div className="note" style={{ fontStyle: 'normal' }}>{[it.price ? `$${it.price}` : null, it.source].filter(Boolean).join(' · ')}</div>
              </div>
              <button className="btn btn-ghost" onClick={() => weigh(it)} style={{ marginTop: 8, padding: '7px 14px', fontSize: 13 }}>Buy or cry?</button>
            </div>
          ))}
        </div>
      )}

      {panel.open && (
        <div style={overlay} onClick={() => setPanel({ open: false, item: null, loading: false, data: null })}>
          <div style={sheet} onClick={(e) => e.stopPropagation()}>
            {panel.loading || !panel.data ? (
              <p className="note"><span className="spinner" /> Trying it against your closet…</p>
            ) : panel.data.error ? (
              <>
                <p className="note">{panel.data.error}</p>
                <button className="btn btn-ghost" onClick={() => setPanel({ open: false, item: null, loading: false, data: null })} style={{ marginTop: 12 }}>Close</button>
              </>
            ) : (() => {
              const isBuy = panel.data.verdict === 'buy';
              return (
                <div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                    <img src={panel.item.cutout_url || panel.item.image_url} alt="" style={{ width: 54, aspectRatio: '4/5', objectFit: 'cover', borderRadius: 8, border: '0.5px solid var(--line)' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15 }}>{label(panel.item)}</div>
                      <div className="note" style={{ fontStyle: 'normal' }}>{[panel.item.price ? `$${panel.item.price}` : null, panel.item.source].filter(Boolean).join(' · ')}</div>
                    </div>
                  </div>

                  <div style={{ background: 'var(--card)', border: `1px solid ${isBuy ? 'var(--gold)' : 'var(--line)'}`, borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: isBuy ? 'var(--gold)' : 'var(--ink)' }}>{isBuy ? 'Buy' : 'Cry'}</div>
                    <div className="note" style={{ fontStyle: 'normal', marginTop: 2 }}>{panel.data.reason}</div>
                  </div>

                  {panel.data.outfits?.length > 0 && (
                    <>
                      <p className="note" style={{ textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 16, marginBottom: 8 }}>{isBuy ? 'What it unlocks' : 'The best it could do'}</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
                        {panel.data.outfits.map((o, i) => (
                          <div key={i}>
                            <FlatLay outfit={o} idx={i} />
                            <div className="note" style={{ fontStyle: 'normal', marginTop: 4 }}>{o.title}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {panel.data.similar?.length > 0 && (
                    <>
                      <p className="note" style={{ textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 16, marginBottom: 8 }}>Close to what you own</p>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {panel.data.similar.map((s) => (
                          <img key={s.id} src={s.image_url} alt="" style={{ width: 48, aspectRatio: '4/5', objectFit: 'cover', borderRadius: 8, border: '0.5px solid var(--line)' }} />
                        ))}
                        <span className="note" style={{ flex: 1 }}>You already own {panel.data.similar.length} similar {panel.item.category || 'piece'}{panel.data.similar.length === 1 ? '' : 's'}. Sure you need it?</span>
                      </div>
                    </>
                  )}

                  <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
                    {isBuy ? (
                      <>
                        <button className="btn" onClick={() => buy(panel.item.id)}>Add to my closet</button>
                        <button className="btn btn-ghost" onClick={() => letGo(panel.item.id)}>Let it go</button>
                      </>
                    ) : (
                      <>
                        <button className="btn" onClick={() => letGo(panel.item.id)}>Let it go</button>
                        <button className="btn btn-ghost" onClick={() => buy(panel.item.id)}>Add anyway</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
