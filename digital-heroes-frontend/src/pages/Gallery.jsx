import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { PageBand } from '../components/layout/Layouts';
import { EmptyState, ErrorBox, Skeleton, Tilt, cx } from '../components/ui';
import { api } from '../lib/api';
import { usePageTitle } from '../lib/hooks';

export default function Gallery() {
  usePageTitle('Work gallery');
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['gallery'], queryFn: () => api.get('/api/gallery') });
  const [tab, setTab] = useState('all');
  const groups = data || [];
  const items = groups.filter((g) => tab === 'all' || g.division.slug === tab).flatMap((g) => g.items.map((i) => ({ ...i, div: g.division })));
  return (
    <>
      <PageBand><span className="kicker">Live work</span><h1 className="mt-3 text-4xl font-bold sm:text-6xl">Real jobs, <span className="serif-i">real print.</span></h1><p className="mt-4 max-w-xl text-paper/65">A look at recent work, organised by product family.</p></PageBand>
      <div className="container-x py-10">
        <div className="no-scrollbar -mx-1 mb-8 flex gap-2 overflow-x-auto px-1 pb-1">
          {[{ slug: 'all', name: 'All work' }, ...groups.map((g) => g.division)].map((d) => <button key={d.slug} onClick={() => setTab(d.slug)} className={cx('chip whitespace-nowrap', tab === d.slug && 'chip-on')}>{d.name}</button>)}
        </div>
        {error && <ErrorBox error={error} retry={refetch} />}
        {!isLoading && !items.length && <EmptyState title="Nothing here yet" text="Gallery items added by the team will appear here." />}
        <motion.div layout className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="aspect-[4/3]" />)}
          <AnimatePresence mode="popLayout">
            {items.map((g) => (
              <motion.div layout key={g._id} initial={{ opacity: 0, rotateX: 18, y: 30 }} animate={{ opacity: 1, rotateX: 0, y: 0 }} exit={{ opacity: 0, scale: .9 }} style={{ transformPerspective: 900 }}>
                <Tilt max={7} className="rounded-2xl"><figure className="card overflow-hidden"><div className="aspect-[4/3] overflow-hidden bg-paper-200"><img src={g.imageUrl} alt={g.title} loading="lazy" className="h-full w-full object-cover transition duration-700 hover:scale-105" onError={(e) => { e.currentTarget.style.opacity = 0; }} /></div>
                  <figcaption className="p-4"><div className="label !mb-1">{g.div.name}</div><div className="font-display font-semibold">{g.title}</div><div className="text-xs text-ink-500">{g.caption}</div></figcaption></figure></Tilt>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </>
  );
}
