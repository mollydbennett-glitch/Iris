// Photoroom background removal -> transparent PNG cutout.
// Uses the Remove Background API (cheaper endpoint). Best-effort: returns null
// on any failure or if no key is set, so the wardrobe still works without it.

export async function removeBackground(jpegBuffer) {
  const key = process.env.PHOTOROOM_API_KEY;
  if (!key) return null;
  try {
    const form = new FormData();
    form.append('image_file', new Blob([jpegBuffer], { type: 'image/jpeg' }), 'item.jpg');
    form.append('format', 'png'); // transparent PNG

    const res = await fetch('https://sdk.photoroom.com/v1/segment', {
      method: 'POST',
      headers: { 'x-api-key': key },
      body: form,
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}
