/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          500: '#16A34A', // Mid green accent & active states
          600: '#166534', // Deep forest green
          700: '#14532D', // Deep forest green dark
          800: '#14532D',
          900: '#0F391E',
          surface: '#F6F8F6', // Light green-tinted neutral background
        },
        severity: {
          high: '#DC2626',
          'high-bg': '#FEF2F2',
          'high-border': '#FECACA',
          medium: '#D97706',
          'medium-bg': '#FFFBEB',
          'medium-border': '#FDE68A',
          low: '#4B5563',
          'low-bg': '#F3F4F6',
          'low-border': '#E5E7EB',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
}
