// Header dragging and 8-direction edge resizing for the floating reading card.
// Pointer listeners go on the window while a gesture runs and are removed when it ends.
import { clampPositionToViewport } from './positioning';

export class DragResizeController {
  // Header drag movement state
  private isDragging: boolean = false;
  /** True once the reader has moved the card by hand. */
  isUserDragged: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private dragInitialLeft: number = 0;
  private dragInitialTop: number = 0;
  private activePointerId: number | null = null;
  private currentHeaderEl: HTMLElement | null = null;
  private boundPointerMove: ((e: PointerEvent) => void) | null = null;
  private boundPointerUp: ((e: PointerEvent) => void) | null = null;
  private boundPointerCancel: ((e: PointerEvent) => void) | null = null;

  // 8-Directional Resizing state
  private isResizing: boolean = false;
  private isUserResized: boolean = false;
  private resizeDirection: string = '';
  private resizeStartX: number = 0;
  private resizeStartY: number = 0;
  private resizeInitialRect: DOMRect | null = null;
  private activeResizePointerId: number | null = null;
  private activeResizeHandle: HTMLElement | null = null;
  private boundResizeMove: ((e: PointerEvent) => void) | null = null;
  private boundResizeUp: ((e: PointerEvent) => void) | null = null;
  private boundResizeCancel: ((e: PointerEvent) => void) | null = null;
  private userResizedWidth: number | null = null;
  private userResizedHeight: number | null = null;

  constructor(private element: HTMLElement, private onResize?: () => void) {}

