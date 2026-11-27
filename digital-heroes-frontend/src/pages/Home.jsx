import { Link } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Layers, FileSpreadsheet, Printer, ShieldCheck, Palette, Calculator, CheckCircle2, Repeat } from 'lucide-react';
import { Button, Reveal, SectionTitle, Tilt } from '../components/ui';
import { DivisionHub, PriceCalculator } from '../components/CatalogueParts';
import { api } from '../lib/api';
import { usePageTitle } from '../lib/hooks';
import { HeroFallback } from '../components/3d/Hero3D';

const Hero3D = lazy(() => import('../components/3d/Hero3D'));
const DIVS = ['Labels & Stickers', 'Race & Event Numbers', 'MTB Boards', 'Stamps', 'Trophies', 'Laser-Cut Work'];

function Hero() {
  return (
    <section className="on-dark relative -mt-[var(--nav-h)] overflow-hidden bg-ink-900 text-paper">
      <div className="grid-lines absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute -left-40 top-1/3 h-[480px] w-[480px] rounded-full bg-copper-500/20 blur-[120px]" aria-hidden />
      <div className="pointer-events-none absolute -right-32 -top-20 h-[420px] w-[420px] rounded-full bg-sage-500/20 blur-[120px]" aria-hidden />
      <div className="container-x relative grid min-h-[100svh] items-center gap-6 pb-24 pt-[calc(var(--nav-h)+1.5rem)] lg:grid-cols-[1.02fr_1fr]">
        <div className="relative z-10">
          <Reveal y={20}><span className="kicker">Web-to-print platform · 2026</span></Reveal>
          <Reveal delay={.08}><h1 className="mt-5 text-[2.6rem] font-bold leading-[.98] sm:text-6xl lg:text-7xl">Design it.<br />Proof it.<br /><span className="serif-i">Print it</span> properly.</h1></Reveal>
          <Reveal delay={.16}><p className="mt-6 max-w-xl text-base leading-relaxed text-paper/70 sm:text-lg">Labels, race numbers, MTB boards, stamps, trophies and laser-cut work. Get an instant price, design in your browser, approve a proof - and we turn it into production-ready files.</p></Reveal>
          <Reveal delay={.24} className="mt-8 flex flex-wrap items-center gap-4">
            <Button as={Link} to="/products" size="lg">Start an order <ArrowRight size={18} /></Button>
            <Button as={Link} to="/#pricing" variant="ghost" size="lg" className="!text-paper"><Calculator size={18} />Try the calculator</Button>
          </Reveal>
          <Reveal delay={.32}>
            <ul className="mt-9 grid max-w-xl grid-cols-2 gap-x-6 gap-y-3 text-sm text-paper/70 sm:grid-cols-4">
              {['Instant pricing', 'Proof approval', 'CSV bulk merge', 'Bleed-ready files'].map((t) => <li key={t} className="flex items-center gap-2"><CheckCircle2 size={15} className="shrink-0 text-sage-400" />{t}</li>)}
            </ul>
          </Reveal>
        </div>
        <div className="relative h-[340px] sm:h-[460px] lg:h-[640px]">
          <Suspense fallback={<HeroFallback />}><Hero3D className="absolute inset-0" /></Suspense>
          <div className="pointer-events-none absolute bottom-2 left-2 hidden rounded-lg border border-white/10 bg-ink-900/70 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-paper/60 backdrop-blur sm:block">Ø 100 × 50 mm · 300 DPI · 3 mm bleed</div>
          <div className="pointer-events-none absolute right-2 top-2 hidden rounded-lg border border-white/10 bg-ink-900/70 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-sage-300 backdrop-blur sm:block">● Proof v2 approved</div>
        </div>
      </div>
      <div className="relative overflow-hidden border-y border-white/10 bg-ink-950/60 py-3.5" aria-hidden>
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-mono text-xs uppercase tracking-[.25em] text-paper/50">
          {[...DIVS, ...DIVS, ...DIVS, ...DIVS].map((d, i) => <span key={i} className="flex items-center gap-10">{d}<i className="h-1.5 w-1.5 rounded-full bg-copper-500" /></span>)}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { icon: Calculator, t: 'Configure', d: 'Pick size, material and quantity. The price updates instantly, with volume discounts applied automatically.' },
  { icon: Palette, t: 'Design', d: 'Edit in your browser inside the printable area - or upload finished PDF, SVG, AI or PNG artwork.' },
  { icon: ShieldCheck, t: 'Approve the proof', d: 'Review versioned proofs, request changes, and approve. Nothing goes to press until you say so.' },
  { icon: Repeat, t: 'Print & reorder', d: 'We produce from the approved files. Next time, reorder in one click from your saved artwork.' },
];

export default function Home() {
  usePageTitle();
  const { data: gallery } = useQuery({ queryKey: ['gallery'], queryFn: () => api.get('/api/gallery') });
  const items = (gallery || []).flatMap((g) => g.items.map((i) => ({ ...i, div: g.division.name }))).slice(0, 10);
  return (
    <>
      <Hero />
      <section className="section" id="divisions">
        <div className="container-x">
          <Reveal><SectionTitle kicker="Product hub" title="Six divisions," accent="one platform." text="Every range is built from flexible parameters - so you pick exact sizes and materials instead of scrolling a thousand near-identical products." /></Reveal>
          <div className="mt-12"><DivisionHub /></div>
        </div>
      </section>

      <section className="section grid-lines-light border-y border-paper-300 bg-paper-200/40" id="pricing">
        <div className="container-x">
          <Reveal><SectionTitle kicker="No quote forms" title="Know the price" accent="before you ask." text="Choose a product, tweak the options and watch the total move. VAT-inclusive, no surprises at checkout." /></Reveal>
          <Reveal className="mt-10" delay={.1}><PriceCalculator /></Reveal>
        </div>
      </section>

      <section className="section" id="how">
        <div className="container-x">
          <Reveal><SectionTitle kicker="How it works" title="From idea to press," accent="in four steps." /></Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5">
            {STEPS.map((s, i) => (
              <Reveal key={s.t} delay={i * .09}>
                <Tilt max={8} className="h-full rounded-2xl">
                  <div className="card crop h-full p-6">
                    <div className="flex items-center justify-between"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-900 text-copper-400 z-pop-sm"><s.icon size={22} /></span><span className="font-display text-5xl font-bold text-ink-900/10">0{i + 1}</span></div>
                    <h3 className="mt-5 text-xl font-bold">{s.t}</h3><p className="mt-2 text-sm leading-relaxed text-ink-500">{s.d}</p>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="on-dark relative overflow-hidden bg-ink-900 py-20 text-paper sm:py-28">
        <div className="grid-lines absolute inset-0" aria-hidden />
        <div className="container-x relative">
          <Reveal><SectionTitle kicker="Built for the shop floor" title="Real production," accent="not just uploads." text="The part that separates a print platform from a generic store: turning an approved design into files a press can actually run." /></Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[[ShieldCheck, 'Approval gate', 'Print-ready files stay locked until the customer approves a proof. Every revision is versioned and logged: who approved which version, and when.'], [FileSpreadsheet, 'CSV variable-data merge', 'Upload a spreadsheet and get one artwork per row - race numbers, names, bulk jobs. Long names shrink to fit automatically.'], [Printer, 'Print-ready output', 'High-resolution PDF and PNG with the right bleed and resolution for each product, named and filed per order, generated on our servers.']].map(([Icon, t, d], i) => (
              <Reveal key={t} delay={i * .1}>
                <Tilt max={7} className="h-full rounded-2xl"><div className="card-dark h-full p-7"><span className="z-pop-sm grid h-12 w-12 place-items-center rounded-xl bg-copper-500 text-white shadow-glow"><Icon size={22} /></span><h3 className="mt-6 text-xl font-bold">{t}</h3><p className="mt-3 text-sm leading-relaxed text-paper/65">{d}</p></div></Tilt>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {items.length > 0 && (
        <section className="section overflow-hidden" id="work">
          <div className="container-x"><Reveal className="flex flex-wrap items-end justify-between gap-4"><SectionTitle kicker="Live work" title="Recently off" accent="the press." /><Button as={Link} to="/gallery" variant="light">Full gallery <ArrowRight size={16} /></Button></Reveal></div>
          <div className="no-scrollbar mt-10 flex snap-x gap-5 overflow-x-auto px-4 pb-8 sm:px-6 lg:px-[max(2rem,calc((100vw-80rem)/2+2rem))]">
            {items.map((g) => (
              <Tilt key={g._id} max={6} className="w-[78vw] shrink-0 snap-start rounded-2xl sm:w-[360px]">
                <figure className="card overflow-hidden"><div className="aspect-[4/3] overflow-hidden bg-paper-200"><img src={g.imageUrl} alt={g.title} loading="lazy" className="h-full w-full object-cover transition duration-700 hover:scale-105" onError={(e) => { e.currentTarget.style.display = 'none'; }} /></div><figcaption className="p-4"><div className="label !mb-1">{g.div}</div><div className="font-display font-semibold">{g.title}</div><div className="text-xs text-ink-500">{g.caption}</div></figcaption></figure>
              </Tilt>
            ))}
          </div>
        </section>
      )}

      <section className="container-x pb-20">
        <Reveal>
          <div className="on-dark relative overflow-hidden rounded-[32px] bg-gradient-to-br from-copper-600 via-copper-500 to-copper-400 p-8 text-white sm:p-14">
            <div className="halftone absolute -right-6 -top-6 h-72 w-72 text-white/10" aria-hidden />
            <div className="relative max-w-2xl"><h2 className="text-3xl font-bold sm:text-5xl">Ready when your artwork is.</h2><p className="mt-4 text-white/85">Create a free account to save designs, track proofs and reorder in one click.</p>
              <div className="mt-8 flex flex-wrap gap-4"><Button as={Link} to="/register" variant="dark" size="lg">Create free account</Button><Button as={Link} to="/products" variant="light" size="lg">Browse products</Button></div></div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
