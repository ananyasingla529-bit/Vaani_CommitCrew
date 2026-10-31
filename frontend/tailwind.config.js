/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // User's Exact 5-Color Palette:
        merino: '#F1F1EC',   // Lightest: Canvas / backgrounds / light surfaces
        kangaroo: '#D0C7B3', // Muted sand: Borders / subtle controls / neutral accents
        oyster: '#939474',   // Earthy sage/olive: Secondary accents / live badges / icons
        rifle: '#434428',    // Deep olive green: Primary buttons / active states / brand core
        cedar: '#292728',    // Deepest warm charcoal: Sidebar / deep text / high contrast

        // Semantic bindings for consistent UI
        canvas: {
          DEFAULT: '#F1F1EC', // Merino
          subtle: '#FAF9F6',
          card: '#FFFFFF',
        },
        sidebar: {
          bg: '#292728',      // Cedar
          hover: '#383536',   // Slightly lighter Cedar
          active: '#434428',  // Rifle Green
          border: 'rgba(208, 199, 179, 0.18)', // Kangaroo subtle
          text: '#F1F1EC',    // Merino
          muted: '#D0C7B3',   // Kangaroo
          accent: '#939474',  // Oyster
        },
        border: {
          DEFAULT: '#D0C7B3', // Kangaroo
          subtle: 'rgba(208, 199, 179, 0.5)',
        },
        severity: {
          high: '#B93829',
          'high-bg': '#FDF2F0',
          'high-border': '#F5CAC4',
          medium: '#939474', // Oyster for medium
          'medium-bg': '#F4F5EE',
          'medium-border': '#D8DABF',
          low: '#6B6860',
          'low-bg': '#F1F1EC',
          'low-border': '#D0C7B3',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        xl: '0.75rem',
        lg: '0.5rem',
        md: '0.375rem',
        DEFAULT: '0.375rem',
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgba(41, 39, 40, 0.04)',
        subtle: '0 1px 3px 0 rgba(41, 39, 40, 0.05), 0 1px 2px -1px rgba(41, 39, 40, 0.04)',
        card: '0 1px 3px 0 rgba(41, 39, 40, 0.06), 0 1px 2px -1px rgba(41, 39, 40, 0.05)',
        elevated: '0 10px 25px -3px rgba(41, 39, 40, 0.12), 0 4px 6px -4px rgba(41, 39, 40, 0.08)',
      }
    },
  },
  plugins: [],
}
