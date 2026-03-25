import React, { useState, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GlassPanel } from '../GlassPanel';
import { GlassButton } from '../GlassButton';
import { APPLE_SPACING, APPLE_RADII } from '../../tokens/apple';
import type { GlassSearchBarProps } from './types';

/**
 * A glass-effect search bar with animated cancel button and focus-driven
 * glass parameter enhancement.
 *
 * Renders a capsule-shaped GlassPanel containing a magnifier icon, a native
 * text input, and a conditional clear button. When focused, a cancel button
 * animates in beside the capsule and glass specular/rim are enhanced.
 *
 * @example
 * ```tsx
 * const [query, setQuery] = useState('');
 * <GlassSearchBar
 *   value={query}
 *   onValueChange={setQuery}
 *   onCancel={() => console.log('cancelled')}
 * />
 * ```
 */
export function GlassSearchBar({
  value,
  onValueChange,
  onCancel,
  placeholder = 'Search',
  label = 'Search',
  disabled,
  style,
  className,
}: GlassSearchBarProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onValueChange('');
    inputRef.current?.focus();
  };

  const handleCancel = () => {
    onValueChange('');
    onCancel?.();
    inputRef.current?.blur();
  };

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: APPLE_SPACING.sm,
        ...style,
      }}
    >
      <GlassPanel
        cornerRadius={APPLE_RADII.pill}
        specular={focused ? 0.35 : undefined}
        rim={focused ? 0.30 : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 36,
          paddingLeft: APPLE_SPACING.sm,
          paddingRight: APPLE_SPACING.xs,
          flex: 1,
        }}
      >
        {/* Magnifier icon */}
        <span
          style={{
            fontSize: 14,
            opacity: 0.5,
            marginRight: APPLE_SPACING.xs,
            lineHeight: 1,
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          {'\u{1F50D}'}
        </span>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          aria-label={label}
          disabled={disabled}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 15,
            color: 'inherit',
            padding: 0,
            minWidth: 0,
          }}
        />

        {value.length > 0 && (
          <GlassButton
            cornerRadius={APPLE_RADII.sm}
            aria-label="Clear search"
            onClick={handleClear}
            style={{
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {'\u00D7'}
          </GlassButton>
        )}
      </GlassPanel>

      <AnimatePresence>
        {focused && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
            <div
              onMouseDown={(e: React.MouseEvent) => {
                // Prevent the input blur from firing before the click handler
                e.preventDefault();
              }}
            >
              <GlassButton
                cornerRadius={APPLE_RADII.md}
                onClick={handleCancel}
                style={{
                  fontSize: 15,
                  padding: `${APPLE_SPACING.xs}px ${APPLE_SPACING.sm}px`,
                  whiteSpace: 'nowrap',
                }}
              >
                Cancel
              </GlassButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