  setupDragHandler(): void {
    const header = this.element.querySelector('.lf-header') as HTMLElement | null;
    if (!header) return;

    this.currentHeaderEl = header;

    header.addEventListener('pointerdown', (e: PointerEvent) => {
      // Allow only primary button (0 for mouse) or touch/pen (0)
      if (e.button !== 0) return;

      // Do not initiate drag when user clicks interactive buttons, tabs, input controls, or interactive words
      const target = e.target as HTMLElement | null;
      if (
        target?.closest('button, input, select, textarea, a, .lf-btn-icon, .lf-tab, .lf-sentence-word, .lf-back-sentence-btn, [role="button"]')
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      this.isDragging = true;
      this.isUserDragged = true;
      this.activePointerId = e.pointerId;

      document.documentElement.style.setProperty('cursor', 'move', 'important');
      document.documentElement.style.setProperty('user-select', 'none', 'important');

      try {
        header.setPointerCapture(e.pointerId);
      } catch {
        // Fallback if setPointerCapture is unsupported in environment
      }

      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;

      const currentRect = this.element.getBoundingClientRect();
      this.dragInitialLeft = currentRect.left;
      this.dragInitialTop = currentRect.top;

      header.classList.add('dragging');
      this.element.classList.add('dragging');

      this.removeDragWindowListeners();

      this.boundPointerMove = (moveEv: PointerEvent) => {
        if (!this.isDragging) return;
        if (this.activePointerId !== null && moveEv.pointerId !== this.activePointerId) return;
        moveEv.preventDefault();

        const deltaX = moveEv.clientX - this.dragStartX;
        const deltaY = moveEv.clientY - this.dragStartY;

        const rawLeft = this.dragInitialLeft + deltaX;
        const rawTop = this.dragInitialTop + deltaY;

        const popupWidth = this.element.offsetWidth || currentRect.width || 410;
        const popupHeight = this.element.offsetHeight || currentRect.height || 380;

        const clamped = clampPositionToViewport(
          rawLeft,
          rawTop,
          popupWidth,
          popupHeight,
          window.innerWidth,
          window.innerHeight,
          8
        );

        this.element.style.left = `${clamped.left}px`;
        this.element.style.top = `${clamped.top}px`;
      };

      this.boundPointerUp = (upEv: PointerEvent) => {
        if (this.activePointerId !== null && upEv.pointerId !== this.activePointerId) return;
        this.finishDrag();
      };

      this.boundPointerCancel = (cancelEv: PointerEvent) => {
        if (this.activePointerId !== null && cancelEv.pointerId !== this.activePointerId) return;
        this.finishDrag();
      };

      window.addEventListener('pointermove', this.boundPointerMove, { passive: false });
      window.addEventListener('pointerup', this.boundPointerUp);
      window.addEventListener('pointercancel', this.boundPointerCancel);
    });
  }

  finishDrag(): void {
    if (!this.isDragging && this.activePointerId === null) return;
    this.isDragging = false;

    if (this.currentHeaderEl && this.activePointerId !== null) {
      try {
        if (this.currentHeaderEl.hasPointerCapture(this.activePointerId)) {
          this.currentHeaderEl.releasePointerCapture(this.activePointerId);
        }
      } catch {
        // Fallback for mock environments
      }
    }
    this.activePointerId = null;

    document.documentElement.style.removeProperty('cursor');
    document.documentElement.style.removeProperty('user-select');

    if (this.currentHeaderEl) {
      this.currentHeaderEl.classList.remove('dragging');
    }
    this.element.classList.remove('dragging');
    this.removeDragWindowListeners();
  }

  private removeDragWindowListeners(): void {
    if (this.boundPointerMove) {
      window.removeEventListener('pointermove', this.boundPointerMove);
      this.boundPointerMove = null;
    }
    if (this.boundPointerUp) {
      window.removeEventListener('pointerup', this.boundPointerUp);
      this.boundPointerUp = null;
    }
    if (this.boundPointerCancel) {
      window.removeEventListener('pointercancel', this.boundPointerCancel);
      this.boundPointerCancel = null;
    }
  }

  setupResizeHandlers(): void {
    const directions = ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'];
    directions.forEach((dir) => {
      let handle = this.element.querySelector(`.lf-resize-${dir}`) as HTMLElement | null;
      if (!handle) {
        handle = document.createElement('div');
        handle.className = `lf-resize-handle lf-resize-${dir}`;
        handle.setAttribute('data-direction', dir);
        if (dir === 'se') {
          handle.setAttribute('title', 'Drag corner to resize diagonally');
          handle.innerHTML = `
            <svg class="lf-resize-grip-icon" width="10" height="10" viewBox="0 0 10 10">
              <line x1="8" y1="2" x2="2" y2="8" stroke="#0071e3" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="8" y1="5" x2="5" y2="8" stroke="#0071e3" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="8" y1="8" x2="8" y2="8" stroke="#0071e3" stroke-width="2" stroke-linecap="round"/>
            </svg>
          `;
        }
        this.element.appendChild(handle);
      }

      // Fresh listener
      const newHandle = handle.cloneNode(true) as HTMLElement;
      handle.replaceWith(newHandle);

      newHandle.addEventListener('pointerdown', (e: PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        this.isResizing = true;
        this.isUserResized = true;
        this.isUserDragged = true;
        this.resizeDirection = dir;
        this.activeResizePointerId = e.pointerId;
        this.activeResizeHandle = newHandle;

        try {
          newHandle.setPointerCapture(e.pointerId);
        } catch {
          // Fallback
        }

        this.resizeStartX = e.clientX;
        this.resizeStartY = e.clientY;
        this.resizeInitialRect = this.element.getBoundingClientRect();

        const cursorMap: Record<string, string> = {
          n: 'ns-resize',
          s: 'ns-resize',
          w: 'ew-resize',
          e: 'ew-resize',
          nw: 'nwse-resize',
          se: 'nwse-resize',
          ne: 'nesw-resize',
          sw: 'nesw-resize'
        };
        const activeCursor = cursorMap[dir] || 'nwse-resize';
        document.documentElement.style.setProperty('cursor', activeCursor, 'important');
        document.documentElement.style.setProperty('user-select', 'none', 'important');

        this.element.classList.add('resizing', 'is-resized');
        this.removeResizeWindowListeners();

        this.boundResizeMove = (moveEv: PointerEvent) => {
          if (!this.isResizing || !this.resizeInitialRect) return;
          if (this.activeResizePointerId !== null && moveEv.pointerId !== this.activeResizePointerId) return;
          moveEv.preventDefault();

          const deltaX = moveEv.clientX - this.resizeStartX;
          const deltaY = moveEv.clientY - this.resizeStartY;
          const init = this.resizeInitialRect;

          let newWidth = init.width;
          let newHeight = init.height;
          let newLeft = init.left;
          let newTop = init.top;

          const minW = 310;
          const minH = 220;
          const maxW = Math.max(minW, window.innerWidth - 16);
          const maxH = Math.max(minH, window.innerHeight - 16);

          // Horizontal adjustment
          if (dir.includes('e')) {
            newWidth = Math.max(minW, Math.min(maxW - newLeft, init.width + deltaX));
          } else if (dir.includes('w')) {
            const clampedDeltaX = Math.min(deltaX, init.width - minW);
            const targetLeft = Math.max(8, init.left + clampedDeltaX);
            newWidth = Math.max(minW, init.width - (targetLeft - init.left));
            newLeft = targetLeft;
          }

          // Vertical adjustment
          if (dir.includes('s')) {
            newHeight = Math.max(minH, Math.min(maxH - newTop, init.height + deltaY));
          } else if (dir.includes('n')) {
            const clampedDeltaY = Math.min(deltaY, init.height - minH);
            const targetTop = Math.max(8, init.top + clampedDeltaY);
            newHeight = Math.max(minH, init.height - (targetTop - init.top));
            newTop = targetTop;
          }

          this.userResizedWidth = newWidth;
          this.userResizedHeight = newHeight;
          this.element.style.left = `${newLeft}px`;
          this.element.style.top = `${newTop}px`;
          this.element.style.width = `${newWidth}px`;
          this.element.style.height = `${newHeight}px`;
        };

        this.boundResizeUp = (upEv: PointerEvent) => {
          if (this.activeResizePointerId !== null && upEv.pointerId !== this.activeResizePointerId) return;
          this.finishResize();
        };

        this.boundResizeCancel = (cancelEv: PointerEvent) => {
          if (this.activeResizePointerId !== null && cancelEv.pointerId !== this.activeResizePointerId) return;
          this.finishResize();
        };

        window.addEventListener('pointermove', this.boundResizeMove, { passive: false });
        window.addEventListener('pointerup', this.boundResizeUp);
        window.addEventListener('pointercancel', this.boundResizeCancel);
      });
    });

    // If user previously resized, re-apply their custom width and height
    if (this.isUserResized && this.userResizedWidth && this.userResizedHeight) {
      this.element.classList.add('is-resized');
      this.element.style.width = `${this.userResizedWidth}px`;
      this.element.style.height = `${this.userResizedHeight}px`;
    }
  }

  finishResize(): void {
    if (!this.isResizing && this.activeResizePointerId === null) return;
    this.isResizing = false;

    if (this.activeResizeHandle && this.activeResizePointerId !== null) {
      try {
        if (this.activeResizeHandle.hasPointerCapture(this.activeResizePointerId)) {
          this.activeResizeHandle.releasePointerCapture(this.activeResizePointerId);
        }
      } catch {
        // Fallback
      }
    }
    this.activeResizePointerId = null;
    this.activeResizeHandle = null;

    document.documentElement.style.removeProperty('cursor');
    document.documentElement.style.removeProperty('user-select');

    this.element.classList.remove('resizing');
    this.removeResizeWindowListeners();
    this.onResize?.();
  }

  private removeResizeWindowListeners(): void {
    if (this.boundResizeMove) {
      window.removeEventListener('pointermove', this.boundResizeMove);
      this.boundResizeMove = null;
    }
    if (this.boundResizeUp) {
      window.removeEventListener('pointerup', this.boundResizeUp);
      this.boundResizeUp = null;
    }
    if (this.boundResizeCancel) {
      window.removeEventListener('pointercancel', this.boundResizeCancel);
      this.boundResizeCancel = null;
    }
  }
}
