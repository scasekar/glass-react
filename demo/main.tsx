import { createRoot } from 'react-dom/client';
import App from './App';
import { GlassRendererHarness } from './GlassRendererHarness';

const useHarness = new URL(window.location.href).searchParams.has('harness');
createRoot(document.getElementById('root')!).render(
  useHarness ? <GlassRendererHarness /> : <App />
);
