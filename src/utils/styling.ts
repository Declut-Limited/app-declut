import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const [shortDimension, longDimension] =
  SCREEN_WIDTH < SCREEN_HEIGHT ? [SCREEN_WIDTH, SCREEN_HEIGHT] : [SCREEN_HEIGHT, SCREEN_WIDTH];

// Design mock reference size — iPhone 13 mini class.
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

/** Anything that reads as horizontal: horizontal padding/margin, widths, horizontal gaps. */
export const scale = (size: number) =>
  Math.round(PixelRatio.roundToNearestPixel((shortDimension / guidelineBaseWidth) * size));

/** Anything vertical, plus font sizes, icon sizes, and border radii — screen height varies more than width across devices. */
export const verticalScale = (size: number) =>
  Math.round(PixelRatio.roundToNearestPixel((longDimension / guidelineBaseHeight) * size));
