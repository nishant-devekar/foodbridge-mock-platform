/*
  The production app's Tailwind theme, so every utility resolves to the same value here.

  Load-bearing, not cosmetic: the product REPLACES Tailwind's breakpoints (xss/xs/…/ipad) and
  overrides several scales — `left-1` is 1rem there, not 0.25rem; `w-200` is 200px; `p-2.5` is
  10px. A stock Tailwind would lay the same class strings out differently.
  Source: foodbridge-module-route-delivery/development/sales-orders/frontend/tailwind.config.js.
*/
tailwind.config = {
  darkMode: 'class',
  theme: {
    screens: {
      xss: '320px', xs: '420px', sm: '640px', md: '768px',
      ipad: { min: '960px', max: '1023px' },
      lg: '1024px', xl: '1280px', '2xl': '1440px',
    },
    extend: {
      colors: { brand: { DEFAULT: 'var(--color-brand)', light: 'var(--color-brand-light)', dark: 'var(--color-brand-dark)' } },
      fontFamily: {
        sans: ['system-ui', 'sans-serif', 'Arial', 'Helvetica'],
        serif: ['system-ui', 'sans-serif', 'Arial', 'Helvetica'],
      },
      boxShadow: { bottom: '0 5px 6px -7px rgba(0, 0, 0, 0.6), 0 2px 4px -5px rgba(0, 0, 0, 0.06)' },
      height: { 28: '100px', sm: '350px', md: '400px', 330: '330px', 440: '440px', lg: '500px', xl: '600px' },
      width: { 80: '80px', 100: '100px', 200: '200px', 300: '300px', 400: '400px' },
      padding: { 2.5: '10px' },
      keyframes: { shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } } },
      animation: { shimmer: 'shimmer 1.4s ease-in-out infinite' },
      inset: {
        '-1': '-1rem', '-2': '-2rem', '-3': '-3rem', '-4': '-4rem', '-5': '-5rem',
        '-6': '-6rem', '-7': '-7rem', '-8': '-8rem', '-9': '-9rem', '-10': '-10rem',
        1: '1rem', 2: '2rem', 3: '3rem', 4: '4rem', 5: '5rem', 6: '6rem', 7: '7rem', 8: '8rem', 9: '9rem', 10: '10rem',
      },
    },
  },
};
