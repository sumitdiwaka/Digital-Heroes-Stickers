import { useQuery } from '@tanstack/react-query';
import { PageBand } from '../components/layout/Layouts';
import { DivisionHub, ProductCard } from '../components/CatalogueParts';
import { ErrorBox, Reveal, SectionTitle, Skeleton } from '../components/ui';
import { api } from '../lib/api';
import { usePageTitle } from '../lib/hooks';

export default function Catalogue() {
  usePageTitle('Products');
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['products'], queryFn: () => api.get('/api/products') });
  return (
    <>
      <PageBand><span className="kicker">Product hub</span><h1 className="mt-3 text-4xl font-bold sm:text-6xl">What are we <span className="serif-i">printing</span> today?</h1><p className="mt-4 max-w-xl text-paper/65">Six divisions, equal weight. Pick a range, or jump straight to a product.</p></PageBand>
      <div className="container-x py-12 sm:py-16">
        <DivisionHub />
        <Reveal className="mt-20"><SectionTitle kicker="All products" title="Every product," accent="fully configurable." /></Reveal>
        <div className="mt-8">{error && <ErrorBox error={error} retry={refetch} />}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-60" />)}{data?.map((p) => <Reveal key={p._id}><ProductCard p={p} /></Reveal>)}</div></div>
      </div>
    </>
  );
}
