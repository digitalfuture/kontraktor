---
version: alpha
name: Kontraktor
description: Warm construction marketplace — Indonesian craftsmanship meets modern warmth.
colors:
  primary: "#1A1C1E"
  secondary: "#EA580C"
  tertiary: "#FDBA74"
  neutral: "#F9FAFB"
  surface: "#FFFFFF"
  surface-dark: "#1F2937"
  text-primary: "#111827"
  text-secondary: "#6B7280"
  accent-light: "#FFF7ED"
  success: "#10B981"
  warning: "#F59E0B"
typography:
  h1:
    fontFamily: Inter
    fontSize: 3rem
    fontWeight: 700
    lineHeight: 1.1
  h2:
    fontFamily: Inter
    fontSize: 2rem
    fontWeight: 700
    lineHeight: 1.2
  h3:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.3
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    lineHeight: 1.5
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
elevation:
  card: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)"
  card-hover: "0 10px 25px rgba(0,0,0,0.1), 0 4px 10px rgba(0,0,0,0.06)"
  button: "0 4px 14px rgba(234,88,12,0.25)"
components:
  button-primary:
    backgroundColor: "{colors.secondary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: 12px 32px
    typography:
      fontFamily: Inter
      fontWeight: 600
      fontSize: 1.125rem
  button-primary-hover:
    backgroundColor: "#C2410C"
    textColor: "#FFFFFF"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    border: "2px solid {colors.secondary}"
    rounded: "{rounded.md}"
    padding: 12px 32px
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: 24px
    shadow: "{elevation.card}"
  card-hover:
    shadow: "{elevation.card-hover}"
  icon-wrapper:
    backgroundColor: "{colors.accent-light}"
    rounded: "{rounded.md}"
    size: 48px
  badge:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: 2px 8px
    typography:
      fontSize: 0.75rem
      fontWeight: 600
---

## Overview

Kontraktor is an Indonesian construction marketplace connecting clients with verified contractors. The visual identity balances **warmth and trust** — the orange family anchors the brand, with soft neutral backgrounds and clean typography. Cards use subtle shadows that lift on hover. The dark mode inverts surfaces while keeping the orange accent.

## Colors

- **Primary (#1A1C1E):** Deep ink for headlines and body text.
- **Secondary (#EA580C):** Warm orange — CTAs, accents, active states.
- **Tertiary (#FDBA74):** Light orange — badges, subtle highlights.
- **Neutral (#F9FAFB):** Page background.
- **Accent-light (#FFF7ED):** Icon wrappers, hover states.

## Typography

Inter at 400/500/600/700 weights. Tight tracking on headings, generous line-height on body. All caps for labels and badges.

## Components

### Service Cards
- White surface, rounded-xl (16px), p-6, subtle border
- Icon in 48px orange-tinted square (rounded-lg)
- Title + description stacked, bottom row auto-pushed to card bottom
- Hover: lift shadow + slight scale

### Review Cards
- White surface, rounded-xl, p-6
- Flex column with stars → quote → author (mt-auto)
- Equal height across grid

### Buttons
- Primary: orange-600 fill, white text, rounded-lg, shadow on orange
- Secondary: white fill, orange-600 border, orange text

## Do's and Don'ts

- DO use orange as the single accent color — no secondary accent pollutes the palette
- DO use soft shadows on cards (not hard borders) for depth
- DON'T use orange for body text — reserve for interactive elements only
- DO keep icon backgrounds light orange-tinted (#FFF7ED) not pure white
- DO push bottom metadata to card bottom with flex-grow/mt-auto
