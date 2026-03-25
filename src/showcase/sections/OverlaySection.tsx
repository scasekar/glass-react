import { useState } from 'react';
import { GlassAlert } from '../../components/controls/GlassAlert';
import { GlassActionSheet } from '../../components/controls/GlassActionSheet';
import { GlassButton } from '../../components/GlassButton';
import { APPLE_RADII, APPLE_SPACING } from '../../tokens/apple';

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/**
 * Overlay controls demo section -- trigger buttons that open GlassAlert
 * and GlassActionSheet overlays with realistic scenarios.
 */
export function OverlaySection() {
  const [alertOpen, setAlertOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div style={{ paddingTop: 120, fontFamily: FONT_STACK }}>
      {/* Section Title */}
      <div style={{ textAlign: 'center', marginBottom: APPLE_SPACING.xxxl }}>
        <h2
          style={{
            fontSize: '2rem',
            fontWeight: 700,
            margin: 0,
            color: '#fff',
          }}
        >
          Fluid Overlays
        </h2>
        <p
          style={{
            fontSize: '1rem',
            color: 'rgba(255, 255, 255, 0.6)',
            margin: '12px 0 0',
          }}
        >
          Modals and sheets with the same glass quality as every other surface.
        </p>
      </div>

      {/* Trigger Buttons */}
      <div
        style={{
          display: 'flex',
          gap: APPLE_SPACING.md,
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}
      >
        <GlassButton
          cornerRadius={APPLE_RADII.md}
          onClick={() => setAlertOpen(true)}
          style={{ padding: '12px 24px', fontSize: '1rem', fontWeight: 500 }}
        >
          Show Alert
        </GlassButton>
        <GlassButton
          cornerRadius={APPLE_RADII.md}
          onClick={() => setSheetOpen(true)}
          style={{ padding: '12px 24px', fontSize: '1rem', fontWeight: 500 }}
        >
          Show Actions
        </GlassButton>
      </div>

      {/* Alert Overlay */}
      <GlassAlert
        open={alertOpen}
        onOpenChange={setAlertOpen}
        title="Delete Photo?"
        message="This action cannot be undone."
        actions={[
          { label: 'Cancel', onPress: () => setAlertOpen(false), style: 'default' },
          { label: 'Delete', onPress: () => setAlertOpen(false), style: 'destructive' },
        ]}
      />

      {/* Action Sheet Overlay */}
      <GlassActionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Share Photo"
        actions={[
          { label: 'Copy Link', onPress: () => setSheetOpen(false) },
          { label: 'Save to Files', onPress: () => setSheetOpen(false) },
          { label: 'AirDrop', onPress: () => setSheetOpen(false) },
        ]}
        cancelLabel="Cancel"
      />
    </div>
  );
}
