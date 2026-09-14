import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const [shortDimension, longDimension] =
  SCREEN_WIDTH < SCREEN_HEIGHT ? [SCREEN_WIDTH, SCREEN_HEIGHT] : [SCREEN_HEIGHT, SCREEN_WIDTH];

// Three phone-size classes: small/medium/large. Between the small and large guide, the design
// renders at its literal mock size — zero drift — which covers the realistic range of modern
// phones, so most real devices need no scaling at all. Only devices smaller than the small guide
// or larger than the large guide (tablets, unfolded foldables, genuinely old/tiny phones) get
// scaled, and only by however far they sit outside this band. Declut's actual user base skews
// heavily Android/budget-to-mid-range (Nigeria), which is why these guides are Android-typical
// sizes, not the Figma artboard's iPhone frame. Medium (360x760, a common mid-range Android
// size) is the reference class devices are expected to cluster around, sitting in the middle of
// the safe band — not its floor. Only small/large feed the ratio math directly (the band is
// defined by its two ends); medium is asserted below to make sure it stays inside that band.
const SMALL_GUIDE_WIDTH = 340;
const SMALL_GUIDE_HEIGHT = 700;
const MEDIUM_GUIDE_WIDTH = 360;
const MEDIUM_GUIDE_HEIGHT = 760;
const LARGE_GUIDE_WIDTH = 400;
const LARGE_GUIDE_HEIGHT = 850;

if (__DEV__) {
  const withinRange = (value: number, min: number, max: number) => value >= min && value <= max;
  if (
    !withinRange(MEDIUM_GUIDE_WIDTH, SMALL_GUIDE_WIDTH, LARGE_GUIDE_WIDTH) ||
    !withinRange(MEDIUM_GUIDE_HEIGHT, SMALL_GUIDE_HEIGHT, LARGE_GUIDE_HEIGHT)
  ) {
    console.warn('[styling] MEDIUM guide must sit between SMALL and LARGE guides — check styling.ts');
  }
}

// Beyond the two guides, clamp how far the ratio can drift before scaling. Without this, a
// tablet or an unfolded foldable (700dp+ wide) would blow every padding/icon/font size past any
// reasonable bound — moderation alone (the `factor` below) only slows that down, it doesn't cap
// it. 0.8-1.3 covers essentially every phone in the wild; only genuinely tablet-class devices
// hit the ceiling, and they're capped there rather than left to balloon further.
const MIN_RATIO = 0.8;
const MAX_RATIO = 1.3;

/**
 * 1.0 for anything between the two guides (render at mock size, no drift); outside that band,
 * the ratio to whichever guide is nearer, clamped. Continuous at both boundaries — no jump the
 * instant a device crosses into or out of the safe zone.
 */
const guidedRatio = (dimension: number, smallGuide: number, largeGuide: number) => {
  if (dimension < smallGuide) return Math.max(dimension / smallGuide, MIN_RATIO);
  if (dimension > largeGuide) return Math.min(dimension / largeGuide, MAX_RATIO);
  return 1;
};

/**
 * Blends `factor` of the way toward the guided ratio instead of committing to it fully — even
 * outside the safe zone, a device just past its edge should barely move, not jump the full
 * amount. This narrows the divergence for devices outside the safe zone; it does not eliminate
 * it — no multiplier-based scale can make a fixed design render identically on every screen.
 */
const moderate = (size: number, ratio: number, factor: number) =>
  Math.round(PixelRatio.roundToNearestPixel(size + (ratio * size - size) * factor));

/** Anything that reads as horizontal: horizontal padding/margin, widths, horizontal gaps — also used for font sizes (see theme.ts), since width varies less across phones than height. */
export const scale = (size: number, factor = 0.5) =>
  moderate(size, guidedRatio(shortDimension, SMALL_GUIDE_WIDTH, LARGE_GUIDE_WIDTH), factor);

/** Anything vertical: vertical padding/margin, heights, vertical gaps, icon sizes, border radii. */
export const verticalScale = (size: number, factor = 0.5) =>
  moderate(size, guidedRatio(longDimension, SMALL_GUIDE_HEIGHT, LARGE_GUIDE_HEIGHT), factor);
