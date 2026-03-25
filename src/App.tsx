import { useState } from 'react';
import { GlassProvider } from './components/GlassProvider';
import { ShowcasePage } from './showcase/ShowcasePage';

export default function App() {
  const [backgroundMode, setBackgroundMode] = useState<'image' | 'noise'>('image');

  return (
    <GlassProvider backgroundMode={backgroundMode}>
      <ShowcasePage
        backgroundMode={backgroundMode}
        onBackgroundModeChange={setBackgroundMode}
      />
    </GlassProvider>
  );
}
