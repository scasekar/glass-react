import { GlassNavigationBar } from '../../components/controls/GlassNavigationBar';
import { GlassToolbar } from '../../components/controls/GlassToolbar';
import { GlassPanel } from '../../components/GlassPanel';
import { APPLE_RADII, APPLE_SPACING } from '../../tokens/apple';

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/* Simple unicode/SVG icons -- no icon library needed */
const ShareIcon = () => (
  <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{'\u2191'}</span>
);
const HeartIcon = () => (
  <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{'\u2661'}</span>
);
const BookmarkIcon = () => (
  <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{'\u2606'}</span>
);
const MoreIcon = () => (
  <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{'\u2026'}</span>
);

/**
 * Navigation controls demo section -- a mock phone/app frame with
 * GlassNavigationBar at top and GlassToolbar at bottom.
 */
export function NavigationSection() {
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
          Real App Navigation
        </h2>
        <p
          style={{
            fontSize: '1rem',
            color: 'rgba(255, 255, 255, 0.6)',
            margin: '12px 0 0',
          }}
        >
          Production navigation patterns with glass surfaces, ready to ship.
        </p>
      </div>

      {/* Mock App Frame */}
      <GlassPanel
        cornerRadius={APPLE_RADII.xl}
        style={{
          maxWidth: 400,
          height: 500,
          margin: '0 auto',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Navigation Bar */}
        <GlassNavigationBar
          title="Photos"
          onBack={() => {}}
          actions={[
            {
              id: 'share',
              icon: <ShareIcon />,
              label: 'Share',
              onPress: () => {},
            },
          ]}
        />

        {/* Content Area */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 2,
            padding: 2,
            overflow: 'hidden',
          }}
        >
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              style={{
                background: `hsl(${200 + i * 15}, 40%, ${25 + i * 3}%)`,
                borderRadius: 4,
                aspectRatio: '1',
              }}
            />
          ))}
        </div>

        {/* Toolbar */}
        <GlassToolbar
          actions={[
            { id: 'heart', icon: <HeartIcon />, label: 'Favorite', onPress: () => {} },
            { id: 'share', icon: <ShareIcon />, label: 'Share', onPress: () => {} },
            { id: 'bookmark', icon: <BookmarkIcon />, label: 'Bookmark', onPress: () => {} },
            { id: 'more', icon: <MoreIcon />, label: 'More', onPress: () => {} },
          ]}
        />
      </GlassPanel>
    </div>
  );
}
