/**
 * SmokeTest.tsx - Dev-only component to verify motion + Radix UI integration.
 * NOT exported from src/index.ts. Guarded by import.meta.env.DEV.
 */
import { motion } from 'motion/react';
import * as Switch from '@radix-ui/react-switch';
import { useState } from 'react';

export function SmokeTest() {
  if (!import.meta.env.DEV) return null;

  const [checked, setChecked] = useState(false);

  return (
    <div style={{ padding: 24, border: '1px dashed rgba(255,255,255,0.3)', borderRadius: 12, marginTop: 16 }}>
      <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 12 }}>Smoke Test (dev only)</div>

      {/* motion spring animation */}
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          width: 80,
          height: 40,
          borderRadius: 8,
          background: 'rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          color: 'white',
          marginBottom: 12,
        }}
      >
        motion ok
      </motion.div>

      {/* Radix Switch */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Switch.Root
          checked={checked}
          onCheckedChange={setChecked}
          style={{
            width: 42,
            height: 25,
            backgroundColor: checked ? 'rgba(52, 199, 89, 0.8)' : 'rgba(120, 120, 128, 0.32)',
            borderRadius: 9999,
            position: 'relative',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <Switch.Thumb
            style={{
              display: 'block',
              width: 21,
              height: 21,
              backgroundColor: 'white',
              borderRadius: 9999,
              transition: 'transform 200ms',
              transform: checked ? 'translateX(19px)' : 'translateX(2px)',
            }}
          />
        </Switch.Root>
        <span style={{ fontSize: 12, color: 'white', opacity: 0.7 }}>
          Radix Switch: {checked ? 'ON' : 'OFF'}
        </span>
      </div>
    </div>
  );
}
