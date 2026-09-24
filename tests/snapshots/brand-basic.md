---
version: alpha
name: "Acme Corp"
description: "Light theme with violet (#635BFF) as the primary color."
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

Light theme with white (#FFFFFF) pages and dark grayish blue (#1A1F36) text. The primary color is violet (#635BFF), with cyan (#00D4FF) as an accent. Headings and body text use Inter. Corners are 4px on inputs, 8px on buttons and fully rounded on images.

## Colors

- **Primary (#635BFF):** Main brand color. Used for button backgrounds, link text, button borders and button text.
- **Secondary (#00D4FF):** Secondary brand color.
- **Neutral (#E3E8EE):** Neutral color.
- **Surface (#FFFFFF):** Page background. Used for large background areas, button text and navigation backgrounds.
- **On-surface (#1A1F36):** Main text color. Used for link text and heading text.
- **On-primary (#FFFFFF):** Text color on primary backgrounds.

## Typography

- **headline-lg:** Inter, 48px, weight 700. Used on `h1` elements. Full stack: Inter, sans-serif.
- **headline-md:** Inter, 32px, weight 600. Used on `h2` elements. Full stack: Inter, sans-serif.
- **headline-sm:** Inter, 24px, weight 600. Used on `h3` elements. Full stack: Inter, sans-serif.
- **body-md:** Inter, 16px, weight 400. Used on `p` elements. Full stack: Inter, sans-serif.
- **body-sm:** Inter, 14px, weight 400. Used on `p` elements. Full stack: Inter, sans-serif.
- **label-md:** Inter, 15px, weight 600. Used on `a` and `button` elements. Full stack: Inter, sans-serif.

## Layout

Spacing scale for padding and gaps in buttons, inputs, navigation links, cards and layouts:

- **xs:** 8px
- **sm:** 12px
- **md:** 16px
- **lg:** 24px
- **xl:** 32px

## Elevation & Depth

- `rgba(0, 0, 0, 0.08) 0px 2px 4px 0px` on cards.

## Shapes

- **sm (4px):** Used on inputs.
- **md (8px):** Used on buttons and cards.
- **full (9999px):** Used on images.

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
