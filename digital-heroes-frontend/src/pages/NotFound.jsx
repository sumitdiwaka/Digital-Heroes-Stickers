import { Link } from 'react-router-dom';
import { Button } from '../components/ui';
import { usePageTitle } from '../lib/hooks';
export default function NotFound() {
  usePageTitle('Not found');
  return (
    <div className="container-x grid min-h-[70vh] place-items-center py-20 text-center">
      <div><div className="font-display text-[9rem] font-bold leading-none text-ink-900/10 sm:text-[14rem]">404</div>
        <h1 className="-mt-8 text-3xl font-bold sm:-mt-14 sm:text-5xl">Misprint. <span className="serif-i">Page not found.</span></h1>
        <p className="mx-auto mt-4 max-w-md text-ink-500">The page you are looking for was trimmed off the sheet.</p>
        <div className="mt-8 flex justify-center gap-3"><Button as={Link} to="/">Back home</Button><Button as={Link} to="/products" variant="light">Browse products</Button></div></div>
    </div>
  );
}
