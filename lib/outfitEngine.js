// The styling brain. Builds a stylist-grade prompt over the real wardrobe and
// returns structured, self-scored outfits. Generation uses a strong model.
//
// Phase A changes:
//  - Iris scores every candidate on four dimensions (Proportions, Aesthetic,
//    Cohesion, Style). We OVER-generate, then keep only looks scoring >=4 on
//    >=3 dimensions, sorted by Style. The filter happens here in code, not on
//    the model's honor, so it actually prevents safe/generic filler.
//  - Gap is now "make it work now" first (a workaround from the real closet),
//    with the missing piece and its impact as optional, quantified detail.
//  - Injects the user's styling guidance (body type / color season) and their
//    proportion playbook, with the rule that taste + references win over rules.
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

// Compact the wardrobe so the model sees clean, token-light data. New tag
// fields are only included when present, so this is safe before any backfill.
function compactItem(it) {
  const out = {
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
  if (it.formality != null) out.formality = it.formality;
  if (it.proportion_descriptors) out.proportion = it.proportion_descriptors;
  if (it.color_role) out.colorRole = it.color_role;
  if (it.statement_level) out.statement = it.statement_level;
  return out;
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
  if (c === 'clean') return 'Clean. Keep looks cohesive and harmonious; minimal unexpected contrast.';
  if (c === 'bold') return 'Bold. Lean into push/pull; deliberately add an unexpected element (often the shoe or bag) for tension.';
  return 'Balanced. Mostly cohesive, with one tasteful unexpected touch where it elevates the look.';
}

// References can be plain strings (legacy) or rich objects (Phase A settings).
function refsText(refs) {
  if (!Array.isArray(refs) || !refs.length) return 'none specified';
  return refs
    .map((r) => (typeof r === 'string' ? r : [r.name, r.why_you_love_it || r.why].filter(Boolean).join(': ')))
    .filter(Boolean)
    .join('; ');
}

function stylingRulesText(rules) {
  if (!rules) return 'none set; style by feel.';
  const out = [];
  if (rules.body_type?.enabled && rules.body_type?.type) {
    out.push(`Body type: prefer silhouettes and proportions that flatter a ${rules.body_type.type} shape.`);
  }
  if (rules.color_season?.enabled && rules.color_season?.season) {
    out.push(`Color season: lean toward colors that flatter ${rules.color_season.season}.`);
  }
  if (!out.length) return 'none set; style by feel.';
  out.push("These are gentle guides. The user's taste and references win when they conflict.");
  return out.join(' ');
}

function playbookText(pb) {
  if (!Array.isArray(pb) || !pb.length) return '';
  const lines = pb.slice(0, 15).map((p, i) => {
    if (typeof p === 'string') return `${i + 1}. ${p}`;
    return `${i + 1}. ${p.pattern || ''}${p.why ? ` (works because ${p.why})` : ''}`;
  });
  return `\nPROPORTION PLAYS THE USER LOVES (reach for these when the closet allows):\n${lines.join('\n')}`;
}

const DIMS = ['proportions', 'aesthetic', 'cohesion', 'style'];

// Keep a look only if it scores >=4 on at least 3 of the four dimensions.
function passes(scores) {
  if (!scores) return false;
  const strong = DIMS.filter((d) => Number(scores[d]) >= 4).length;
  return strong >= 3;
}
function styleScore(o) {
  return Number(o?.scores?.style) || 0;
}

export async function generateOutfits({ wardrobe, signature, occasion, weather, count, tripLength }) {
  const items = wardrobe.map(compactItem);
  const refs = refsText(signature?.references);
  const want = Math.max(1, Math.min(10, Number(count) || 3));
  // Over-generate so the quality filter has something to cut.
  const candidates = Math.min(10, want + 2);

  const weatherLine = weather?.ok
    ? `${weather.location}: about ${weather.high}°F / ${weather.low}°F, ${weather.description}` +
      (weather.precip != null ? `, ${weather.precip}% chance of precipitation` : '') +
      (weather.source === 'seasonal' ? ' (seasonal estimate, not an exact forecast)' : '')
    : 'weather unavailable; dress for the season generally';

  const system = `You are Iris, a sharp personal stylist. You build outfits ONLY from the user's real wardrobe (provided as JSON). You never invent items.

Your styling philosophy:
- Shop the closet first: assemble looks from what they own.
- Build a cohesive base, then calibrate contrast per the user's contrast setting (push/pull tension is what makes a look feel intentionally styled, not thrown together).
- Finish a look: consider an accessory/jewelry/bag that completes it.
- Honor the user's lean and the aesthetic of their style references (translate those references into concrete styling cues: proportion, palette, formality, the kind of contrast they favor).
- Respect the user's styling guidance when given, but their taste and references win over any rule.
- Dress for the actual weather and the occasion.

SCORE EVERY OUTFIT honestly on four dimensions, 1 to 5:
- proportions: do the pieces play well structurally (length, volume, silhouette)?
- aesthetic: does it match the user's taste and references?
- cohesion: do proportion, palette and formality all speak one language?
- style: does it feel intentional and specific, not safe or generic?
Score by your real read. Do not inflate. Weak looks are expected among the candidates; honest low scores let the best ones rise.

GAP: a gap is ONE specific piece the user does NOT own that this outfit actually needs to work (for example "a plain white tee" when the look wants one and there isn't one in the wardrobe). If the outfit is complete with what they own, the gap is null. Never name a piece that already exists in the wardrobe, and never say generic "buy more." When there is a real gap, also say in one line how they could wear the look TODAY without that piece, and roughly how many more outfits owning it would unlock.

Return ONLY valid JSON (no markdown), an object:
{ "outfits": [ {
  "title": "short evocative name tied to the occasion",
  "item_ids": ["<ids from the wardrobe>"],
  "why": "2-3 sentences on why this works (fit, palette, occasion, weather)",
  "styling_tip": "one concrete tip: how to wear it, the contrast move, how to finish it",
  "scores": { "proportions": 1-5, "aesthetic": 1-5, "cohesion": 1-5, "style": 1-5 },
  "gap": { "suggested": "the one missing piece the outfit needs, or null if complete", "workaround": "how to wear it today without that piece (only if there is a gap)", "impact": integer or null } or null
} ] }
Each outfit must include at least a top+bottom OR a dress, plus footwear when available. Use only ids that exist in the wardrobe.

VOICE: Write "why", "styling_tip" and the gap text like a real stylist talking to a friend: warm, plain, specific, a little confident. Do NOT use em-dashes or en-dashes anywhere in your output; use commas, periods, or "and" instead. Avoid filler buzzwords (elevated, effortless, curated, timeless, chic, fashion-forward). Say real things: what to tuck, cuff, layer, or add, and why it looks good.`;

  const user = `WARDROBE (JSON):
${JSON.stringify(items)}

STYLE SIGNATURE:
- Lean: ${leanText(signature)}
- References to pull toward: ${refs}
- Contrast setting: ${contrastText(signature?.contrast)}
- Styling guidance: ${stylingRulesText(signature?.styling_rules)}${playbookText(signature?.proportion_playbook)}

REQUEST:
- Occasion: ${occasion}${tripLength ? ` (a ${tripLength}-day trip)` : ''}
- Weather: ${weatherLine}

Generate ${candidates} candidate outfit${candidates === 1 ? '' : 's'}, each fully scored. Make them genuinely different from one another. I will keep the strongest.`;

  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4500,
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

  const all = Array.isArray(parsed.outfits) ? parsed.outfits : [];

  // Real filter, in code: keep the strong looks, best Style first.
  let kept = all.filter((o) => passes(o.scores)).sort((a, b) => styleScore(b) - styleScore(a));
  let final = kept.slice(0, want);

  // If nothing cleared the bar, surface the single strongest so the page is
  // never empty, rather than padding with weak looks.
  if (final.length === 0 && all.length) {
    final = [...all].sort((a, b) => styleScore(b) - styleScore(a)).slice(0, 1);
  }

  // Normalize each look. Keep `gap` as a friendly STRING (so existing UI keeps
  // working), and expose the structured pieces separately for saving.
  const outfits = final.map((o) => {
    const g = o.gap && typeof o.gap === 'object' ? o.gap : null;
    const gapText = g ? (g.suggested || null) : (typeof o.gap === 'string' ? o.gap : null);
    return {
      title: o.title || 'Outfit',
      item_ids: Array.isArray(o.item_ids) ? o.item_ids : [],
      why: o.why || '',
      styling_tip: o.styling_tip || '',
      scores: o.scores || null,
      gap: gapText,
      gap_suggested: g?.suggested || null,
      gap_workaround: g?.workaround || null,
      gap_impact: Number.isFinite(g?.impact) ? g.impact : null,
    };
  });

  return { ok: true, outfits };
}

// Decides whether one new piece earns a place: tries to build cohesive looks
// from the owned closet PLUS the candidate, in the user's style. If it makes
// good looks, that's a "buy"; if it can't, it's a "cry". The code (not the
// model) decides by counting quality looks that actually use the piece.
export async function evaluateItem({ wardrobe, signature, item }) {
  const owned = wardrobe.map(compactItem);
  const candidate = compactItem(item);
  const refs = refsText(signature?.references);

  const system = `You are Iris, a sharp personal stylist. The user is weighing whether to buy ONE new piece (the candidate). Decide honestly whether it earns a place in their closet.

Build outfits that EACH include the candidate item, using ONLY the user's owned items for everything else. Never invent items. If the candidate genuinely cannot make good, wearable looks with what they own and in their style, that is a real and useful answer; do not force weak looks to be polite.

Honor the user's lean, contrast setting, and the aesthetic of their references. Score every outfit honestly 1 to 5 on proportions, aesthetic, cohesion, and style.

Return ONLY JSON:
{ "reason": "one plain sentence on why it does or doesn't work with this closet and style",
  "outfits": [ { "title": "short name", "item_ids": ["candidate id + owned ids"], "why": "1-2 sentences", "scores": { "proportions":1-5, "aesthetic":1-5, "cohesion":1-5, "style":1-5 } } ] }
Every outfit must include the candidate id. Use only ids that exist. Do not use dashes; avoid buzzwords (elevated, effortless, curated, timeless, chic).`;

  const user = `OWNED WARDROBE (JSON):
${JSON.stringify(owned)}

CANDIDATE PIECE (must appear in every outfit), id "${item.id}":
${JSON.stringify(candidate)}

STYLE SIGNATURE:
- Lean: ${leanText(signature)}
- References: ${refs}
- Contrast: ${contrastText(signature?.contrast)}
- Styling guidance: ${stylingRulesText(signature?.styling_rules)}${playbookText(signature?.proportion_playbook)}

Try to build 4 genuinely good outfits that each use the candidate. Score each honestly.`;

  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 3500,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const textBlock = msg.content.find((b) => b.type === 'text');
  let raw = textBlock ? textBlock.text : '{}';
  raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { return { ok: false, error: 'Could not parse the verdict.' }; }

  const all = Array.isArray(parsed.outfits) ? parsed.outfits : [];
  const usable = all
    .filter((o) => Array.isArray(o.item_ids) && o.item_ids.includes(item.id) && passes(o.scores))
    .sort((a, b) => styleScore(b) - styleScore(a));

  const verdict = usable.length >= 2 ? 'buy' : 'cry';
  const reason = parsed.reason ||
    (verdict === 'buy' ? `Makes ${usable.length} strong looks from what you already own.` : 'Hard to place with your closet and the looks you save.');

  return {
    ok: true,
    verdict,
    reason,
    outfits: usable.slice(0, 3).map((o) => ({ title: o.title || 'Outfit', item_ids: o.item_ids, why: o.why || '', scores: o.scores || null })),
  };
}
