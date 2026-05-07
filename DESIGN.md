# NEP Biodiversity and Research Department — Design System

## Personality
Warm, nature-inspired, and data-forward. The UI feels like a living field notebook — organic textures meet scientific precision. Designed to impress conservation professionals and park managers equally.

## Colors
- --meadow-green: #0C6038 (primary — buttons, active states, key headings)
- --outerspace: #2D4C39 (dark panels, footer, header band)
- --peach: #F1D2A1 (warm card fills, secondary backgrounds)
- --golden: #F5A623 (ComforterBrush titles, highlight numbers, accent)
- --bg-main: #F7F5EF (app background — warm off-white, never pure white)
- --crimson: #6C2728 (danger, EN/CR IUCN badges, fail states)
- --mustard-green: #808847 (secondary accents, tags)
- --surface: #FFFFFF (card backgrounds)
- --text-primary: #1A2E1F (near-black with green tint for body text)
- --text-secondary: #4A5E4F (muted text, labels, captions)
- --border: #E0E8E2 (card borders, dividers)

## IUCN Badge Colors
- LC: #1A7D2E (green)
- NT: #CCCC00 (yellow-green)
- VU: #F0A500 (amber)
- EN: #E8551A (orange-red)
- CR: #D4251C (red)
- NE: #9E9E9E (grey)
- DD: #607D8B (blue-grey)
- EW: #4A148C (deep purple)

## Typography
- Headings: Poppins Bold (700) — section titles, card labels, nav links
- Display numbers (dramatic): Poppins Black (900) — total species 870, key KPI numbers
- Display numbers (calm): Poppins SemiBold (600) — taxa counts, chart labels
- Body: Poppins Regular (400) — descriptions, paragraphs, tooltips
- Script accent: ComforterBrush Regular — page title "Biodiversity and Research Department" only
- Font sizes: Display 72px, H1 48px, H2 32px, H3 24px, H4 18px, Body 16px, Small 14px, Caption 12px

## Spacing
- Base unit: 8px
- Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96
- Card padding: 24px
- Section gap: 48px desktop, 32px mobile
- Nav height: 68px

## Border Radius
- Cards: 16px (warm, rounded)
- Buttons: 9999px (full pill shape)
- Badges/chips: 9999px
- Input fields: 12px
- Chart containers: 16px
- Modal: 20px

## Elevation (Shadows)
- Card default: 0 2px 8px rgba(0,0,0,0.06)
- Card hover: 0 8px 24px rgba(12,96,56,0.12) — green-tinted lift
- Nav: 0 2px 12px rgba(0,0,0,0.08)
- Modal: 0 24px 48px rgba(0,0,0,0.16)
- Button hover: 0 4px 12px rgba(12,96,56,0.25)

## Navigation Bar
- Background: #FFFFFF
- Height: 68px
- Border bottom: 1px solid #E0E8E2
- Logo: nep-logo.png, height 60px
- Brand text next to logo: "Biodiversity and Research Department", Poppins 600, 15px, color #0C6038
- Nav links: Poppins 500, 15px, color #4A5E4F, hover color #0C6038
- Active link: color #0C6038, border-bottom 2px solid #0C6038
- Auto-hides after 3 seconds idle, returns when mouse moves to top 100px
- Smooth slide transition: 0.3s ease

## Buttons
- Primary: bg #0C6038, text white, pill shape, padding 12px 28px, hover bg #0A5230, shadow on hover
- Secondary: bg transparent, border 2px #0C6038, text #0C6038, pill shape, hover bg #F0F7F3
- Danger: bg #6C2728, text white, pill shape
- Disabled: 40% opacity
- All transitions: 0.2s ease

## Cards
- Background: #FFFFFF
- Border: 1px solid #E0E8E2
- Border radius: 16px
- Padding: 24px
- Shadow: 0 2px 8px rgba(0,0,0,0.06)
- Hover: translateY(-2px), shadow 0 8px 24px rgba(12,96,56,0.12)
- Transition: 0.2s ease all

## Number Display Rules
- DRAMATIC (870 total, key KPIs): Poppins Black 900, 64-72px, color #0C6038
- CALM (taxa counts, chart values): Poppins SemiBold 600, 32-40px, color #1A2E1F
- Growth badges (▲ +202%): Poppins Bold, 13px, bg #E8F5EE, color #0C6038, pill shape

## Charts (Recharts)
- All charts have hover tooltips showing exact values
- Tooltip style: bg #1A2E1F, text white, border-radius 8px, padding 8px 12px, Poppins 13px
- Grid lines: #E0E8E2, dashed
- Axis labels: Poppins 12px, color #4A5E4F
- Animation: 800ms ease on load
- Primary chart color: #0C6038
- Secondary chart color: #F1D2A1
- Accent: #F5A623

## Page-Specific Rules

### Home (Biodiversity Stats)
- Header band: bg #2D4C39, ComforterBrush golden title centered
- Total species hero: Poppins Black 900, 96px, color #0C6038, centered
- Taxa cards: 3-column grid desktop, 2-column tablet, 1-column mobile
- Charts: 2-column grid, full width on mobile

### Species Explorer
- Search bar: full width, rounded 12px, border #E0E8E2, focus border #0C6038
- Filter chips: pill shape, border #E0E8E2, selected bg #0C6038 text white
- Species cards: image top (160px height, object-cover), content below, IUCN badge top-right
- Grid: 3 columns desktop, 2 tablet, 1 mobile

### Map Page
- Full viewport height
- Layer toggle panel: floating left, white bg, rounded 16px, shadow
- Location popups: white card, shadow, rounded 12px, close button

### Schools & Visitors
- Stats row at top: 3 large number cards
- Map below with school pins
- Visit log table at bottom

### About
- Centered layout, max-width 680px
- Profile photo: circular, 120px
- Contact cards: pill-shaped links

## Do's
- Always use bg-main (#F7F5EF) not pure white for page backgrounds
- Use ComforterBrush ONLY for the main page title
- Always add hover transitions on interactive elements
- Use green-tinted shadows on hover states
- Keep data readable — never sacrifice legibility for style
- Mobile responsive always

## Don'ts
- Never use pure black (#000000) for text — use #1A2E1F
- Never use more than 2 font families on one page
- Never use the IUCN colors outside of IUCN badge contexts
- Never place text on busy backgrounds without overlay
- Never skip loading states on data-fetched content
