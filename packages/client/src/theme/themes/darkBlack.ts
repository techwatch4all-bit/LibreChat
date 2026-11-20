import type { ThemeDefinition } from '../types';
import { defaultTheme } from './default';
import { darkTheme } from './dark';

/**
 * Pure OLED "DARK Black" theme (ChatGPT-inspired).
 * Pitch black `#000000` canvas background with crisp, subtle dark card surfaces,
 * soft modern dividers, and clear high-legibility typography.
 */
export const darkBlackTheme: ThemeDefinition = {
  version: 1,
  name: 'dark-black',
  modes: {
    dark: {
      colors: {
        ...darkTheme,
        // Text colors
        'rgb-text-primary': '236 236 236', // #ececec (high readability crisp white-grey)
        'rgb-text-secondary': '170 170 170', // #aaaaaa
        'rgb-text-secondary-alt': '140 140 140', // #8c8c8c
        'rgb-text-tertiary': '115 115 115', // #737373
        'rgb-text-muted': '140 140 140', // #8c8c8c
        'rgb-text-warning': '245 158 11', // #f59e0b
        'rgb-text-destructive': '248 113 113', // #f87171
        'rgb-shimmer-base': '255 255 255',
        'rgb-shimmer-dip': '140 140 140',

        // Link and accent colors
        'rgb-link': '96 165 250', // #60a5fa
        'rgb-link-hover': '147 197 253', // #93c5fd
        'rgb-link-visited': '192 132 252',
        'rgb-accent-primary': '255 255 255', // ChatGPT-style clean white/light neutral accent
        'rgb-accent-primary-hover': '220 220 220',

        // Ring colors
        'rgb-ring-primary': '60 60 60',

        // Header colors
        'rgb-header-primary': '0 0 0', // #000000 pure black header
        'rgb-header-hover': '24 24 24', // #181818
        'rgb-header-button-hover': '32 32 32', // #202020

        // Surface colors - OLED Pitch Black foundation
        'rgb-surface-active': '38 38 38', // #262626
        'rgb-surface-active-alt': '45 45 45', // #2d2d2d
        'rgb-surface-hover': '28 28 28', // #1c1c1c
        'rgb-surface-hover-alt': '38 38 38', // #262626
        'rgb-surface-composer-hover': '30 30 30',
        'rgb-surface-primary': '0 0 0', // #000000 OLED True Black
        'rgb-chart-widget-surface': '18 18 18', // #121212
        'rgb-chart-widget-stroke': '38 38 38', // #262626
        'rgb-surface-primary-alt': '18 18 18', // #121212
        'rgb-surface-primary-contrast': '24 24 24', // #181818
        'rgb-surface-secondary': '24 24 24', // #181818
        'rgb-surface-secondary-alt': '28 28 28', // #1c1c1c
        'rgb-surface-tertiary': '33 33 33', // #212121
        'rgb-surface-tertiary-alt': '42 42 42', // #2a2a2a
        'rgb-surface-dialog': '18 18 18', // #121212
        'rgb-surface-overlay': '0 0 0', // #000000
        'rgb-surface-submit': '4 120 87', // #047857 high-contrast emerald submit button under white text-on-status
        'rgb-surface-submit-hover': '6 95 70', // #065f46
        'rgb-surface-destructive': '153 27 27',
        'rgb-surface-destructive-hover': '127 29 29',
        'rgb-surface-chat': '0 0 0', // #000000 pure black chat canvas
        'rgb-surface-code': '18 18 18', // #121212 code blocks
        'rgb-surface-inverted': '255 255 255',
        'rgb-surface-inverted-hover': '236 236 236',
        'rgb-text-inverted': '0 0 0',
        'rgb-surface-fixed': '255 255 255',
        'rgb-surface-fixed-hover': '236 236 236',
        'rgb-text-fixed': '0 0 0',

        // Border colors - Subtle, elegant, non-intrusive
        'rgb-border-light': '38 38 38', // #262626
        'rgb-border-medium': '48 48 48', // #303030
        'rgb-border-medium-alt': '48 48 48',
        'rgb-border-heavy': '64 64 64', // #404040
        'rgb-border-xheavy': '85 85 85',
        'rgb-border-destructive': '239 68 68',

        // Status colors
        'rgb-status-success': '52 211 153',
        'rgb-status-success-subtle': '6 78 59',
        'rgb-status-success-border': '5 150 105',
        'rgb-status-success-strong': '16 185 129',
        'rgb-status-info': '96 165 250',
        'rgb-status-info-subtle': '30 58 138',
        'rgb-status-info-border': '37 99 235',
        'rgb-status-info-strong': '59 130 246',
        'rgb-status-warning': '251 191 36',
        'rgb-status-warning-subtle': '120 53 15',
        'rgb-status-warning-border': '217 119 6',
        'rgb-status-warning-strong': '245 158 11',
        'rgb-status-error': '248 113 113',
        'rgb-status-error-subtle': '127 29 29',
        'rgb-status-error-border': '220 38 38',
        'rgb-status-error-strong': '239 68 68',
        'rgb-status-neutral': '163 163 163',
        'rgb-status-neutral-subtle': '28 28 28',
        'rgb-status-neutral-border': '48 48 48',
        'rgb-status-verified': '59 130 246',
        'rgb-text-on-status': '255 255 255',

        // Brand colors
        'rgb-brand-purple': '168 85 247',

        // Syntax highlighting
        'rgb-syntax-text': '236 236 236',
        'rgb-syntax-comment': '115 115 115',
        'rgb-syntax-meta': '140 140 140',
        'rgb-syntax-builtin': '245 158 11',
        'rgb-syntax-keyword': '96 165 250',
        'rgb-syntax-string': '52 211 153',
        'rgb-syntax-attr': '244 114 182',
        'rgb-syntax-title': '248 113 113',

        // Categorical series scale
        'rgb-series-1': '56 189 248',
        'rgb-series-2': '251 146 60',
        'rgb-series-3': '45 212 191',
        'rgb-series-4': '250 204 21',
        'rgb-series-5': '244 114 182',
        'rgb-series-6': '167 139 250',
        'rgb-series-7': '74 222 128',
        'rgb-series-8': '129 140 248',

        'rgb-switch-unchecked': '64 64 64',
        'rgb-presentation': '0 0 0',
      },
    },
    light: {
      colors: {
        ...defaultTheme,
      },
    },
  },
};
