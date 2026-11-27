import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from './api';
import { toApiConfig } from './size';
import { useDebounced } from './hooks';

/** Live price from the server's pricing engine (debounced; keeps the previous number on screen while fetching). */
export function useQuote(slug, cfg, qty, enabled = true) {
  const d = useDebounced(JSON.stringify({ cfg, qty }), 250);
  const ok = enabled && slug && cfg && cfg.material && (cfg.sizeKey || (cfg.widthMm && cfg.heightMm)) && Number(qty) > 0;
  return useQuery({
    queryKey: ['quote', slug, d],
    enabled: !!ok,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 60_000,
    queryFn: () => { const { cfg: c, qty: q } = JSON.parse(d); return api.post('/api/pricing/quote', { product: slug, config: toApiConfig(c), quantity: Number(q) }); },
  });
}
