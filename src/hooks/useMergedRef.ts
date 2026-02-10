import type { Ref, RefCallback, MutableRefObject } from 'react';

/**
 * Merges multiple refs into a single callback ref.
 * Useful when a component needs an internal ref for position tracking
 * and also accepts an external ref from the consumer.
 */
export function useMergedRef<T>(...refs: (Ref<T> | undefined)[]): RefCallback<T> {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref && typeof ref === 'object') {
        (ref as MutableRefObject<T | null>).current = node;
      }
    }
  };
}
