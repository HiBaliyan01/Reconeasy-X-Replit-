import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./client/src/**/*.{ts,tsx,js,jsx}",
    "./server/**/*.{ts,tsx,js,jsx}",
    "./shared/**/*.{ts,tsx,js,jsx}",
  ],
  safelist: [
    "bg-subheader-payments","text-subheader-payments","border-subheader-payments",
    "bg-subheader-returns","text-subheader-returns","border-subheader-returns",
    "bg-subheader-settlements","text-subheader-settlements","border-subheader-settlements",
    "bg-subheader-orders","text-subheader-orders","border-subheader-orders",
    "bg-subheader-projected","text-subheader-projected","border-subheader-projected",
    "bg-subheader-claims","text-subheader-claims","border-subheader-claims",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        accent:  { DEFAULT: "hsl(var(--accent))",  foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        info:    "hsl(var(--info))",
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        card:  { DEFAULT: "hsl(var(--card))",  foreground: "hsl(var(--card-foreground))" },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
        subheader: {
          payments:   "hsl(var(--subheader-payments))",
          returns:    "hsl(var(--subheader-returns))",
          settlements:"hsl(var(--subheader-settlements))",
          orders:     "hsl(var(--subheader-orders))",
          projected:  "hsl(var(--subheader-projected))",
          claims:     "hsl(var(--subheader-claims))",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;