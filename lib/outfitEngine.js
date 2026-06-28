// The styling brain. Builds a stylist-grade prompt over the real wardrobe and
// returns structured outfits. Generation uses a strong model for quality.
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

// Compact the wardrobe so the model sees clean, token-light data.
function compactItem(it) {
  return {
    id: it.id,
    category: it.category,
    subcategory: it.subcategory,
    color: it.color?.primary || null,
    pattern: it.color?.pattern || null,
    fabric: it.fabric,
    silhouette: it.silhouette,
    seasons: it.season ? Object.keys(it.season).filter((k) => it.season[k]) : [],
    vibe: Array.isArray(it.style_vibe) ? it.style_vibe : [],
  };
}

function leanText(sig) {
  const out = [];
  if (typeof sig?.leanPolished === 'number') {
    out.push(sig.leanPolished >= 60 ? 'polished' : sig.leanPolished <= 40 ? 'relaxed' : 'balanced relaxed/polished');
  }
  if (typeof sig?.leanStatement === 'number') {
    out.push(sig.leanStatement >= 60 ? 'statement-leaning' : sig.leanStatement <= 40 ? 'understated' : 'balanced understated/statement');
  }
  return out.join(', ') || 'no strong lean set';
}

function contrastText(c) {
  if (c === 'clean') return 'Clean — keep looks cohesive and harmonious; minimal unexpected contrast.';
  if (c === 'bold') return 'Bold — lean into push/pull; deliberately add an unexpected element (often the shoe or bag) for tension.';
  return 'Balanced — mostly cohesive, with one tasteful unexpected touch where it elevates the look.';
}

export async function generateOutfits({ wardrobe, signature, occasion, weather, count, tripLength }) {
  const items = wardrobe.map(compactItem);
  const refs = (signature?.references || []).join(', ') || 'none specified';

  const weatherLine = weather?.ok
    ? `${weather.location}: about ${weather.high}°F / ${weather.low}°F, ${weather.description}` +
      (weather.precip != null ? `, ${weather.precip}% chance of precipitation` : '') +
      (weather.source === 'seasonal' ? ' (seasonal estimate, not an exact forecast)' : '')
    : 'weather unavailable — dress for the season generally';

  const system = `You are Iris, a sharp personal stylist. You build outfits ONLY from the user's real wardrobe (provided as JSON). You never invent items.

Your styling philosophy:
- Shop the closet first: assemble looks from what they own.
- Build a cohesive base, then calibrate contrast per the user's contrast setting (push/pull tension is what makes a look feel intentionally styled, not thrown together).
- Finish a look: consider an accessory/jewelry/bag that completes it.
- Honor the user's lean and the aesthetic of their style references (translate those references into concrete styling cues — proportion, palette, formality, the kind of contrast they favor).
- Dress for the actual weather and the occasion.
- Only flag a gap when a look genuinely needs a piece they don't own to work — an intentional, specific suggestion (e.g. "a black ankle boot would complete this"), never generic "buy more."

Return ONLY valid JSON (no markdown), an object:
{ "outfits": [ {
  "title": "short evocative name tied to the occasion",
  "item_ids": ["<ids from the wardrobe>"],
  "why": "2-3 sentences on why this works (fit, palette, occasion, weather)",
  "styling_tip": "one concrete tip — how to wear it, the contrast move, how to finish it",
  "gap": "one specific missing piece that would complete it, or null"
} ] }
Each outfit must include at least a top+bottom OR a dress, plus footwear when available. Use only ids that exist in the wardrobe.

VOICE: Write "why" and "styling_tip" like a real stylist talking to a friend — warm, plain, specific, a little confident. Do NOT use em-dashes or en-dashes anywhere in your output; use commas, periods, or "and" instead. Avoid filler buzzwords (elevated, effortless, curated, timeless, chic, fashion-forward). Say real things: what to tuck, cuff, layer, or add, and why it looks good.`;

  const user = `WARDROBE (JSON):
${JSON.stringify(items)}

STYLE SIGNATURE:
- Lean: ${leanText(signature)}
- References to pull toward: ${refs}
- Contrast setting: ${contrastText(signature?.contrast)}

REQUEST:
- Occasion: ${occasion}${tripLength ? ` (a ${tripLength}-day trip)` : ''}
- Weather: ${weatherLine}
- Number of outfits to create: ${count}

Generate exactly ${count} outfit${count === 1 ? '' : 's'}.`;

  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 3000,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const textBlock = msg.content.find((b) => b.type === 'text');
  let raw = textBlock ? textBlock.text : '{}';
  raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: 'Could not parse the styling response.', raw };
  }
  return { ok: true, outfits: Array.isArray(parsed.outfits) ? parsed.outfits : [] };
}
