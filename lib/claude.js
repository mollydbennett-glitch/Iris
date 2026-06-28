// Claude vision tagging. Server-side only.
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const TAGGING_PROMPT = `You are an expert fashion stylist cataloging a single clothing item from a photo.
Look at the item and return ONLY a JSON object (no markdown, no backticks, no prose) with this exact shape:

{
  "category": one of "top" | "bottom" | "dress" | "outerwear" | "shoes" | "bag" | "accessory",
  "color": { "primary": "string", "secondary": "string or null", "pattern": one of "solid" | "striped" | "plaid" | "floral" | "print" | "textured" | "other" },
  "fabric": "your best single-word guess (e.g. cotton, linen, denim, wool, silk, leather, knit, synthetic) — guess even if unsure",
  "season": { "spring": boolean, "summer": boolean, "fall": boolean, "winter": boolean },
  "style_vibe": array of 1-3 strings from: "minimalist","classic","trendy","edgy","romantic","sporty","bohemian","preppy","elevated-casual","statement",
  "silhouette": one of "fitted" | "relaxed" | "oversized" | "structured" | "flowy" | "tailored",
  "notes": "one short sentence; flag anything you are genuinely unsure about, especially fabric"
}

Rules:
- A single item can belong to multiple seasons (set several to true).
- Be decisive on category, color, and season. Fabric is hard from a photo — give your best guess anyway.
- Return ONLY the JSON object.`;

export async function tagClothingImage(base64Data, mediaType) {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          { type: 'text', text: TAGGING_PROMPT },
        ],
      },
    ],
  });

  const textBlock = msg.content.find((b) => b.type === 'text');
  let raw = textBlock ? textBlock.text : '{}';

  // Defensive: strip code fences if the model added them.
  raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(raw);
  } catch (e) {
    // Surface the raw text so we can debug a bad parse instead of crashing.
    return { _parse_error: true, _raw: raw };
  }
}
