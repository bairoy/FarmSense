---
name: Agri-Precision Sunlight System
colors:
  surface: '#f0fdf0'
  surface-dim: '#d0ddd1'
  surface-bright: '#f0fdf0'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eaf7ea'
  surface-container: '#e4f1e4'
  surface-container-high: '#dfecdf'
  surface-container-highest: '#d9e6d9'
  on-surface: '#131e16'
  on-surface-variant: '#414940'
  inverse-surface: '#28332a'
  inverse-on-surface: '#e7f4e7'
  outline: '#71796f'
  outline-variant: '#c0c9bd'
  surface-tint: '#2e6a39'
  primary: '#145224'
  on-primary: '#ffffff'
  primary-container: '#2f6b3a'
  on-primary-container: '#a8e9ac'
  inverse-primary: '#96d69a'
  secondary: '#3f6743'
  on-secondary: '#ffffff'
  secondary-container: '#bdebbd'
  on-secondary-container: '#436c47'
  tertiary: '#004b74'
  on-tertiary: '#ffffff'
  tertiary-container: '#006499'
  on-tertiary-container: '#bbddff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b1f2b4'
  primary-fixed-dim: '#96d69a'
  on-primary-fixed: '#002108'
  on-primary-fixed-variant: '#135224'
  secondary-fixed: '#c0eec0'
  secondary-fixed-dim: '#a5d2a5'
  on-secondary-fixed: '#002108'
  on-secondary-fixed-variant: '#274f2d'
  tertiary-fixed: '#cce5ff'
  tertiary-fixed-dim: '#93ccff'
  on-tertiary-fixed: '#001d31'
  on-tertiary-fixed-variant: '#004b73'
  background: '#f0fdf0'
  on-background: '#131e16'
  surface-variant: '#d9e6d9'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  metric-display:
    fontFamily: Inter
    fontSize: 34px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.03em
  title-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-md-bold:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.375rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The brand personality merges pragmatic field utility with the refined, systemic precision of modern high-performance instrumentation. Crafted for smallholder farmers operating under direct solar glare, the visual tone eliminates decorative noise in favor of radical clarity, optical authority, and high tactile certainty. It projects institutional dependability, respect for agricultural labor, and quiet technological empowerment.

The style unites modern utilitarian minimalism with tactical physical affordances:
- Ultra-crisp surface separations with hairline boundaries to preserve geometry under high ambient lumens.
- Ample negative space combined with concentrated, high-contrast data clusters.
- Immediate touch confidence with oversized, thumb-optimized physical targets designed for single-handed field operation and weathered hands.

## Colors

The palette is engineered specifically for optical stability in high-lux rural outdoor environments, preventing wash-out under harsh sunlight while avoiding ocular fatigue during prolonged screen use.

- **Primary Brand Tier**:
  - Primary Green: `#2F6B3A` (Actions, active tab states, verified statuses).
  - Deep Forest Green: `#1D4524` (High-contrast structural accents, prominent CTA press states).
  - Mint Surface: `#E8F2EA` (Selected states, soft background tints, low-stress callouts).

- **Neutrals & Canvases**:
  - Canvas Surface: `#F7F9F6` (Anti-glare muted daylight background).
  - Card/Modal Surface: `#FFFFFF` (Pure white for critical data isolation and punchy contrast).
  - Hairline Border: `#E2E8E2` (1px structure separator across cards and dividers).
  - Primary Copy: `#17221A` (Deep slate charcoal with green undertone, maintaining 14:1+ contrast on white).
  - Secondary Copy: `#4D5E52` (Descriptive metadata, field notes, supporting metrics).
  - Caption/Tertiary Copy: `#76887B` (Timestamps, units, inactive indicators).

- **Functional Status Tokens**:
  - Operational Positive: Text `#16A34A`, Container `#DCFCE7` (Optimal crop health, synced data).
  - Field Alert/Sync Pending: Text `#D97706`, Container `#FEF3C7` (Sync queue, pending soil moisture read).
  - Field Stress/Danger: Text `#DC2626`, Container `#FEE2E2` (Pest threshold exceeded, irrigation pump dry run).
  - Hydrological Blue: Text `#0284C7`, Container `#E0F2FE` (Canal schedules, soil moisture saturation).

## Typography

Typography prioritizes legibility at arm's length under harsh sunlight:
- **Base Size Guarantee**: Nothing critical renders below `16px`. Subordinate micro-labels (`12px` - `14px`) are restricted exclusively to secondary badges, unit designations, and auxiliary status stamps.
- **Tabular Figures & Metrics**: Numeric readouts for hectare sizing, moisture percentages, and rupee balances use `metric-display` with standard proportional or tabular figures, set at high weight (`700`) to guarantee scan speed.
- **Vertical Rhythm**: Generous line heights prevent text crowding on low-tier, lower-resolution mobile displays commonly deployed in the field.

## Layout & Spacing

