import { useEffect, useState } from 'react';
import { initEngine } from './wasm/loader';

export default function App() {
  const [status, setStatus] = useState<'loading' | 'running' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initEngine()
      .then(() => setStatus('running'))
      .catch((err) => {
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  if (status === 'loading') {
    return <p>Initializing WebGPU engine...</p>;
  }

  if (status === 'error') {
    return <p style={{ color: '#f44' }}>Engine failed: {error}</p>;
  }

  return <p style={{ color: '#4f4' }}>Engine running</p>;
}
