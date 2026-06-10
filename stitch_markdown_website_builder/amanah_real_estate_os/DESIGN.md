---
name: Amanah Real Estate OS
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#44474c'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#74777d'
  outline-variant: '#c4c6cd'
  surface-tint: '#4f6073'
  primary: '#041627'
  on-primary: '#ffffff'
  primary-container: '#1a2b3c'
  on-primary-container: '#8192a7'
  inverse-primary: '#b7c8de'
  secondary: '#735c00'
  on-secondary: '#ffffff'
  secondary-container: '#fed65b'
  on-secondary-container: '#745c00'
  tertiary: '#211200'
  on-tertiary: '#ffffff'
  tertiary-container: '#38260b'
  on-tertiary-container: '#a88c69'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d2e4fb'
  primary-fixed-dim: '#b7c8de'
  on-primary-fixed: '#0b1d2d'
  on-primary-fixed-variant: '#38485a'
  secondary-fixed: '#ffe088'
  secondary-fixed-dim: '#e9c349'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#574500'
  tertiary-fixed: '#feddb5'
  tertiary-fixed-dim: '#e1c29b'
  on-tertiary-fixed: '#281802'
  on-tertiary-fixed-variant: '#584326'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
  status-success: '#10B981'
  status-muted: '#94A3B8'
  data-slate-deep: '#334155'
  data-slate-light: '#E2E8F0'
  sentiment-positive: '#059669'
  sentiment-negative: '#DC2626'
  sentiment-neutral: '#64748B'
typography:
  display-binary:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-uppercase:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-tabular:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-max: 1440px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The design system is built on the pillars of **Trust, Efficiency, and Transparency**. It serves real estate professionals who require data-driven insights without the noise of traditional CRMs. The brand personality is grounded and authoritative, yet highly accessible, avoiding manipulative "dark patterns" in favor of the Zitouni Maliki principles of honesty and public interest.

The visual style is **Corporate / Modern** with a **Minimalist** focus. It prioritizes the "Visibility of System Status" and utilizes high-quality typography and strategic whitespace to reduce decision fatigue. The aesthetic is clean and surgical, ensuring that binary lead scores (1/0) and market sentiment data are the primary focal points. Elements are structured to feel reliable and stable, instilling confidence in both the agent and their clients.

## Colors

The palette is anchored by **Deep Navy (#1A2B3C)**, representing institutional trust and stability. This is used for primary navigation, headings, and high-importance interactive elements. **Accent Gold (#D4AF37)** is used sparingly to denote premium features, "Hot" lead status, or successful conversion milestones, providing a sophisticated contrast without being distracting.

Data surfaces utilize **Slate Grays** to create a layered information hierarchy. The background is a clean, off-white slate (#F8FAFC) to reduce eye strain during long periods of data analysis. Functional colors are strictly mapped to intent:
- **Success/Action (Binary 1):** Emerald green for high-intent leads and completed reports.
- **Muted/Secondary (Binary 0):** Cool grays for cold leads and historical data.
- **Sentiment:** A dedicated trio of colors for social sentiment analysis (Positive, Negative, Neutral).

## Typography

The design system exclusively uses **Inter** to ensure maximum legibility across data-dense dashboards. Inter's tall x-height and neutral character make it ideal for professional SaaS applications where clarity is paramount.

**Key Roles:**
- **Display Binary:** Used for the high-impact "1/0" lead scores. It is bold and slightly tracked-in for a modern, numerical feel.
- **Headings:** Bold weights with tight line-heights to anchor page sections.
- **Body Copy:** Standardized at 16px for readability in property reports and narrative summaries.
- **Labels:** Uppercase styles are used for status indicators (HOT, WARM, COLD) to differentiate them from interactive text.
- **Data Tables:** A slightly smaller, medium-weight font is used for CMA (Comparative Market Analysis) tables to maximize horizontal space.

## Layout & Spacing

This design system employs a **fixed-fluid hybrid grid**. The main dashboard content is contained within a 1440px max-width container, centered on the screen, to maintain readability on ultra-wide monitors. A standard 12-column grid is used for desktop, while mobile collapses to a single-column stack with 16px side margins.

The spacing rhythm is based on an **8px baseline**, ensuring all components align vertically. Generous whitespace is mandated between cards (`stack-lg`) to prevent cognitive overload. In the "Property Report Generator," a stepped layout is used to guide the user through the input process, using `stack-md` for form field groupings to maintain a tight, efficient feel.

## Elevation & Depth

To maintain an **aesthetic-minimalist** feel, depth is conveyed through **tonal layers** and **low-contrast outlines** rather than heavy shadows. 

- **Surface Levels:** The primary background is the lowest level. Data "cards" sit on top of this with a white background and a subtle 1px border (#E2E8F0).
- **Subtle Elevation:** Only high-priority interactive elements (like "Generate Report" buttons or active lead cards) utilize a very soft, diffused ambient shadow (10% opacity Navy) to indicate they are "lifted" and actionable.
- **Modals:** Use a backdrop blur (glassmorphism) to maintain context of the dashboard while focusing the user on the task at hand.

## Shapes

The shape language is **Soft (0.25rem/4px)**. This choice strikes a balance between the precision of "sharp" corners (professional/efficient) and the friendliness of "rounded" corners (trustworthy/approachable). 

- **Buttons & Inputs:** Use the standard 4px radius.
- **Data Cards:** Use `rounded-lg` (8px) to create a clear container distinction.
- **Status Chips:** Use a full "pill" shape (rounded-full) to distinguish them from interactive buttons.

## Components

### Buttons
- **Primary:** Deep Navy (#1A2B3C) with white text. High contrast for primary actions like "Generate Report."
- **Secondary:** White background with a 1px Navy border. Used for "View All" or "Export" actions.
- **Action (Gold):** Used exclusively for high-value conversions, like "Mark as Sold" or "Promote Lead."

### Data Tables
- **Styling:** Border-bottom only (#E2E8F0) to keep the layout horizontal and flowing. 
- **Typography:** Use `data-tabular` for alignment. 
- **Interactive Rows:** Subtle background change to `#F1F5F9` on hover to provide immediate system feedback.

### Lead Cards
- **Structure:** Binary score (1 or 0) in the top right. 
- **Content:** Property thumbnail, sentiment icon (e.g., a "vibe" emoji or sparkline), and contact details.
- **States:** "Hot" leads receive a subtle gold left-border accent.

### Input Fields
- **Design:** Outlined with a clear focus state using a 2px Navy glow.
- **Validation:** Clear, non-intrusive success/error icons following the "Honest/Transparent" ethical tone—errors should explain *why* and how to fix them.

### Progress Indicators
- For multi-step report generation, a linear progress bar at the top of the container uses the Primary Navy color to show the "Visibility of System Status."