import { useState, useEffect, useRef } from 'react';

export interface VirtualSectionProps {
  children: React.ReactNode;
  id: string;
  minHeight?: number;
}

/**
 * IntersectionObserver-gated section wrapper.
 * Children are only mounted when the section is near the viewport (within rootMargin).
 * When children unmount, useGlassRegion cleanup releases GPU regions automatically.
 */
export function VirtualSection({ children, id, minHeight = 400 }: VirtualSectionProps) {
  const [isNear, setIsNear] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsNear(entry.isIntersecting),
      { rootMargin: '100% 0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <section id={id} style={{ scrollMarginTop: 72 }}>
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
      {isNear ? (
        children
      ) : (
        <div
          data-testid="virtual-placeholder"
          style={{ minHeight }}
          aria-hidden="true"
        />
      )}
    </section>
  );
}
