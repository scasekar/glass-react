import { useState, useEffect, useRef } from 'react';

export interface VirtualSectionProps {
  children: React.ReactNode;
  id: string;
  minHeight?: number;
}

/**
 * IntersectionObserver-gated section wrapper.
 * Children are only mounted when the section element itself intersects the
 * expanded viewport (rootMargin). Observes the section element directly
 * (not a sentinel) so content stays mounted while ANY part is visible.
 * When children unmount, useGlassRegion cleanup releases GPU regions.
 */
export function VirtualSection({ children, id, minHeight = 400 }: VirtualSectionProps) {
  const [isNear, setIsNear] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsNear(entry.isIntersecting),
      { rootMargin: '200px 0px' }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section id={id} ref={sectionRef} style={{ scrollMarginTop: 72, minHeight }}>
      {isNear ? children : null}
    </section>
  );
}
