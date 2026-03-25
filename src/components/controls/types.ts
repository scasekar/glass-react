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

// ── Phase 23: Navigation Controls ──────────────────────────────────

/** Shared action type for navigation bar and toolbar */
export interface GlassToolbarAction {
  /** Unique identifier for the action */
  id: string;
  /** Icon element to render inside the button */
  icon: React.ReactNode;
  /** Accessible label for the action button */
  label: string;
  /** Callback fired when the action is triggered */
  onPress: () => void;
  /** Whether this is a primary/emphasized action */
  primary?: boolean;
}

/** Props for the GlassNavigationBar top bar control */
export interface GlassNavigationBarProps {
  /** Title text displayed in the navigation bar */
  title: string;
  /** Callback for back navigation; renders a back chevron when provided */
  onBack?: () => void;
  /** Right-side action buttons */
  actions?: GlassToolbarAction[];
  /** Additional inline styles */
  style?: React.CSSProperties;
  /** Additional CSS class name */
  className?: string;
}

/** Props for the GlassToolbar bottom action bar control */
export interface GlassToolbarProps {
  /** Array of toolbar actions to render as buttons */
  actions: GlassToolbarAction[];
  /** Additional inline styles */
  style?: React.CSSProperties;
  /** Additional CSS class name */
  className?: string;
}

/** A single tab item for the GlassTabBar */
export interface GlassTabItem {
  /** Unique value identifying this tab */
  value: string;
  /** Display label for the tab */
  label: string;
  /** Optional icon element for the tab */
  icon?: React.ReactNode;
}

/** Props for the GlassTabBar bottom tab control */
export interface GlassTabBarProps {
  /** Currently selected tab value */
  value: string;
  /** Callback fired when the selected tab changes */
  onValueChange: (value: string) => void;
  /** Array of tab items to render */
  tabs: GlassTabItem[];
  /** Whether the bar minimizes on scroll */
  scrollMinimize?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

/** Props for the GlassSearchBar search field control */
export interface GlassSearchBarProps {
  /** Current search text value */
  value: string;
  /** Callback fired when the search value changes */
  onValueChange: (value: string) => void;
  /** Callback for cancel action; renders a cancel button when provided */
  onCancel?: () => void;
  /** Placeholder text for the search field */
  placeholder?: string;
  /** Accessible label for the search input */
  label?: string;
  /** Whether the search bar is disabled */
  disabled?: boolean;
  /** Additional inline styles */
  style?: React.CSSProperties;
  /** Additional CSS class name */
  className?: string;
}

// ─── Overlay Control Types (Phase 24) ────────────────────────────────

/** Shared action descriptor for overlay action buttons */
export interface OverlayAction {
  label: string;
  onPress: () => void;
  /** Visual style: 'default' uses standard glass, 'destructive' uses red tint, 'primary' uses bold weight + enhanced opacity */
  style?: 'default' | 'destructive' | 'primary';
}

/** Props for GlassAlert (OVR-02) */
export interface GlassAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message?: string;
  actions: OverlayAction[];
  className?: string;
  style?: React.CSSProperties;
}

/** Props for GlassActionSheet (OVR-01) */
export interface GlassActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  actions: OverlayAction[];
  cancelLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** Props for GlassSheet (OVR-03) */
export interface GlassSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** Height mode. Default: 'half' */
  height?: 'half' | 'full';
  /** Show drag handle pill at top. Default: true */
  showDragHandle?: boolean;
  /** Accessible title for the sheet */
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** Props for GlassPopover (OVR-04) */
export interface GlassPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactElement;
  children: React.ReactNode;
  /** Popover placement side. Default: 'bottom' */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Alignment along the side axis. Default: 'center' */
  align?: 'start' | 'center' | 'end';
  /** Offset from trigger in px. Default: 8 */
  sideOffset?: number;
  className?: string;
  style?: React.CSSProperties;
}
