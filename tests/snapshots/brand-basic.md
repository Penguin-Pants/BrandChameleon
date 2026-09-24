---
version: alpha
name: "Acme Corp"
description: "Design tokens extracted from http://127.0.0.1:4173/tests/fixtures/pages/brand-basic.html on 2026-09-23 by BrandChameleon 0.1.0."
colors:
  primary: "#635BFF"
  secondary: "#00D4FF"
  neutral: "#E3E8EE"
  surface: "#FFFFFF"
  on-surface: "#1A1F36"
  on-primary: "#FFFFFF"
typography:
  headline-lg:
    fontFamily: "Inter"
    fontSize: "48px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline-md:
    fontFamily: "Inter"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.25
  headline-sm:
    fontFamily: "Inter"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.33
  body-md:
    fontFamily: "Inter"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Inter"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
  label-md:
    fontFamily: "Inter"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.33
rounded:
  sm: "4px"
  md: "8px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  page:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    height: "44px"
  button-secondary:
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    height: "46px"
  link:
    textColor: "{colors.primary}"
  nav:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
---

# Acme Corp

## Overview

Design tokens for Acme Corp, measured from the computed styles of http://127.0.0.1:4173/tests/fixtures/pages/brand-basic.html on 2026-09-23 by BrandChameleon 0.1.0. The page rendered in light mode. Brand personality is not inferred from CSS.

## Colors

- **Primary (#635BFF):** Background of 3 buttons, border of 1 button, text of 6 links and text of 1 button. Declared as `--brand-primary`.
- **Secondary (#00D4FF):** 8 other uses. Declared as `--brand-accent`.
- **Neutral (#E3E8EE):** 5 other uses. Declared as `--line`.
- **Surface (#FFFFFF):** Background of 2 large areas, background of 1 navigation area, text of 3 buttons and 1 other use.
- **On-surface (#1A1F36):** Text of 5 links, text of 6 headings and 9 other uses. Declared as `--ink`.
- **On-primary (#FFFFFF):** Background of 2 large areas, background of 1 navigation area, text of 3 buttons and 1 other use.

## Typography

- **headline-lg:** Inter, 48px, weight 700, from 1 `h1` element. Full stack: Inter, sans-serif.
- **headline-md:** Inter, 32px, weight 600, from 2 `h2` elements. Full stack: Inter, sans-serif.
- **headline-sm:** Inter, 24px, weight 600, from 3 `h3` elements. Full stack: Inter, sans-serif.
- **body-md:** Inter, 16px, weight 400, from 5 `p` elements. Full stack: Inter, sans-serif.
- **body-sm:** Inter, 14px, weight 400, from 3 `p` elements. Full stack: Inter, sans-serif.
- **label-md:** Inter, 15px, weight 600, from 2 `a` and 1 `button` elements. Full stack: Inter, sans-serif.

## Layout

Spacing values are the most common paddings and gaps on buttons, inputs, navigation links, cards and flex or grid containers:

- **xs:** 8px, used 14 times.
- **sm:** 12px, used 16 times.
- **md:** 16px, used 8 times.
- **lg:** 24px, used 22 times.
- **xl:** 32px, used 4 times.

## Elevation & Depth

- `rgba(0, 0, 0, 0.08) 0px 2px 4px 0px` on 3 cards.

## Shapes

- **sm (4px):** 1 input.
- **md (8px):** 4 buttons and 3 cards.
- **full (9999px):** 1 image.

## Components

- **page:** background surface (#FFFFFF), text on-surface (#1A1F36), typography body-md.
- **button-primary:** background primary (#635BFF), text on-primary (#FFFFFF), corners rounded.md (8px), 12px vertical and 24px horizontal padding, height 44px, typography label-md.
- **button-secondary:** transparent background, text primary (#635BFF), corners rounded.md (8px), 12px vertical and 24px horizontal padding, 1px solid #635BFF border, height 46px, typography label-md.
- **link:** text primary (#635BFF).
- **nav:** background surface (#FFFFFF), text on-surface (#1A1F36).

## Do's and Don'ts

- Do use primary (#635BFF) for primary button backgrounds.
- Do pair on-primary text with primary backgrounds (4.70:1, passes WCAG AA).
- Do pair on-surface text with surface backgrounds (16.24:1, passes WCAG AA).
- Do set headlines in Inter and body text in Inter.
- Do use rounded.md (8px) corners on buttons.

## Brand Assets

- **Logo:** http://127.0.0.1:4173/tests/fixtures/pages/assets/logo.svg (Header logo, 120 x 32 px)
