'use client';

import { useEffect, useRef, useState } from 'react';

export default function BookmarkletPage() {
  const linkRef = useRef(null);
  const [copied, setCopied] = useState(false);

  // Set this to your Iris domain (same one used in public/iris-capture.js).
  const BASE = 'https://iris-jet-eight.vercel.app';
  const code = `javascript:(function(){var s=document.createElement('script');s.src='${BASE}/iris-capture.js?'+Date.now();document.body.appendChild(s);})();`;

  // React strips javascript: hrefs at render, so set it on the DOM node directly.
  useEffect(() => {
    if (linkRef.current) linkRef.current.setAttribute('href', code);
  }, [code]);

  async function copy() {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (e) {}
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 className="display">The Iris button</h1>
      <p className="lede">One button for the whole web. On any shopping page, it can love the look or save the piece to consider.</p>

      <ol style={{ marginTop: 20, lineHeight: 1.7, paddingLeft: 20 }}>
        <li>Show your browser’s bookmarks bar (View → Always Show Bookmarks Bar, or ⌘⇧B).</li>
        <li>Drag this button up to your bookmarks bar:</li>
      </ol>

      <div style={{ margin: '14px 0 20px' }}>
        <a ref={linkRef} href="#"
          onClick={(e) => e.preventDefault()}
          style={{ display: 'inline-block', background: 'var(--ink)', color: '#fff', textDecoration: 'none', padding: '10px 20px', borderRadius: 8, fontFamily: 'Georgia, serif', fontSize: 16 }}>
          ♡ Iris
        </a>
      </div>

      <p className="note">Can’t drag? Make a new bookmark by hand and paste this as the address:</p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
        <code style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px', fontSize: 11, overflowX: 'auto', whiteSpace: 'nowrap' }}>{code}</code>
        <button className="btn btn-ghost" onClick={copy} style={{ padding: '8px 14px', fontSize: 13 }}>{copied ? 'Copied' : 'Copy'}</button>
      </div>

      <h2 className="serif" style={{ fontWeight: 400, fontSize: 22, marginTop: 32 }}>Using it</h2>
      <p style={{ lineHeight: 1.6 }}>
        On any product or inspiration page, click <strong>♡ Iris</strong> in your bookmarks bar. A small card pops up with the image, name and price already filled in.
      </p>
      <p style={{ lineHeight: 1.6, marginTop: 10 }}>
        <strong>Love this</strong> saves the image to your taste board. <strong>Consider this</strong> saves the link, image and price to your Considering list, where you can ask Iris to buy or cry.
      </p>
      <p className="note" style={{ marginTop: 16 }}>If it ever grabs the wrong image, use the picker arrows or paste the right image URL right in the card.</p>
    </div>
  );
}
