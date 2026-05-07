---
name: Focused Intensity Blue
colors:
  surface: '#11131a'
  surface-dim: '#11131a'
  surface-bright: '#373941'
  surface-container-lowest: '#0c0e15'
  surface-container-low: '#191b23'
  surface-container: '#1d1f27'
  surface-container-high: '#282a31'
  surface-container-highest: '#32343c'
  on-surface: '#e1e2ec'
  on-surface-variant: '#c3c6d6'
  inverse-surface: '#e1e2ec'
  inverse-on-surface: '#2e3038'
  outline: '#8d909f'
  outline-variant: '#424654'
  surface-tint: '#b1c5ff'
  primary: '#b1c5ff'
  on-primary: '#002c71'
  primary-container: '#2d6be4'
  on-primary-container: '#f8f7ff'
  inverse-primary: '#0156cf'
  secondary: '#a4c9ff'
  on-secondary: '#00315d'
  secondary-container: '#0164b4'
  on-secondary-container: '#d0e1ff'
  tertiary: '#ffb691'
  on-tertiary: '#552000'
  tertiary-container: '#bd5100'
  on-tertiary-container: '#fff6f3'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b1c5ff'
  on-primary-fixed: '#001847'
  on-primary-fixed-variant: '#00409f'
  secondary-fixed: '#d4e3ff'
  secondary-fixed-dim: '#a4c9ff'
  on-secondary-fixed: '#001c39'
  on-secondary-fixed-variant: '#004883'
  tertiary-fixed: '#ffdbcb'
  tertiary-fixed-dim: '#ffb691'
  on-tertiary-fixed: '#341100'
  on-tertiary-fixed-variant: '#793100'
  background: '#11131a'
  on-background: '#e1e2ec'
  surface-variant: '#32343c'
typography:
  h1:
    fontFamily: Lexend
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h2:
    fontFamily: Lexend
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  h3:
    fontFamily: Lexend
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: '0'
  body-lg:
    fontFamily: Lexend
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-md:
    fontFamily: Lexend
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  label-md:
    fontFamily: Lexend
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.02em
  caption:
    fontFamily: Lexend
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: '0'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-padding: 24px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

This design system is engineered for "Flow State" productivity. It prioritizes cognitive clarity and reduces visual noise to support long-duration study sessions. The aesthetic leans into a refined **Modern Corporate** style with **Minimalist** sensibilities, utilizing a deep, nocturnal palette to minimize eye strain.

The brand personality is authoritative yet calm—acting as a quiet companion to the student's efforts rather than a distraction. Every visual element is designed to feel intentional and rhythmic, fostering an environment of professional academic rigor.

## Colors

The color palette is anchored in a high-contrast dark mode. The background (#0F0F0F) provides a void-like canvas that allows the content to recede, while the surface color (#1E1E1E) subtly lifts interactive cards and containers. 

The primary accent (#2D6BE4) is a saturated, confident blue used for primary actions and "active" states. The light accent (#4A90E2) serves as a secondary highlight for progress indicators, links, and informative callouts. Text is strictly bifurcated: pure white for maximum legibility of core content and a muted grey for metadata and secondary labels.

## Typography

This design system utilizes **Lexend** across all levels. Lexend was specifically designed to reduce visual stress and improve reading speed, making it the ideal choice for an education-focused interface. 

Headlines use a tighter letter-spacing and heavier weights to provide a sense of structure and hierarchy. Body text is set with generous line heights (1.6) to ensure that long strings of notes or study data remain digestible. Labels and small captions use a medium weight to maintain legibility against the dark background.

## Layout & Spacing

The layout philosophy follows a **Fluid Grid** model built on an 8px base unit. For desktop views, a 12-column grid is used with 24px margins to provide a spacious "breathing room" that prevents the UI from feeling cramped during intense study sessions.

Spacing is used to group related concepts. Low-level elements (like a label and its input) are separated by 8px, while distinct sections within a page are separated by 32px or more. This clear rhythmic separation helps the user mentally map the application's functions.

## Elevation & Depth

In this design system, depth is communicated through **Tonal Layers** and **Low-contrast Outlines**. 

- **Level 0 (Background):** #0F0F0F.
- **Level 1 (Cards/Surfaces):** #1E1E1E. Surfaces should have a subtle 1px border (#2C2C2C) to define edges against the background without the need for heavy shadows.
- **Level 2 (Popovers/Modals):** These use #252525 with a soft, diffused shadow (0px 8px 24px rgba(0,0,0,0.5)) and a slightly brighter 1px border (#3A3A3A).

This approach maintains a flat, professional look while providing enough visual cues to understand hierarchy.

## Shapes

The shape language is defined by a consistent **12-14px corner radius** on all primary containers and cards. This moderate rounding strikes a balance between the technical precision of sharp corners and the approachability of fully rounded elements.

Smaller components like buttons and input fields should strictly adhere to the 12px radius, while progress bar containers may use a fully rounded (pill) shape to denote a status that is "in motion."

## Components

### Buttons
- **Primary:** Solid #2D6BE4 with #FFFFFF text. Heavy weight Lexend.
- **Secondary:** Transparent with a 2px border of #4A90E2.
- **Ghost:** No background, #9E9E9E text, turning #FFFFFF on hover.

### Inputs & Fields
Inputs use the #1E1E1E surface color with a 1px border of #2C2C2C. Upon focus, the border transitions to the primary #2D6BE4 blue.

### Cards
Cards are the primary organizational unit. They must use the 12-14px corner radius and contain internal padding of 24px. Header text within cards should be H3 or Label-md Bold.

### Specialized Components
- **Focus Timer:** A large, centered display using H1 typography.
- **Progress Bars:** A background track of #2C2C2C with a fill of #4A90E2.
- **Subject Chips:** Small, #1E1E1E backgrounds with a left-side 4px vertical accent line using the primary blue to categorize different study topics.