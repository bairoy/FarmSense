import { Colors } from '@/constants/theme';

/**
 * The app ships one sunlight-optimized theme (see DESIGN.md in
 * stitch_farmsense_mobile_ui_design/) rather than a light/dark pair, so this
 * just hands back the flat token set. Kept as a hook (not a plain import) so
 * call sites don't need to change if theming is ever reintroduced.
 */
export function useTheme() {
  return Colors;
}
