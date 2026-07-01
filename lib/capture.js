import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

// Cross-origin headers so the bookmarklet can call these from any retail page.
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Download a remote image, shrink it when we can, and store it in Supabase.
// Returns the public URL, base64, and the media type to hand vision. Formats
// we can't re-encode (e.g. WebP from Pinterest) are kept as-is, not dropped.
function sniffMime(buf) {
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.length > 4 && buf.toString('ascii', 0, 3) === 'GIF') return 'image/gif';
  return '';
}

export async function storeRemoteImage(imageUrl, prefix) {
  const resp = await fetch(imageUrl, { headers: { 'User-Agent': UA } });
  if (!resp.ok) throw new Error('Could not fetch that image');
  let buffer = Buffer.from(await resp.arrayBuffer());

  let mime = (resp.headers.get('content-type') || '').split(';')[0].toLowerCase();
  if (!/^image\//.test(mime)) mime = sniffMime(buffer) || 'image/jpeg';

  // Try to shrink and normalize to JPEG. If the format can't be decoded here,
  // keep the original bytes and its real media type (vision handles WebP/PNG/GIF).
  try {
    const { Jimp } = await import('jimp');
    const img = await Jimp.fromBuffer(buffer, { 'image/jpeg': { maxMemoryUsageInMB: 8192 } });
    if (img.width > 1400 || img.height > 1400) img.scaleToFit({ w: 1400, h: 1400 });
    buffer = await img.getBuffer('image/jpeg', { quality: 80 });
    mime = 'image/jpeg';
  } catch (e) {
    // unsupported format — keep original buffer + mime
  }

  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : mime === 'image/gif' ? 'gif' : 'jpg';
  const base64 = buffer.toString('base64');

  const db = getSupabaseAdmin();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${PHASE1_USER_ID}/${prefix}/${filename}`;
  const { error } = await db.storage.from('wardrobe').upload(path, buffer, { contentType: mime, upsert: false });
  if (error) throw new Error(`Storage: ${error.message}`);
  const publicUrl = db.storage.from('wardrobe').getPublicUrl(path).data.publicUrl;
  return { publicUrl, base64, mediaType: mime };
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
