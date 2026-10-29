interface CenteredScrollGeometry {
  scrollTop: number;
  viewportTop: number;
  viewportHeight: number;
  borderTop: number;
  targetTop: number;
  targetHeight: number;
}

export function calculateCenteredScroll(geometry: CenteredScrollGeometry): number {
  const viewportCenter = geometry.viewportTop + geometry.borderTop + geometry.viewportHeight / 2;
  const targetCenter = geometry.targetTop + geometry.targetHeight / 2;
  return geometry.scrollTop + targetCenter - viewportCenter;
}

export function calculateScrollPadding(
  viewportHeight: number,
  enabled: boolean,
  previousPadding: number,
  scrollTop: number,
) {
  const padding = enabled ? viewportHeight / 2 : 0;
  return { padding, scrollTop: scrollTop + padding - previousPadding };
}
