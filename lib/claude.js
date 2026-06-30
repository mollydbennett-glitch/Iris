// Claude vision tagging. Server-side only.
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

// The base tags every item gets. (silhouette, style_vibe and season already
// existed and stay exactly as they were — style_vibe IS the "aesthetic" field.)
const BASE_PROMPT = `You are an expert fashion stylist cataloging a single clothing item from a photo.
Look at the item and return ONLY a JSON object (no markdown, no backticks, no prose) with this exact shape:

{
  "category": one of "top" | "bottom" | "dress" | "outerwear" | "shoes" | "bag" | "accessory",
  "subcategory": a more specific type that fits the category. Use these where they apply:
     top: "blouse","t-shirt","sweater","tank","button-down","bodysuit","cami"
     bottom: "jeans","trousers","skirt","shorts","leggings"
     dress: "mini","midi","maxi","gown","slip"
     outerwear: "blazer","coat","jacket","cardigan","vest"
     shoes: "heels","flats","boots","sneakers","sandals","loafers"
     bag: "tote","crossbody","clutch","shoulder","backpack"
     accessory: "belt","scarf","hat","jewelry","sunglasses"
     If none fit, use a short lowercase word of your own.
  "color": { "primary": "string", "secondary": "string or null", "pattern": one of "solid" | "striped" | "plaid" | "floral" | "print" | "textured" | "other" },
  "fabric": "your best single-word guess (e.g. cotton, linen, denim, wool, silk, leather, knit, synthetic) — guess even if unsure",
  "season": { "spring": boolean, "summer": boolean, "fall": boolean, "winter": boolean },
  "style_vibe": array of 1-3 strings from: "minimalist","classic","trendy","edgy","romantic","sporty","bohemian","preppy","elevated-casual","statement",
  "silhouette": one of "fitted" | "relaxed" | "oversized" | "structured" | "flowy" | "tailored",

  "formality": integer 1-5 where 1 = loungewear and 5 = black-tie,
  "proportion_descriptors": {
     "length": array from "cropped","regular","midi","maxi","ankle","full",
     "structure": array from "structured","fluid","soft","stiff",
     "layering": array from "standalone","layerable","base-layer"
  },
  "color_role": one of "neutral" | "pop" | "grounding" | "texture_play",
     // neutral = background piece; pop = intentional accent; grounding = anchors a look; texture_play = visual weight from fabric
  "statement_level": one of "base" | "anchor" | "hero" | "statement",
     // base = goes with everything; anchor = carries the look but stays supporting; hero = the reason for the outfit; statement = stops you in the room

  "notes": "one short sentence; flag anything you are genuinely unsure about, especially fabric"`;

const CLOSE = `
}

Rules:
- A single item can belong to multiple seasons (set several to true).
- Be decisive on category, subcategory, color, season, formality, color_role and statement_level. Fabric is hard from a photo — give your best guess anyway.
- Return ONLY the JSON object.`;

// Conditional blocks, only added when the user has that guidance turned on.
function colorSeasonBlock(season) {
  return `,
  "color_season_alignment": one of "aligned" | "neutral" | "contrasts_intentionally"
     // The user's color season is "${season}". Judge whether this piece's color flatters that season, is neutral, or intentionally contrasts.`;
}
function bodyTypeBlock(type) {
  return `,
  "body_type_notes": "one short sentence on whether this piece tends to flatter a ${type} shape, and why or why not"`;
}

// opts: { colorSeason?: string, bodyType?: string } — pass these only when the
// matching guidance is enabled in the user's settings.
export async function tagClothingImage(base64Data, mediaType, opts = {}) {
  let prompt = BASE_PROMPT;
  if (opts.colorSeason) prompt += colorSeasonBlock(opts.colorSeason);
  if (opts.bodyType) prompt += bodyTypeBlock(opts.bodyType);
  prompt += CLOSE;

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          { type: 'text', text: prompt },
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

// Reads taste signals from an image the user saved because they love the look.
// Returns palette / proportion / formality / vibe / a short actionable summary,
// so the user never has to put their taste into words.
const TASTE_PROMPT = `You are Iris, a stylist studying an image the user saved because they love the look. Read the TASTE signals, not a literal item list. Return ONLY a JSON object (no markdown, no backticks):
{
  "palette": "short phrase for the colors and how they relate",
  "proportion": "short phrase for silhouette, length, structure, layering",
  "formality": integer 1-5 (1 loungewear, 5 black-tie),
  "vibe": ["1 to 3 short words"],
  "summary": "one short, concrete sentence Iris can style by. No buzzwords. Do not use dashes."
}`;

export async function readTasteImage(base64Data, mediaType) {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          { type: 'text', text: TASTE_PROMPT },
        ],
      },
    ],
  });
  const tb = msg.content.find((b) => b.type === 'text');
  let raw = tb ? tb.text : '{}';
  raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(raw);
  } catch (e) {
    return { summary: '', vibe: [], _raw: raw };
  }
}
