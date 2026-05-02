/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
  	fontFamily: {
  		sans: ['Lato', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  		serif: ['Lato', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  		mono: ['Lato', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
  	},
  	extend: {
  		fontFamily: {
  			lato: ['Lato', 'ui-sans-serif', 'system-ui', 'sans-serif'],
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
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			motivationFlash: {
  				'0%, 100%': { opacity: '1', filter: 'brightness(1)' },
  				'50%': { opacity: '0.82', filter: 'brightness(1.12)' },
  			},
  			'iris-flower-sway': {
  				'0%, 100%': { transform: 'rotate(-2.5deg) scale(0.96)' },
  				'50%': { transform: 'rotate(2.5deg) scale(1.05)' },
  			},
  			'iris-petal-furl': {
  				'0%, 100%': { transform: 'scaleY(0.36) scaleX(0.88)', opacity: '0.9' },
  				'28%': { transform: 'scaleY(0.82) scaleX(0.96)', opacity: '0.98' },
  				'48%': { transform: 'scaleY(1.08) scaleX(1.02)', opacity: '1' },
  				'62%': { transform: 'scaleY(0.94) scaleX(1)', opacity: '1' },
  				'78%': { transform: 'scaleY(1.02) scaleX(1)', opacity: '1' },
  			},
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'motivation-flash': 'motivationFlash 2.4s ease-in-out infinite',
  			'iris-flower-sway': 'iris-flower-sway 5.5s ease-in-out infinite',
  			'iris-petal-furl': 'iris-petal-furl 4.8s ease-in-out infinite',
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};