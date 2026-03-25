import type React from 'react';

/** Props for the GlassToggle switch control */
export interface GlassToggleProps {
  /** Whether the toggle is in the ON state */
  checked: boolean;
  /** Callback fired when the toggle state changes */
  onCheckedChange: (checked: boolean) => void;
  /** Accessible label for the switch (used as aria-label) */
  label: string;
  /** Whether the toggle is disabled */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

/** Props for the GlassSlider continuous value control */
export interface GlassSliderProps {
  /** Current slider value */
  value: number;
  /** Callback fired when the slider value changes */
  onValueChange: (value: number) => void;
  /** Minimum value. Default: 0 */
  min?: number;
  /** Maximum value. Default: 100 */
  max?: number;
  /** Step increment. Default: 1 */
  step?: number;
  /** Accessible label for the slider (used as aria-label) */
  label: string;
  /** Whether the slider is disabled */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

/** Props for the GlassSegmentedControl (Plan 02) */
export interface GlassSegmentedControlProps {
  /** Currently selected segment value */
  value: string;
  /** Callback fired when a segment is selected */
  onValueChange: (value: string) => void;
  /** Array of segments to render */
  segments: Array<{ value: string; label: string }>;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}
