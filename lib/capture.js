import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

// Cross-origin headers so the bookmarklet can call these from any retail page.
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Download a remote image, shrink it, store it in Supabase, and hand back both
// the public URL and base64 (so vision can read it without a second fetch).
export async function storeRemoteImage(imageUrl, prefix) {
  const resp = await fetch(imageUrl, { headers: { 'User-Agent': UA } });
  if (!resp.ok) throw new Error('Could not fetch that image');
  let buffer = Buffer.from(await resp.arrayBuffer());

  const { Jimp } = await import('jimp');
  const img = await Jimp.fromBuffer(buffer, { 'image/jpeg': { maxMemoryUsageInMB: 8192 } });
  if (img.width > 1400 || img.height > 1400) img.scaleToFit({ w: 1400, h: 1400 });
  buffer = await img.getBuffer('image/jpeg', { quality: 80 });
  const base64 = buffer.toString('base64');

  const db = getSupabaseAdmin();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const path = `${PHASE1_USER_ID}/${prefix}/${filename}`;
  const { error } = await db.storage.from('wardrobe').upload(path, buffer, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`Storage: ${error.message}`);
  const publicUrl = db.storage.from('wardrobe').getPublicUrl(path).data.publicUrl;
  return { publicUrl, base64 };
}

function meta(html, prop) {
  const re = new RegExp('<meta[^>]+(?:property|name)=["\']' + prop.replace(/:/g, '\\:') + '["\'][^>]*>', 'i');
  const tag = html.match(re);
  if (!tag) return '';
  const c = tag[0].match(/content=["']([^"']*)["']/i);
  return c ? c[1] : '';
}

// Best-effort: pull image / title / price / store from a product page's Open
// Graph + JSON-LD. Works on most sites; thin or bot-blocked pages return blanks.
export async function fetchOg(url) {
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': UA } });
    const html = await resp.text();

    let price = 0;
    const pm = meta(html, 'og:price:amount') || meta(html, 'product:price:amount');
    if (pm) price = parseFloat(pm) || 0;
    if (!price) {
      const ld = html.match(/"price"\s*:\s*"?([\d.]+)"?/i);
      if (ld) price = parseFloat(ld[1]) || 0;
    }

    let title = meta(html, 'og:title');
    if (!title) {
      const t = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      title = t ? t[1].trim() : '';
    }
    title = title.replace(/\s*[|\-\u2013\u2014]\s*.+$/, '').trim();

    return {
      imageUrl: meta(html, 'og:image') || meta(html, 'twitter:image'),
      title,
      price,
      source: meta(html, 'og:site_name'),
    };
  } catch (e) {
    return { imageUrl: '', title: '', price: 0, source: '' };
  }
}

// Clean brand name from a hostname: www.thereformation.com -> Reformation.
export function hostBrand(url) {
  try {
    let host = new URL(url).hostname.toLowerCase().replace(/^(www|shop|store|us|en|m|mobile)\./, '');
    const parts = host.split('.');
    const compound = ['co', 'com', 'net', 'org', 'ac'];
    const base = parts.length >= 3 && compound.includes(parts[parts.length - 2]) ? parts[parts.length - 3] : parts[parts.length - 2];
    return base ? base.charAt(0).toUpperCase() + base.slice(1) : '';
  } catch (e) {
    return '';
  }
}
