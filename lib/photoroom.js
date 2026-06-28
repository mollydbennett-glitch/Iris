// Photoroom background removal -> transparent PNG cutout.
// Returns { ok, buffer } on success, or { ok:false, message } with a readable
// reason so callers can surface WHY it failed instead of silently doing nothing.

export async function removeBackground(jpegBuffer) {
  const key = process.env.PHOTOROOM_API_KEY;
  if (!key) {
    return { ok: false, message: 'PHOTOROOM_API_KEY is not set on the server (add it in Vercel, then redeploy).' };
  }
  try {
    const form = new FormData();
    form.append('image_file', new Blob([jpegBuffer], { type: 'image/jpeg' }), 'item.jpg');
    form.append('format', 'png'); // transparent PNG

    const res = await fetch('https://sdk.photoroom.com/v1/segment', {
      method: 'POST',
      headers: { 'x-api-key': key },
      body: form,
    });

    if (!res.ok) {
      let detail = '';
      try { detail = (await res.text()).slice(0, 200); } catch {}
      const hint =
        res.status === 401 ? ' (key not accepted)' :
        res.status === 402 ? ' (out of credits)' :
        res.status === 403 ? ' (API not activated for this account)' : '';
      return { ok: false, status: res.status, message: `Photoroom ${res.status}${hint}: ${detail}` };
    }

    return { ok: true, buffer: Buffer.from(await res.arrayBuffer()) };
  } catch (err) {
    return { ok: false, message: `Photoroom request failed: ${err.message}` };
  }
}
