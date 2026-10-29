import { useLayoutEffect, useRef, type RefObject } from "react";
import { calculateCenteredScroll, calculateScrollPadding } from "./scroll-geometry";

interface CenteredScrollOptions {
  viewportRef: RefObject<HTMLElement | null>;
  targetRef: RefObject<HTMLElement | null>;
  resetKey: string | number;
  enabled: boolean;
}

/**
 * Centers once per key; resizing preserves the user's scroll position.
 * Apply `paddingBlock: var(--centered-scroll-padding, 0px)` to the viewport's content.
 */
export function useCenteredScroll({
  viewportRef,
  targetRef,
  resetKey,
  enabled,
}: CenteredScrollOptions) {
  const centeredKey = useRef<string | number | null>(null);
  const previousPadding = useRef(0);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    function positionInitially() {
      if (!viewport || viewport.clientHeight === 0) return;
      // Padding allows exact centering at either edge of the content.
      const adjusted = calculateScrollPadding(
        viewport.clientHeight,
        enabled,
        previousPadding.current,
        viewport.scrollTop,
      );
      viewport.style.setProperty("--centered-scroll-padding", `${adjusted.padding}px`);
      previousPadding.current = adjusted.padding;
      if (centeredKey.current === resetKey) {
        viewport.scrollTop = adjusted.scrollTop;
        return;
      }
      const target = targetRef.current;
      if (!enabled || !target) return;
      const bounds = target.getBoundingClientRect();
      viewport.scrollTop = calculateCenteredScroll({
        scrollTop: viewport.scrollTop,
        viewportTop: viewport.getBoundingClientRect().top,
        viewportHeight: viewport.clientHeight,
        borderTop: viewport.clientTop,
        targetTop: bounds.top,
        targetHeight: bounds.height,
      });
      centeredKey.current = resetKey;
    }

    positionInitially();
    const observer = new ResizeObserver(positionInitially);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [viewportRef, targetRef, resetKey, enabled]);
}
