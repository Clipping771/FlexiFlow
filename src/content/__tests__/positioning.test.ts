import { describe, it, expect } from 'vitest';
import { calculatePopupPosition, Rect } from '../positioning';

describe('calculatePopupPosition', () => {
  it('places popup directly below target when plenty of viewport space', () => {
    const target: Rect = {
      top: 100,
      bottom: 120,
      left: 200,
      right: 260,
      width: 60,
      height: 20
    };
    const popupWidth = 380;
    const popupHeight = 250;
    const viewportWidth = 1200;
    const viewportHeight = 800;

    const pos = calculatePopupPosition(
      target,
      popupWidth,
      popupHeight,
      viewportWidth,
      viewportHeight,
      8,
      12
    );

    expect(pos.placement).toBe('bottom');
    expect(pos.top).toBe(128); // 120 + 8
    // Target center is 200 + 30 = 230; left = 230 - 190 = 40
    expect(pos.left).toBe(40);
  });

  it('flips popup above target when near bottom of viewport', () => {
    const target: Rect = {
      top: 680,
      bottom: 700,
      left: 200,
      right: 260,
      width: 60,
      height: 20
    };
    const popupWidth = 380;
    const popupHeight = 200;
    const viewportWidth = 1200;
    const viewportHeight = 800;

    const pos = calculatePopupPosition(
      target,
      popupWidth,
      popupHeight,
      viewportWidth,
      viewportHeight,
      8,
      12
    );

    expect(pos.placement).toBe('top');
    expect(pos.top).toBe(680 - 200 - 8); // 472
  });

  it('clamps popup to left screen boundary when selection is on far left edge', () => {
    const target: Rect = {
      top: 100,
      bottom: 120,
      left: 5,
      right: 45,
      width: 40,
      height: 20
    };
    const pos = calculatePopupPosition(
      target,
      380,
      200,
      1000,
      800,
      8,
      12
    );

    expect(pos.left).toBe(12); // Clamped to screenPadding
  });

  it('clamps popup to right screen boundary when selection is on far right edge', () => {
    const target: Rect = {
      top: 100,
      bottom: 120,
      left: 960,
      right: 995,
      width: 35,
      height: 20
    };
    const pos = calculatePopupPosition(
      target,
      380,
      200,
      1000,
      800,
      8,
      12
    );

    expect(pos.left).toBe(1000 - 380 - 12); // 608
  });
});
