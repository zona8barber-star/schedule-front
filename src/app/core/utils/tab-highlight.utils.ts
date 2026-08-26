export interface TabHighlightStyle {
  transform: string;
  width: string;
}

/**
 * Positions the sliding "glass" highlight behind the active bottom-nav tab,
 * given the active tab element's own offsetLeft/offsetWidth.
 */
export function computeTabHighlightStyle(offsetLeft: number, offsetWidth: number): TabHighlightStyle {
  return {
    transform: `translateX(${offsetLeft}px)`,
    width: `${offsetWidth}px`,
  };
}
