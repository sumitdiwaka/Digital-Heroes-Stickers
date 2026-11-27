import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { PageBand } from '../components/layout/Layouts';
import { ProductCard } from '../components/CatalogueParts';
import { EmptyState, ErrorBox, Reveal, Skeleton } from '../components/ui';
import { api } from '../lib/api';
import { metaFor } from '../lib/meta';
import { usePageTitle } from '../lib/hooks';

export default function Division() {
  const { slug } = useParams();
  const { data: divs } = useQuery({ queryKey: ['divisions'], queryFn: () => api.get('/api/divisions') });
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['products', slug], queryFn: () => api.get('/api/products', { division: slug }) });
  const div = divs?.find((d) => d.slug === slug);
  usePageTitle(div?.name);
  const m = metaFor(slug); const Icon = m.icon;
  return (
    <>
      <PageBand>
        <Link to="/products" className="inline-flex items-center gap-2 text-sm text-paper/60 hover:text-copper-300"><ArrowLeft size={15} />All products</Link>
        <div className="mt-5 flex items-center gap-5"><span className="grid h-16 w-16 place-items-center rounded-2xl text-white shadow-xl" style={{ background: m.color }}><Icon size={30} /></span>
          <div><span className="kicker">Division {m.no}</span><h1 className="mt-1 text-4xl font-bold sm:text-6xl">{div?.name || slug}</h1></div></div>
        {div?.description && <p className="mt-5 max-w-xl text-paper/65">{div.description}</p>}
      </PageBand>
      <div className="container-x py-12">
        {error && <ErrorBox error={error} retry={refetch} />}
        {!isLoading && data?.length === 0 && <EmptyState title="No products here yet" text="This range is being set up. Check back soon." />}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-60" />)}{data?.map((p) => <Reveal key={p._id}><ProductCard p={p} /></Reveal>)}</div>
      </div>
    </>
  );
}
