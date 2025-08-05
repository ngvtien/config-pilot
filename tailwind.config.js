/** @type {import('tailwindcss').Config} */
export default {
	darkMode: ["class"],
	content: [
		"./index.html",
		"./src/**/*.{js,ts,jsx,tsx}",
	],
	theme: {
		extend: {
			fontFamily: {
				sans: [
					'Segoe UI',
					'-apple-system',
					'BlinkMacSystemFont',
					'system-ui',
					'sans-serif'
				],
				mono: [
					'Cascadia Code',
					'Fira Code',
					'JetBrains Mono',
					'SF Mono',
					'Monaco',
					'Cascadia Mono',
					'Roboto Mono',
					'Consolas',
					'Courier New',
					'monospace'
				],
			},
			fontSize: {
				'xs': ['0.75rem', { lineHeight: '1rem', letterSpacing: '-0.01em' }],
				'sm': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '-0.01em' }],
				'base': ['1rem', { lineHeight: '1.5rem', letterSpacing: '-0.01em' }],
				'lg': ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.015em' }],
				'xl': ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.02em' }],
				'2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.025em' }],
			},
			fontFeatureSettings: {
				'liga': '"liga" 1',
				'calt': '"calt" 1',
				'kern': '"kern" 1',
				'ss01': '"ss01" 1',
				'ss02': '"ss02" 1',
				'liga-calt': '"liga" 1, "calt" 1, "kern" 1',
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			colors: {
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				chart: {
					'1': 'hsl(var(--chart-1))',
					'2': 'hsl(var(--chart-2))',
					'3': 'hsl(var(--chart-3))',
					'4': 'hsl(var(--chart-4))',
					'5': 'hsl(var(--chart-5))'
				}
			},
			keyframes: {
				'loading-bar': {
					'0%': { transform: 'translateX(-100%)' },
					'100%': { transform: 'translateX(100%)' }
				}
			},
			animation: {
				'loading-bar': 'loading-bar 1.5s infinite'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
}