/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ROI数据线颜色
        'roi-day-0': '#1f77b4',
        'roi-day-1': '#ff7f0e',
        'roi-day-3': '#2ca02c',
        'roi-day-7': '#d62728',
        'roi-day-14': '#9467bd',
        'roi-day-30': '#8c564b',
        'roi-day-60': '#e377c2',
        'roi-day-90': '#7f7f7f',
        'breakeven': '#ff0000',
      },
    },
  },
  plugins: [],
}
