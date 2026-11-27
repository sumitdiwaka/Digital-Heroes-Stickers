/** Boutique-industrial palette: ink + warm paper, sage for "approved/ok", copper for every call to action. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#07080D', 900: '#0B0C14', 800: '#12141F', 700: '#1B1E2C', 600: '#2A2E40', 500: '#454A60' },
        paper: { DEFAULT: '#F4EFE6', 100: '#FBF8F2', 200: '#EBE4D6', 300: '#DDD4C3', 400: '#C4B9A3' },
        sage: { 50: '#EAF1EB', 100: '#D3E3D6', 300: '#9CC3A6', 400: '#6EA37D', 500: '#4F8A62', 600: '#3B6E4E', 700: '#2F5D44', 900: '#173A2B' },
        copper: { 50: '#FBF1E3', 100: '#F3DDBE', 300: '#E2A85F', 400: '#D58F3C', 500: '#C77D2E', 600: '#A8651F', 700: '#864E17' },
        signal: { red: '#C8432F', amber: '#D9962B', blue: '#3A6EA5' },
      },
      fontFamily: {
        display: ['"Space Grotesk Variable"', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['"Inter Variable"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        lift: '0 1px 0 rgba(255,255,255,.6) inset, 0 18px 40px -18px rgba(11,12,20,.35), 0 6px 14px -8px rgba(11,12,20,.25)',
        press: '0 6px 0 0 #864E17, 0 14px 22px -8px rgba(134,78,23,.55)',
        'press-down': '0 1px 0 0 #864E17, 0 4px 8px -4px rgba(134,78,23,.5)',
        glow: '0 0 0 1px rgba(199,125,46,.4), 0 20px 60px -20px rgba(199,125,46,.55)',
      },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        floaty: { '0%,100%': { transform: 'translate3d(0,0,0) rotateZ(var(--r,0deg))' }, '50%': { transform: 'translate3d(0,-14px,24px) rotateZ(var(--r,0deg))' } },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
      },
      animation: { marquee: 'marquee 40s linear infinite', floaty: 'floaty 7s ease-in-out infinite', shimmer: 'shimmer 1.8s linear infinite' },
    },
  },
  plugins: [],
};
