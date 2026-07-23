import { useCallback, useRef } from 'react';

/**
 * Guards a raw Pressable/Touchable's onPress against double-fire — a second
 * tap while the first is still in flight (or within `delay` for sync handlers)
 * is dropped. `Button` has its own built-in version of this; use this hook for
 * every other pressable that navigates, submits, or hits the API, since a
 * duplicate fire there can mean a duplicate charge, fund release, or offer action.
 */
export function useSingleTap(delay = 800) {
  const inFlight = useRef(false);

  return useCallback(
    function guard(handler: () => void | Promise<void>): () => void {
      return function () {
        if (inFlight.current) return;
        inFlight.current = true;
        const result = handler();
        if (result instanceof Promise) {
          result.finally(() => {
            inFlight.current = false;
          });
        } else {
          setTimeout(() => {
            inFlight.current = false;
          }, delay);
        }
      };
    },
    [delay]
  );
}