The mobile layout operates on a compact 4-column fluid mobile grid anchored by a `16px` (`1rem`) outer screen margin.

- **Thumb Zone Allocation**: High-frequency interactive controls live exclusively within the lower 40% vertical screen zone. Primary cards avoid horizontal edge bleed to preserve crisp structural containment.
- **Touch Perimeter**: Every touchable component enforces a mandatory minimum interactive boundary of `48px × 48px`, even if visual icon glyphs are `20px` or `24px`.
- **Rhythm & Stacking**: Vertical module flow adheres strictly to `space-md` (16px) spacing between sibling cards and `space-xl` (32px) separation between major conceptual domains.

## Elevation & Depth

Direct sunlight eliminates delicate shadow gradients. Visual separation relies on physical layering and high-definition boundary borders rather than ambient blur.

- **Hairline Isolation Architecture**: Surfaces use a 1px solid stroke in `#E2E8E2` around `#FFFFFF` canvas containers. This prevents optical blending between the pure white card and `#F7F9F6` background.
- **Micro-Shadow Structure**:
  - `Surface Level 0` (Screen Background): `#F7F9F6`, no shadow.
  - `Surface Level 1` (Cards, Sheets): `#FFFFFF`, 1px solid `#E2E8E2`, shadow: `0 1px 3px 0 rgba(23, 34, 26, 0.05)`.
  - `Surface Level 2` (Floating Controls, Persistent Navigation Bar): `#FFFFFF`, 1px solid `#E2E8E2`, shadow: `0 4px 12px 0 rgba(23, 34, 26, 0.08)`.
  - `Surface Level 3` (Active Overlays, Modals): `#FFFFFF`, 1px solid `#E2E8E2`, shadow: `0 12px 28px -4px rgba(23, 34, 26, 0.16)`.

## Shapes

The design system enforces `roundedness: 2` across all core containers:
- Standard cards, sheet containers, and list blocks utilize `16px` (`rounded-lg`) corner radii to soften the interface while maintaining clean geometric density.
- Buttons, input fields, and alert banners use `12px` corner rounding for crisp, confident boundary definition.
- Status badges, operational tags, and metric indicators utilize fully rounded pill structures (`9999px`) to immediately convey chip interactivity or state isolation.

## Components

### Buttons
- **Primary Field CTA**: Solid `#2F6B3A` fill, `#FFFFFF` text, `52px` standard height (`48px` absolute minimum), `12px` corner radius. Font: `body-md-bold`. Active state triggers `#1D4524`.
- **Secondary Action**: `#FFFFFF` background with `1.5px` border in `#2F6B3A`, text `#2F6B3A`. Active background shifts to `#E8F2EA`.
- **Destructive Action**: `#FEE2E2` container with `#DC2626` text, transitioning on press to solid `#DC2626` with `#FFFFFF` text.

### Persistent Bottom Navigation Bar
- Two-tab layout strictly partitioned for thumb navigation: **Dashboard** and **Fields**.
- Total height: `64px` + device safe-area inset.
- High-contrast states:
  - Active: `#2F6B3A` filled glyph with `14px` bold text label.
  - Inactive: `#76887B` outline glyph with `14px` regular text label.
  - Surface: `#FFFFFF` with `1px` top border in `#E2E8E2`.

### Status Badges & Pills
- Pill container height: `32px` (`min-height`), horizontal padding `12px`.
- Composed strictly of an icon (`16px`) paired directly with a high-contrast textual label (`label-md`):
  - **Synced**: `#DCFCE7` background, `#16A34A` text and checkmark glyph.
  - **Pending Sync / Offline**: `#FEF3C7` background, `#D97706` text and cloud-refresh glyph.
  - **Moisture Critical**: `#E0F2FE` background, `#0284C7` text and droplet glyph.
  - **Crop Stress**: `#FEE2E2` background, `#DC2626` text and alert triangle glyph.

### Cards & Field Tiles
- Surface: `#FFFFFF`, 1px solid `#E2E8E2`, corner radius `16px`, padding `16px` or `20px`.
- Layout structure: Top slot carries field name/crop type with paired status pill; middle section displays high-contrast `metric-display` values (e.g., "74% Moisture"); bottom area houses secondary metadata (e.g., "Updated 12m ago • Gorakhpur East").

### Inputs & Selector Controls
- Input target height: `52px`. Background `#FFFFFF`, border `1.5px` solid `#E2E8E2`.
- Focus state: `2px` solid `#2F6B3A` with no offset ring.
- Value text: `#17221A` at `16px` minimum to prevent automated browser zoom on mobile.
- Helper labels: Floating or static top labels set in `#4D5E52` at `14px` weight `600`.

### Checkboxes & Segmented Radios
- Size: `24px × 24px` physical target embedded within a parent `48px` tap cell.
- Checkbox active: Solid `#2F6B3A` fill with `#FFFFFF` thick-stroke check icon.
- Unchecked: `#FFFFFF` surface with `2px` solid `#76887B`.