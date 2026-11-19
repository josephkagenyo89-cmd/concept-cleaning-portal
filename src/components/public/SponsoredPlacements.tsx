import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

type Placement = {
  id: string; campaign_id: string;
  placement_key: 'homepage_featured' | 'marketplace_featured' | 'category_featured' | 'search_featured';
  category_id: string | null; service_id: string | null;
  display_label: string; display_order: number;
  campaign: { id: string; title: string; description: string | null; destination_url: string | null; creative_image_url: string | null; starts_at: string | null; ends_at: string | null; currency: string; status: string } | null;
};

function getSessionKey(): string {
  const key = 'ccs-sponsored-session-v1';
  try {
    const current = sessionStorage.getItem(key);
    if (current) return current;
    const created = crypto.randomUUID();
    sessionStorage.setItem(key, created);
    return created;
  } catch { return crypto.randomUUID(); }
}

async function track(row: Placement, eventType: 'impression' | 'click') {
  try {
    await supabase.functions.invoke('track-sponsored-campaign', { body: {
      campaign_id: row.campaign_id, placement_id: row.id, event_type: eventType,
      session_key: getSessionKey(), source_path: window.location.pathname + window.location.search,
    }});
  } catch (error) {
    console.warn('Sponsored campaign event was not recorded:', error);
  }
}

function getDestination(row: Placement) {
  const raw = row.campaign?.destination_url?.trim();
  if (raw) {
    try {
      const url = new URL(raw, window.location.origin);
      if (url.protocol === 'https:' || url.protocol === 'http:') return { href: url.href, external: url.origin !== window.location.origin };
    } catch { /* use service fallback */ }
  }
  return row.service_id ? { href: '/service/' + row.service_id, external: false } : { href: '/marketplace', external: false };
}

export default function SponsoredPlacements({ placementKey, categoryName, serviceIds, className = '' }: {
  placementKey: Placement['placement_key']; categoryName?: string; serviceIds?: string[]; className?: string;
}) {
  const [rows, setRows] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      const { data, error } = await (supabase as any).rpc('get_public_sponsored_placements', {
        p_placement_key: placementKey,
        p_category_name: placementKey === 'category_featured' ? categoryName || null : null,
      });
      if (!alive) return;
      if (error) {
        console.warn('Could not load sponsored placements:', error.message);
        setRows([]);
      } else {
        const mapped = (data || []).map((row: any) => ({
          id: row.placement_id, campaign_id: row.campaign_id, placement_key: row.placement_key,
          category_id: row.category_id, service_id: row.service_id, display_label: row.display_label,
          display_order: row.display_order,
          campaign: {
            id: row.campaign_id, title: row.title, description: row.description,
            destination_url: row.destination_url, creative_image_url: row.creative_image_url,
            starts_at: row.starts_at, ends_at: row.ends_at, currency: row.currency, status: 'approved',
          },
        })) as Placement[];
        setRows(mapped.filter(row => !row.service_id || !serviceIds?.length || serviceIds.includes(row.service_id)));
      }
      setLoading(false);
    };
    void load().catch(error => {
      console.warn('Sponsored placements unavailable:', error);
      if (alive) { setRows([]); setLoading(false); }
    });
    return () => { alive = false; };
  }, [placementKey, categoryName, serviceIds?.join('|')]);

  const visibleRows = useMemo(() => rows, [rows]);
  useEffect(() => {
    if (!visibleRows.length || typeof IntersectionObserver === 'undefined') return;
    const observers: IntersectionObserver[] = [];
    visibleRows.forEach(row => {
      if (seen.current.has(row.id)) return;
      const node = document.querySelector<HTMLElement>(`[data-sponsored-placement="${row.id}"]`);
      if (!node) return;
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          seen.current.add(row.id);
          void track(row, 'impression');
          observer.disconnect();
        }
      }, { threshold: 0.5 });
      observer.observe(node);
      observers.push(observer);
    });
    return () => observers.forEach(observer => observer.disconnect());
  }, [visibleRows]);

  if (loading || !visibleRows.length) return null;
  return <section aria-label="Sponsored services" className={className}>
    <div className="mb-3 flex items-center justify-between gap-3">
      <div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#9A7A43]">Featured partners</p><h2 className="mt-1 text-lg font-extrabold text-[#292824] sm:text-xl">Sponsored services</h2></div>
      <span className="rounded-full border border-[#E9E5DC] bg-white px-3 py-1 text-[10px] font-semibold text-[#77736B]">Sponsored</span>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {visibleRows.map(row => {
        const campaign = row.campaign!;
        const target = getDestination(row);
        const content = <>
          {campaign.creative_image_url ? <img src={campaign.creative_image_url} alt="" loading="lazy" className="h-36 w-full object-cover sm:h-40" /> : <div className="flex h-36 items-center justify-center bg-gradient-to-br from-[#f8f3e9] to-[#e8dfce] px-5 text-center sm:h-40"><span className="text-xl font-black text-[#292824]">{campaign.title}</span></div>}
          <div className="p-4"><span className="inline-flex rounded-full bg-[#F7F1E6] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#8A6B35]">{row.display_label || 'Sponsored'}</span>
            <h3 className="mt-2 text-sm font-extrabold text-[#292824]">{campaign.title}</h3>
            {campaign.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#77736B]">{campaign.description}</p>}
            <span className="mt-3 inline-flex items-center text-xs font-bold text-[#8A6B35]">Explore offer <span aria-hidden="true" className="ml-1">→</span></span>
          </div>
        </>;
        return target.external
          ? <a key={row.id} data-sponsored-placement={row.id} href={target.href} target="_blank" rel="noopener noreferrer sponsored" onClick={() => void track(row, 'click')} className="overflow-hidden rounded-xl border border-[#E9E5DC] bg-white transition hover:-translate-y-0.5 hover:border-[#D5B779] hover:shadow-md">{content}</a>
          : <Link key={row.id} data-sponsored-placement={row.id} to={target.href} onClick={() => void track(row, 'click')} className="overflow-hidden rounded-xl border border-[#E9E5DC] bg-white transition hover:-translate-y-0.5 hover:border-[#D5B779] hover:shadow-md">{content}</Link>;
      })}
    </div>
  </section>;
}
