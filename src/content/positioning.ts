export interface Position {
  top: number;
  left: number;
  placement: 'bottom' | 'top';
}

export interface Rect {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
}

/**
 * Calculates viewport-relative coordinates (for position: fixed)
 * Ensures popup is completely visible, boundary-clamped, and flips above
 * when close to the bottom viewport edge or when space above is greater.
 */
export function calculatePopupPosition(
  targetRect: Rect,
  popupWidth: number = 390,
  popupHeight: number = 360,
  viewportWidth: number = window.innerWidth,
  viewportHeight: number = window.innerHeight,
  offsetGap: number = 8,
  screenPadding: number = 12
): Position {
  // Horizontal center relative to target
  let left = targetRect.left + (targetRect.width / 2) - (popupWidth / 2);

  // Clamp horizontally within viewport
  if (left < screenPadding) {
    left = screenPadding;
  } else if (left + popupWidth > viewportWidth - screenPadding) {
    left = Math.max(screenPadding, viewportWidth - popupWidth - screenPadding);
  }

  // Vertical space calculation
  const spaceBelow = viewportHeight - targetRect.bottom - offsetGap - screenPadding;
  const spaceAbove = targetRect.top - offsetGap - screenPadding;

  let top: number;
  let placement: 'bottom' | 'top' = 'bottom';

  // If plenty of room below, default below
  if (spaceBelow >= popupHeight) {
    top = targetRect.bottom + offsetGap;
    placement = 'bottom';
  } else if (spaceAbove >= popupHeight) {
    // If overflowing bottom edge but room exists above, flip above
    top = targetRect.top - popupHeight - offsetGap;
    placement = 'top';
  } else {
    // Limited space both above and below: choose the side with MORE space
    if (spaceAbove > spaceBelow) {
      top = targetRect.top - popupHeight - offsetGap;
      placement = 'top';
    } else {
      top = targetRect.bottom + offsetGap;
      placement = 'bottom';
    }
  }

  // Boundary clamp: ensure the entire popup window NEVER extends outside the visible viewport
  const maxAllowedTop = Math.max(screenPadding, viewportHeight - popupHeight - screenPadding);
  top = Math.max(screenPadding, Math.min(top, maxAllowedTop));

  return {
    top: Math.round(top),
    left: Math.round(left),
    placement
  };
}

/**
 * Clamps coordinates within the viewport boundaries considering screen padding
 */
export function clampPositionToViewport(
  left: number,
  top: number,
  popupWidth: number = 410,
  popupHeight: number = 380,
  viewportWidth: number = window.innerWidth,
  viewportHeight: number = window.innerHeight,
  screenPadding: number = 8
): { left: number; top: number } {
  const minLeft = screenPadding;
  const maxLeft = Math.max(minLeft, viewportWidth - popupWidth - screenPadding);
  const minTop = screenPadding;
  const maxTop = Math.max(minTop, viewportHeight - popupHeight - screenPadding);

  return {
    left: Math.round(Math.max(minLeft, Math.min(left, maxLeft))),
    top: Math.round(Math.max(minTop, Math.min(top, maxTop)))
  };
}

