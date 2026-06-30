import { NextResponse } from 'next/server';
import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';
import { evaluateItem } from '@/lib/outfitEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const db = getSupabaseAdmin();

    const [itemRes, ownedRes, settingsRes, tasteRes] = await Promise.all([
      db.from('wardrobe_items').select('*').eq('id', id).single(),
      db.from('wardrobe_items').select('*').eq('user_id', PHASE1_USER_ID).eq('status', 'owned'),
      db.from('user_settings').select('*').eq('user_id', PHASE1_USER_ID).maybeSingle(),
      db.from('taste_references').select('read, love_part').eq('user_id', PHASE1_USER_ID),
    ]);

    if (itemRes.error) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    const item = itemRes.data;
    const owned = ownedRes.data || [];

    if (owned.length < 2) {
      return NextResponse.json({ error: 'Add more of your own closet before weighing new pieces.' }, { status: 400 });
    }

    // Build the signature, including loved-look reads (same as styling).
    const settings = settingsRes.data || {};
    const tasteRefs = (tasteRes?.data || [])
      .map((t) => {
        const r = t.read || {};
        let s = [r.summary, r.palette, r.proportion].filter(Boolean).join('; ');
        if (t.love_part && t.love_part !== 'the whole vibe') s += ` (they love ${t.love_part})`;
        return s.trim();
      })
      .filter(Boolean);
    const baseSig = settings.style_signature || {};
    const signature = {
      ...baseSig,
      references: [...(Array.isArray(baseSig.references) ? baseSig.references : []), ...tasteRefs],
      styling_rules: settings.styling_rules || null,
      proportion_playbook: settings.proportion_playbook || null,
    };

    const result = await evaluateItem({ wardrobe: owned, signature, item });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

    // Hydrate the unlocked looks (candidate + owned items) for display.
    const byId = new Map(owned.map((it) => [it.id, it]));
    byId.set(item.id, item);
    const outfits = result.outfits.map((o) => ({
      title: o.title,
      why: o.why,
      scores: o.scores,
      items: (o.item_ids || []).map((i) => byId.get(i)).filter(Boolean),
    }));

    // Dupe check: owned pieces in the same category (similarity only, no wear claims yet).
    const similar = owned
      .filter((o) => o.category && o.category === item.category)
      .slice(0, 3)
      .map((o) => ({ id: o.id, image_url: o.cutout_url || o.image_url, subcategory: o.subcategory, name: o.name }));

    return NextResponse.json({ verdict: result.verdict, reason: result.reason, outfits, similar });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}
