import { getSupabaseAdmin, PHASE1_USER_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // always fetch fresh, never cache

function seasonList(season) {
  if (!season) return [];
  return Object.keys(season).filter((k) => season[k]);
}

export default async function WardrobePage() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: items, error } = await supabaseAdmin
    .from('wardrobe_items')
    .select('*')
    .eq('user_id', PHASE1_USER_ID)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div>
        <h1 className="display">Wardrobe</h1>
        <p className="status err" style={{ display: 'block' }}>Couldn’t load your wardrobe: {error.message}</p>
      </div>
    );
  }

  const list = items || [];

  return (
    <div>
      <h1 className="display">Wardrobe</h1>
      <p className="lede">
        {list.length === 0
          ? 'Nothing here yet — add a few pieces and they’ll show up.'
          : `${list.length} piece${list.length === 1 ? '' : 's'} in your closet.`}
      </p>

      {list.length === 0 ? (
        <div style={{ marginTop: 24 }}>
          <a href="/upload" className="btn">Add items</a>
        </div>
      ) : (
        <div
          style={{
            marginTop: 28,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
            gap: 18,
          }}
        >
          {list.map((it) => {
            const seasons = seasonList(it.season);
            return (
              <div
                key={it.id}
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <div style={{ width: '100%', aspectRatio: '3 / 4', background: 'var(--gold-soft)' }}>
                  <img
                    src={it.image_url}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
                <div style={{ padding: '10px 12px 12px' }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, textTransform: 'capitalize' }}>
                    {it.color?.primary ? `${it.color.primary} ` : ''}
                    {it.subcategory || it.category || 'item'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3, textTransform: 'capitalize' }}>
                    {[it.category, it.fabric].filter(Boolean).join(' · ')}
                  </div>
                  {seasons.length > 0 && (
                    <div style={{ marginTop: 7, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {seasons.map((s) => (
                        <span key={s} className="pill" style={{ marginRight: 0 }}>{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
