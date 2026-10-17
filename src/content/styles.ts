// Scoped CSS styles injected directly into Shadow DOM root for complete isolation

export const POPUP_STYLES = `
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", "Kalpurush", "SolaimanLipi", "Noto Sans Bengali", sans-serif;
  color: #1d1d1f;
  font-size: 13.5px;
  line-height: 1.5;
  letter-spacing: -0.01em;
  box-sizing: border-box;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* Floating Glass Popover (Sheet-Style Clarity) */
.lexiflow-popup {
  position: fixed;
  width: 410px;
  max-width: min(440px, calc(100vw - 16px));
  max-height: min(540px, calc(100vh - 20px));
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.95);
  border: 0.5px solid rgba(0, 0, 0, 0.1);
  border-radius: 18px;
  box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.08), inset 0 0.5px 0 rgba(255, 255, 255, 0.8), 0 20px 60px rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(50px) saturate(190%);
  -webkit-backdrop-filter: blur(50px) saturate(190%);
  z-index: 2147483647;
  overflow: hidden;
  box-sizing: border-box;
  /* Scalable Accessibility Typography Tokens */
  --lf-font-base: 15px;
  --lf-font-title: 18.5px;
  --lf-font-english: 16px;
  --lf-font-bengali: 18.5px;
  --lf-font-context: 15px;
  --lf-font-example: 14px;
  --lf-font-sublabel: 12px;
  --lf-font-chip: 12.5px;
  --lf-font-sentence: 18px;
  --lf-font-tab: 13.5px;
}

/* Standalone Window Mode (Used for fallback PDF / window lookups to be 100% identical) */
.lexiflow-popup.standalone-mode {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100% !important;
  height: 100vh !important;
  max-width: none !important;
  max-height: none !important;
  border-radius: 0 !important;
  border: none !important;
  box-shadow: none !important;
}

.lexiflow-popup.standalone-mode .lf-content {
  flex: 1 1 auto !important;
  max-height: none !important;
}

/* Size Variants (small, medium, large, xlarge - Low Vision Friendly) */
.lexiflow-popup.size-small {
  width: 370px;
  max-width: min(390px, calc(100vw - 16px));
  max-height: min(480px, calc(100vh - 20px));
  --lf-font-base: 14px;
  --lf-font-title: 16.5px;
  --lf-font-english: 15px;
  --lf-font-bengali: 17px;
  --lf-font-context: 14px;
  --lf-font-example: 13.5px;
  --lf-font-sublabel: 11.5px;
  --lf-font-chip: 11.5px;
  --lf-font-sentence: 16.5px;
  --lf-font-tab: 12.5px;
  font-size: 14px;
}
.lexiflow-popup.size-small .lf-header {
  padding: 8px 12px;
  min-height: 42px;
}
.lexiflow-popup.size-small .lf-heading-word {
  max-width: 180px;
  font-size: var(--lf-font-title);
}
.lexiflow-popup.size-small .lf-heading-sentence {
  font-size: 14px;
}
.lexiflow-popup.size-small .lf-tabs {
  margin: 4px 10px 0 10px;
  padding: 2.5px;
}
.lexiflow-popup.size-small .lf-tab {
  padding: 5px 8px;
  font-size: 12.5px;
  font-weight: 600;
}
.lexiflow-popup.size-small .lf-content {
  max-height: min(330px, calc(100vh - 140px));
  padding: 10px 12px 18px 12px;
}
.lexiflow-popup.size-small .lf-footer {
  height: 38px;
  padding: 0 10px;
}
.lexiflow-popup.size-small .lf-btn-action {
  padding: 4px 11px;
  font-size: 12px;
}

.lexiflow-popup.size-medium {
  width: 440px;
  max-width: min(480px, calc(100vw - 16px));
  max-height: min(580px, calc(100vh - 20px));
  --lf-font-base: 15px;
  --lf-font-title: 18.5px;
  --lf-font-english: 16px;
  --lf-font-bengali: 18.5px;
  --lf-font-context: 15px;
  --lf-font-example: 14px;
  --lf-font-sublabel: 12px;
  --lf-font-chip: 12.5px;
  --lf-font-sentence: 18px;
  --lf-font-tab: 13.5px;
  font-size: 15px;
}
.lexiflow-popup.size-medium .lf-header {
  padding: 10px 14px;
  min-height: 48px;
}
.lexiflow-popup.size-medium .lf-heading-word {
  max-width: 250px;
  font-size: var(--lf-font-title);
}
.lexiflow-popup.size-medium .lf-heading-sentence {
  font-size: 15.5px;
}
.lexiflow-popup.size-medium .lf-tabs {
  margin: 6px 14px 0 14px;
  padding: 3px;
}
.lexiflow-popup.size-medium .lf-tab {
  padding: 6px 11px;
  font-size: 13.5px;
  font-weight: 600;
}
.lexiflow-popup.size-medium .lf-content {
  max-height: min(420px, calc(100vh - 160px));
  padding: 14px 16px 24px 16px;
}
.lexiflow-popup.size-medium .lf-footer {
  height: 42px;
  padding: 0 14px;
}
.lexiflow-popup.size-medium .lf-btn-action {
  padding: 5px 13px;
  font-size: 13px;
}

.lexiflow-popup.size-large {
  width: 520px;
  max-width: min(560px, calc(100vw - 16px));
  max-height: min(670px, calc(100vh - 20px));
  --lf-font-base: 17px;
  --lf-font-title: 21.5px;
  --lf-font-english: 18px;
  --lf-font-bengali: 21px;
  --lf-font-context: 17px;
  --lf-font-example: 15.5px;
  --lf-font-sublabel: 13.5px;
  --lf-font-chip: 13.5px;
  --lf-font-sentence: 20px;
  --lf-font-tab: 15.5px;
  font-size: 17px;
}
.lexiflow-popup.size-large .lf-header {
  padding: 12px 16px;
  min-height: 52px;
}
.lexiflow-popup.size-large .lf-heading-word {
  max-width: 310px;
  font-size: var(--lf-font-title);
}
.lexiflow-popup.size-large .lf-heading-sentence {
  font-size: 17px;
}
.lexiflow-popup.size-large .lf-tabs {
  margin: 8px 16px 0 16px;
  padding: 3.5px;
}
.lexiflow-popup.size-large .lf-tab {
  padding: 7px 14px;
  font-size: 15.5px;
  font-weight: 600;
}
.lexiflow-popup.size-large .lf-content {
  max-height: min(500px, calc(100vh - 170px));
  padding: 16px 18px 28px 18px;
}
.lexiflow-popup.size-large .lf-bengali-box {
  padding: 12px 16px;
}
.lexiflow-popup.size-large .lf-footer {
  height: 46px;
  padding: 0 16px;
}
.lexiflow-popup.size-large .lf-btn-action {
  padding: 6px 15px;
  font-size: 14px;
}

/* Extra Large Variant (চোখের সর্বোচ্চ আরাম ও বড় টেক্সট) */
.lexiflow-popup.size-xlarge {
  width: 610px;
  max-width: min(660px, calc(100vw - 16px));
  max-height: min(740px, calc(100vh - 20px));
  --lf-font-base: 19px;
  --lf-font-title: 24px;
  --lf-font-english: 20px;
  --lf-font-bengali: 23.5px;
  --lf-font-context: 19px;
  --lf-font-example: 17.5px;
  --lf-font-sublabel: 15px;
  --lf-font-chip: 15px;
  --lf-font-sentence: 22.5px;
  --lf-font-tab: 17.5px;
  font-size: 19px;
}
.lexiflow-popup.size-xlarge .lf-header {
  padding: 14px 18px;
  min-height: 56px;
}
.lexiflow-popup.size-xlarge .lf-heading-word {
  max-width: 380px;
  font-size: var(--lf-font-title);
}
.lexiflow-popup.size-xlarge .lf-heading-sentence {
  font-size: 19px;
}
.lexiflow-popup.size-xlarge .lf-tabs {
  margin: 8px 18px 0 18px;
  padding: 4px;
}
.lexiflow-popup.size-xlarge .lf-tab {
  padding: 8px 16px;
  font-size: 17.5px;
  font-weight: 600;
}
.lexiflow-popup.size-xlarge .lf-content {
  max-height: min(560px, calc(100vh - 180px));
  padding: 18px 20px 32px 20px;
}
.lexiflow-popup.size-xlarge .lf-bengali-box {
  padding: 14px 18px;
}
.lexiflow-popup.size-xlarge .lf-footer {
  height: 50px;
  padding: 0 18px;
}
.lexiflow-popup.size-xlarge .lf-btn-action {
  padding: 7px 17px;
  font-size: 15px;
}

.lexiflow-popup.lf-hidden,
.lexiflow-popup[hidden],
.lexiflow-popup[style*="display: none"] {
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
  opacity: 0 !important;
}

.lexiflow-popup.dragging,
.lexiflow-popup.dragging * {
  cursor: grabbing !important;
  user-select: none !important;
  -webkit-user-select: none !important;
}

.lexiflow-popup.dragging {
  outline: 2px solid #0071e3 !important;
  box-shadow: 0 0 0 4px rgba(0, 113, 227, 0.25), 0 24px 60px rgba(0, 0, 0, 0.3) !important;
}

.lexiflow-popup.resizing {
  outline: 2px solid #0071e3 !important;
  box-shadow: 0 0 0 4px rgba(0, 113, 227, 0.25), 0 24px 60px rgba(0, 0, 0, 0.3) !important;
  user-select: none !important;
  -webkit-user-select: none !important;
}

.lexiflow-popup.is-resized {
  max-width: none !important;
  max-height: none !important;
}

.lexiflow-popup.is-resized .lf-content {
  max-height: none !important;
  flex: 1 1 auto !important;
}

/* 8-Directional Resize Handles */
.lf-resize-handle {
  position: absolute;
  z-index: 2147483647;
  background: transparent;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

/* Cardinal Edges */
.lf-resize-handle.lf-resize-n {
  top: -4px;
  left: 12px;
  right: 12px;
  height: 8px;
  cursor: ns-resize;
}
.lf-resize-handle.lf-resize-s {
  bottom: -4px;
  left: 12px;
  right: 12px;
  height: 8px;
  cursor: ns-resize;
}
.lf-resize-handle.lf-resize-w {
  left: -4px;
  top: 12px;
  bottom: 12px;
  width: 8px;
  cursor: ew-resize;
}
.lf-resize-handle.lf-resize-e {
  right: -4px;
  top: 12px;
  bottom: 12px;
  width: 8px;
  cursor: ew-resize;
}

/* Diagonal Corners */
.lf-resize-handle.lf-resize-nw {
  top: -4px;
  left: -4px;
  width: 14px;
  height: 14px;
  cursor: nwse-resize;
}
.lf-resize-handle.lf-resize-ne {
  top: -4px;
  right: -4px;
  width: 14px;
  height: 14px;
  cursor: nesw-resize;
}
.lf-resize-handle.lf-resize-sw {
  bottom: -4px;
  left: -4px;
  width: 14px;
  height: 14px;
  cursor: nesw-resize;
}
.lf-resize-handle.lf-resize-se {
  bottom: 0px;
  right: 0px;
  width: 18px;
  height: 18px;
  cursor: nwse-resize;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 3px;
}

.lf-resize-handle:hover {
  background: rgba(0, 113, 227, 0.12);
}
.lf-resize-handle.lf-resize-n:hover,
.lf-resize-handle.lf-resize-s:hover {
  border-top: 2px solid #0071e3;
}
.lf-resize-handle.lf-resize-w:hover,
.lf-resize-handle.lf-resize-e:hover {
  border-left: 2px solid #0071e3;
}

/* Corner Grip Icon */
.lf-resize-grip-icon {
  width: 10px;
  height: 10px;
  opacity: 0.5;
  transition: opacity 0.12s ease;
  pointer-events: none;
}
.lf-resize-handle.lf-resize-se:hover .lf-resize-grip-icon {
  opacity: 1;
}

@keyframes lfFadeIn {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.lf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.85);
  flex-shrink: 0;
  gap: 8px;
  min-height: 46px;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}

.lf-header.dragging {
  cursor: grabbing;
}

.lf-drag-indicator {
  font-size: 12px;
  color: #8e8e93;
  cursor: grab;
  user-select: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 4px;
  border-radius: 4px;
  letter-spacing: -0.5px;
  flex-shrink: 0;
  transition: color 0.12s ease;
}

.lf-drag-indicator:hover {
  color: #0071e3;
}

.lf-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1 1 auto;
  min-width: 0;
}

.lf-word {
  font-size: 16px;
  font-weight: 700;
  color: #1d1d1f;
  letter-spacing: -0.02em;
}

.lf-heading-word {
  font-size: 16px;
  font-weight: 700;
  color: #1d1d1f;
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 230px;
}

.lf-heading-sentence {
  font-size: 14px;
  font-weight: 600;
  color: #1d1d1f;
  letter-spacing: -0.015em;
}

.lf-back-sentence-btn {
  background: rgba(120, 120, 128, 0.12);
  color: #0071e3;
  border: none;
  border-radius: 99px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  transition: background 0.12s ease;
  flex-shrink: 0;
}

.lf-back-sentence-btn:hover {
  background: rgba(120, 120, 128, 0.2);
}

.lf-pos {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  background: rgba(0, 113, 227, 0.1);
  color: #0071e3;
  padding: 2px 7px;
  border-radius: 99px;
  letter-spacing: 0.03em;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lf-phonetic {
  font-size: 12px;
  color: #6e6e73;
  font-style: italic;
}

.lf-actions-top {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  cursor: default;
}

.lf-btn-icon {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #6e6e73;
  padding: 4px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s ease, color 0.12s ease;
  min-width: 28px;
  min-height: 28px;
  font-size: 14px;
  line-height: 1;
  pointer-events: auto !important;
  user-select: none;
  touch-action: manipulation;
}

.lf-btn-icon:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #1d1d1f;
}

.lf-btn-icon.active {
  color: #ff3b30;
  background: rgba(255, 59, 48, 0.12);
}

.lf-zoom-btn {
  font-weight: 700;
  font-size: 11px;
  color: #0071e3;
  padding: 3px 6px;
  background: rgba(0, 113, 227, 0.08);
  border: 1px solid rgba(0, 113, 227, 0.2);
  border-radius: 6px;
  letter-spacing: -0.3px;
}

.lf-zoom-btn:hover {
  background: rgba(0, 113, 227, 0.16);
  color: #0077ed;
  border-color: rgba(0, 113, 227, 0.35);
}

.lf-close-btn {
  font-weight: 700;
  font-size: 14px;
  position: relative;
  z-index: 2147483647;
  cursor: pointer !important;
  pointer-events: auto !important;
}

.lf-close-btn:hover {
  background: rgba(255, 59, 48, 0.15) !important;
  color: #ff3b30 !important;
}

/* Native Segmented Control */
.lf-tabs {
  display: flex;
  background: rgba(120, 120, 128, 0.12);
  margin: 6px 14px 0 14px;
  padding: 2.5px;
  border-radius: 9px;
  gap: 2px;
  flex-shrink: 0;
}

.lf-tab {
  flex: 1;
  padding: 6px 10px;
  font-size: var(--lf-font-tab, 13.5px);
  font-weight: 600;
  color: #6e6e73;
  background: none;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.14s ease;
  text-align: center;
  white-space: nowrap;
  user-select: none;
  font-family: inherit;
}

.lf-tab:hover {
  color: #1d1d1f;
}

.lf-tab.active {
  color: #0071e3;
  background: #ffffff;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Quick AI Prompt Box */
.lf-quick-ai-box {
  margin-top: 10px;
  padding: 8px 10px;
  background: rgba(0, 113, 227, 0.05);
  border: 0.5px solid rgba(0, 113, 227, 0.16);
  border-radius: 10px;
}

.lf-quick-ai-title {
  font-size: 11px;
  font-weight: 700;
  color: #0071e3;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.lf-quick-ai-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.lf-quick-chip {
  background: #ffffff;
  border: 0.5px solid rgba(0, 113, 227, 0.22);
  color: #0071e3;
  padding: 4px 8px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: all 0.12s ease;
  font-family: inherit;
}

.lf-quick-chip:hover {
  background: rgba(0, 113, 227, 0.12);
  border-color: #0071e3;
  transform: translateY(-1px);
}

.lf-quick-preview-row {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 0.5px solid rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  font-size: 11.5px;
}

.lf-preview-label {
  font-weight: 700;
  color: #6e6e73;
  font-size: 10.5px;
  text-transform: uppercase;
}

.lf-see-all-btn {
  background: none;
  border: none;
  color: #0071e3;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  padding: 1px 4px;
  margin-left: auto;
}

.lf-see-all-btn:hover {
  text-decoration: underline;
}

.lf-content {
  padding: 12px 14px 22px 14px;
  flex: 1 1 auto;
  min-height: 0;
  max-height: min(380px, calc(100vh - 160px));
  overflow-y: scroll !important;
  overflow-x: hidden !important;
  overscroll-behavior: contain;
  background: transparent;
  overflow-wrap: break-word;
  word-break: break-word;
  scrollbar-gutter: stable;
  scrollbar-width: thin !important;
  scrollbar-color: #0071e3 rgba(0, 0, 0, 0.08) !important;
}

.lf-content::-webkit-scrollbar {
  width: 8px !important;
  display: block !important;
}

.lf-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.06) !important;
  border-radius: 99px !important;
  margin: 4px 0 !important;
}

.lf-content::-webkit-scrollbar-thumb {
  background: #0071e3 !important;
  border-radius: 99px !important;
  border: 1.5px solid #ffffff !important;
  background-clip: padding-box !important;
}

.lf-content::-webkit-scrollbar-thumb:hover {
  background: #005bb5 !important;
}

.lf-bengali-box {
  background: rgba(0, 113, 227, 0.08);
  border-left: 3.5px solid #0071e3;
  padding: 10px 14px;
  border-radius: 10px;
  margin-bottom: 12px;
}

.lf-bengali-meaning {
  font-family: "Kalpurush", "SolaimanLipi", "Noto Sans Bengali", -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: var(--lf-font-bengali, 18.5px) !important;
  font-weight: 600;
  color: #1d1d1f;
  margin-bottom: 3px;
  line-height: 1.55;
}

.lf-bengali-explanation {
  font-size: var(--lf-font-context, 15px) !important;
  color: #515154;
  line-height: 1.55;
}

.lf-def-item {
  margin-bottom: 10px;
}

.lf-def-text {
  font-size: var(--lf-font-english, 16px) !important;
  color: #1d1d1f;
  line-height: 1.55;
  margin-bottom: 4px;
}

.lf-def-example {
  font-size: var(--lf-font-example, 14px) !important;
  color: #515154;
  font-style: italic;
  padding-left: 10px;
  border-left: 2px solid rgba(0, 0, 0, 0.15);
}

.lf-easy-english-text {
  font-size: var(--lf-font-english, 16px) !important;
  color: #1d1d1f;
  line-height: 1.55;
  font-weight: 500;
}

.lf-easy-bengali-text {
  font-family: "Kalpurush", "SolaimanLipi", "Noto Sans Bengali", -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: var(--lf-font-bengali, 18.5px) !important;
  font-weight: 600;
  color: #1d1d1f;
  line-height: 1.6;
}

.lf-context-box {
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 10px;
}

.lf-context-text {
  font-size: var(--lf-font-context, 15px) !important;
  color: #1d1d1f;
  line-height: 1.55;
}

.lf-example-box {
  padding-left: 10px;
  border-left: 2.5px solid rgba(0, 113, 227, 0.5);
  font-size: var(--lf-font-example, 14px) !important;
  color: #515154;
  font-style: italic;
  margin-bottom: 10px;
}

.lf-example-text {
  font-size: var(--lf-font-example, 14px) !important;
  line-height: 1.55;
}

.lf-example-bengali {
  font-family: "Kalpurush", "SolaimanLipi", "Noto Sans Bengali", -apple-system, BlinkMacSystemFont, sans-serif;
  font-style: normal;
  color: #636366;
  font-size: calc(var(--lf-font-example, 14px) + 0.5px) !important;
  margin-top: 3px;
  line-height: 1.55;
}

.lf-section-sublabel {
  color: #6e6e73;
}

.lf-bengali-box-header {
  color: #0071e3;
}

.lf-target-badge {
  background: rgba(0, 113, 227, 0.12);
  color: #0071e3;
}

.lf-target-header {
  color: #0071e3;
}

.lf-context-label {
  color: #0071e3;
}

.lf-vocab-bengali {
  color: #0071e3;
}

.lf-vocab-meaning {
  color: #424245;
}

.lf-clause-role {
  color: #6e6e73;
}

.lf-clause-text {
  color: #1d1d1f;
}

.lf-clause-bengali {
  color: #6e6e73;
}

.lf-syntactic-title {
  color: #0071e3;
}

.lf-collocations-title,
.lf-idioms-title,
.lf-confusing-title {
  color: #6e6e73;
}

.lf-idiom-text,
.lf-confusing-text {
  color: #1d1d1f;
}

.lf-feedback-reason,
.lf-feedback-note {
  background: #ffffff;
  color: #1d1d1f;
}

.lf-honesty-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.lf-ai-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 600;
  color: #0071e3;
  background: rgba(0, 113, 227, 0.08);
  border: 0.5px solid rgba(0, 113, 227, 0.2);
  padding: 2px 7px;
  border-radius: 99px;
  letter-spacing: 0.02em;
}

.lf-confidence-pill {
  display: inline-flex;
  align-items: center;
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 99px;
  letter-spacing: 0.02em;
}

.lf-confidence-pill.high {
  background: rgba(0, 113, 227, 0.1);
  color: #0071e3;
}

.lf-confidence-pill.medium {
  background: rgba(232, 137, 12, 0.12);
  color: #e8890c;
}

.lf-confidence-pill.low {
  background: rgba(229, 72, 77, 0.12);
  color: #e5484d;
}

.lf-machine-voice-btn {
  background: rgba(120, 120, 128, 0.08);
  color: #6e6e73;
  border: 0.5px solid rgba(0, 0, 0, 0.08);
  border-radius: 99px;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  transition: all 0.12s ease;
}

.lf-machine-voice-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #1d1d1f;
}


.lf-synonyms-row {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.lf-synonym-tag {
  font-size: 11px;
  background: rgba(120, 120, 128, 0.12);
  color: #1d1d1f;
  padding: 2px 7px;
  border-radius: 99px;
  cursor: pointer;
  transition: background 0.12s ease;
  border: none;
}

.lf-synonym-tag:hover {
  background: rgba(0, 113, 227, 0.12);
  color: #0071e3;
}

.lf-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 12px;
  background: rgba(255, 255, 255, 0.92);
  border-top: 0.5px solid rgba(0, 0, 0, 0.08);
  font-size: 11px;
  color: #6e6e73;
  flex-shrink: 0;
  min-height: 40px;
  gap: 8px;
}

.lf-footer-left,
.lf-footer-right {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

/* Solid Blue Button (No Gradient, No Glow) */
.lf-btn-action {
  background: #0071e3;
  color: white;
  border: none;
  height: 28px;
  padding: 0 10px;
  border-radius: 99px;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.12s ease;
  white-space: nowrap;
  flex-shrink: 0;
  font-family: inherit;
}

.lf-btn-action:hover {
  filter: brightness(1.08);
  transform: translateY(-0.5px);
}

.lf-btn-action:active {
  transform: scale(0.97);
}

.lf-btn-action.secondary {
  background: rgba(120, 120, 128, 0.12);
  color: #0071e3;
}

.lf-btn-action.secondary:hover {
  background: rgba(120, 120, 128, 0.2);
}

.lf-btn-action.saved {
  background: rgba(0, 113, 227, 0.14);
  color: #0071e3;
  font-weight: 600;
}

/* Minimalist Floating Trigger Button */
.lf-trigger-btn {
  position: fixed;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #0071e3;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 113, 227, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.8);
  z-index: 2147483647;
  transition: transform 0.14s ease;
  animation: lfFadeIn 0.15s ease;
}

.lf-trigger-btn:hover {
  transform: scale(1.1);
}

.lf-loading-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28px 10px;
  gap: 10px;
  color: #6e6e73;
}

.lf-spinner {
  width: 22px;
  height: 22px;
  border: 2px solid rgba(0, 113, 227, 0.2);
  border-top-color: #0071e3;
  border-radius: 50%;
  animation: lfSpin 0.7s linear infinite;
}

@keyframes lfSpin {
  to { transform: rotate(360deg); }
}

/* Shimmer Animation & Skeleton Placeholder System */
@keyframes lfShimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.lf-shimmer {
  background: linear-gradient(
    90deg,
    rgba(120, 120, 128, 0.08) 25%,
    rgba(120, 120, 128, 0.18) 50%,
    rgba(120, 120, 128, 0.08) 75%
  );
  background-size: 200% 100%;
  animation: lfShimmer 1.6s ease-in-out infinite;
  border-radius: 6px;
}

.lf-shimmer-accent {
  background: linear-gradient(
    90deg,
    rgba(0, 113, 227, 0.08) 25%,
    rgba(0, 113, 227, 0.22) 50%,
    rgba(0, 113, 227, 0.08) 75%
  );
  background-size: 200% 100%;
  animation: lfShimmer 1.6s ease-in-out infinite;
  border-radius: 6px;
}

.lf-skeleton-content {
  overflow-y: hidden !important;
  scrollbar-gutter: auto !important;
  padding-bottom: 14px !important;
}

.lf-tabs-skeleton {
  pointer-events: none;
  user-select: none;
}

.lf-tabs-skeleton .lf-tab {
  cursor: default;
}

.lf-skeleton-line {
  display: block;
  border-radius: 6px;
}

.lf-skeleton-pill {
  display: inline-block;
  border-radius: 99px;
}

.lf-skeleton-chip {
  display: inline-block;
  border-radius: 6px;
}

.lf-skeleton-box {
  transition: opacity 0.2s ease;
}

.lf-skeleton-status {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 2px 2px 2px;
  color: #6e6e73;
  font-size: 12px;
  user-select: none;
}

.lf-skeleton-pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #0071e3;
  box-shadow: 0 0 0 0 rgba(0, 113, 227, 0.4);
  animation: lfPulseDot 1.4s infinite cubic-bezier(0.45, 0, 0.55, 1);
  flex-shrink: 0;
}

@keyframes lfPulseDot {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(0, 113, 227, 0.6);
  }
  70% {
    transform: scale(1.15);
    box-shadow: 0 0 0 6px rgba(0, 113, 227, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(0, 113, 227, 0);
  }
}

.lf-skeleton-status-text {
  font-size: 12px;
  font-weight: 500;
  color: #6e6e73;
  letter-spacing: -0.01em;
}

.lf-ai-badge {
  font-size: 10px;
  font-weight: 600;
  color: #6e6e73;
  background: rgba(120, 120, 128, 0.12);
  padding: 2px 6px;
  border-radius: 99px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.lf-confidence-pill {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 99px;
}
.lf-confidence-pill.high {
  background: rgba(0, 113, 227, 0.12);
  color: #0071e3;
}
.lf-confidence-pill.medium {
  background: rgba(232, 137, 12, 0.14);
  color: #e8890c;
}
.lf-confidence-pill.low {
  background: rgba(229, 72, 77, 0.14);
  color: #e5484d;
}

.lf-machine-voice-btn {
  font-size: 11px;
  color: #0071e3;
  background: rgba(120, 120, 128, 0.12);
  border: none;
  border-radius: 99px;
  padding: 2px 7px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  transition: background 0.12s ease;
}
.lf-machine-voice-btn:hover {
  background: rgba(120, 120, 128, 0.2);
}

.lf-sense-item {
  background: #ffffff;
  box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  padding: 9px 11px;
  margin-bottom: 8px;
}
.lf-sense-item.contextual {
  box-shadow: 0 0 0 1px #0071e3;
  background: rgba(0, 113, 227, 0.04);
}

.lf-badge-contextual {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #0071e3;
  background: rgba(0, 113, 227, 0.1);
  padding: 1px 6px;
  border-radius: 99px;
  margin-left: 5px;
}

.lf-feedback-box {
  background: #ffffff;
  box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  padding: 11px;
  margin-top: 8px;
  animation: lfFadeIn 0.15s ease;
}

.lf-sentence-card {
  background: #ffffff;
  box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  padding: 11px 12px;
  margin-bottom: 8px;
}

.lf-sentence-text {
  font-size: var(--lf-font-english, 16px);
  line-height: 1.6;
  color: #1d1d1f;
  font-weight: 500;
  word-break: break-word;
  overflow-wrap: break-word;
}

.lf-sentence-text.truncated {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.lf-sentence-word {
  display: inline;
  padding: 1px 2px;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.12s ease;
}

.lf-sentence-word:hover {
  background: rgba(0, 113, 227, 0.12);
  color: #0071e3;
}

.lf-sentence-hint {
  font-size: var(--lf-font-sublabel, 12px);
  color: #6e6e73;
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.lf-section-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--lf-font-sublabel, 12px);
  text-transform: uppercase;
  color: #6e6e73;
  font-weight: 700;
  margin-bottom: 6px;
  letter-spacing: 0.04em;
}

.lf-text-toggle-btn {
  background: none;
  border: none;
  color: #0071e3;
  font-size: var(--lf-font-sublabel, 12px);
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.lf-text-toggle-btn:hover {
  text-decoration: underline;
}

.lf-vocab-item {
  background: #ffffff;
  box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 6px;
}

.lf-vocab-chip-btn {
  background: rgba(0, 113, 227, 0.1);
  color: #0071e3;
  border: none;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: var(--lf-font-chip, 12.5px);
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  transition: background 0.12s ease;
}

.lf-vocab-chip-btn:hover {
  background: rgba(0, 113, 227, 0.18);
}

.lf-clause-item {
  background: rgba(120, 120, 128, 0.08);
  border-left: 3px solid #0071e3;
  padding: 8px 10px;
  margin-bottom: 6px;
  border-radius: 0 6px 6px 0;
}

.lf-phrase-breakdown-section {
  margin-bottom: 12px;
}

.lf-phrase-item {
  background: #ffffff;
  box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.08);
  border-left: 3.5px solid #0071e3;
  border-radius: 10px;
  padding: 9px 12px;
  margin-bottom: 8px;
}

.lf-phrase-orig {
  font-size: var(--lf-font-english, 15.5px);
  font-weight: 600;
  color: #1d1d1f;
  margin-bottom: 4px;
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.lf-phrase-num {
  font-size: 11px;
  font-weight: 700;
  color: #0071e3;
  background: rgba(0, 113, 227, 0.1);
  padding: 2px 6px;
  border-radius: 99px;
  flex-shrink: 0;
}

.lf-phrase-field {
  font-size: var(--lf-font-english, 15px);
  line-height: 1.5;
  margin-top: 3px;
}

.lf-field-label {
  font-size: var(--lf-font-sublabel, 12px);
  text-transform: uppercase;
  font-weight: 700;
  margin-right: 5px;
  letter-spacing: 0.03em;
}

.lf-phrase-english {
  color: #515154;
}

.lf-phrase-bengali {
  font-family: "Kalpurush", "SolaimanLipi", "Noto Sans Bengali", -apple-system, BlinkMacSystemFont, sans-serif;
  color: #1d1d1f;
  font-size: var(--lf-font-bengali, 17.5px) !important;
  font-weight: 600;
  line-height: 1.55;
}

.lf-phrase-bengali .lf-field-label {
  color: #0071e3;
}

/* Claude / Apple Intelligence Q&A Coach (Clean --fill Block, No Purple Gradient) */
.lf-ask-ai-panel {
  margin-top: 10px;
  background: rgba(120, 120, 128, 0.08);
  border-radius: 12px;
  padding: 12px;
  animation: lfFadeIn 0.16s ease;
}

.lf-qa-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
}

.lf-qa-brand {
  display: flex;
  align-items: center;
  gap: 6px;
}

.lf-qa-avatar-icon {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  background: #0071e3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: white;
}

.lf-qa-title {
  font-size: 12px;
  font-weight: 600;
  color: #1d1d1f;
}

.lf-qa-focus-tag {
  font-size: 10px;
  color: #0071e3;
  background: rgba(0, 113, 227, 0.1);
  padding: 1px 6px;
  border-radius: 99px;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lf-qa-controls {
  display: flex;
  align-items: center;
  gap: 3px;
}

.lf-qa-chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 8px;
}

.lf-qa-chip {
  background: #ffffff;
  box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.08);
  border-radius: 99px;
  padding: 4px 10px;
  font-size: var(--lf-font-chip, 12.5px);
  color: #0071e3;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s ease;
  user-select: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.lf-qa-chip:hover {
  background: rgba(0, 113, 227, 0.12);
}

.lf-qa-thread {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 10px;
}

.lf-chat-user {
  align-self: flex-end;
  max-width: 85%;
  background: #0071e3;
  border-radius: 12px 12px 3px 12px;
  padding: 7px 12px;
  color: #ffffff;
  font-size: var(--lf-font-base, 14.5px);
  line-height: 1.45;
  font-weight: 500;
}

.lf-chat-ai {
  align-self: flex-start;
  width: 100%;
  background: #ffffff;
  box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.08);
  border-left: 3px solid #0071e3;
  border-radius: 3px 12px 12px 12px;
  padding: 10px 13px;
  box-sizing: border-box;
}

.lf-ai-header-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--lf-font-sublabel, 11.5px);
  font-weight: 600;
  color: #0071e3;
  text-transform: uppercase;
  margin-bottom: 5px;
}

.lf-qa-takeaway-box {
  background: rgba(232, 137, 12, 0.12);
  border-radius: 8px;
  padding: 8px 11px;
  margin-bottom: 8px;
  font-size: var(--lf-font-base, 14px);
  color: #a05e07;
  line-height: 1.45;
}

.lf-qa-takeaway-label {
  font-size: var(--lf-font-sublabel, 11px);
  font-weight: 700;
  text-transform: uppercase;
  color: #e8890c;
  margin-right: 4px;
}

.lf-qa-body-text {
  font-size: var(--lf-font-english, 15.5px);
  color: #1d1d1f;
  line-height: 1.55;
  margin-bottom: 8px;
}

.lf-qa-bengali-card {
  background: rgba(0, 113, 227, 0.06);
  border-left: 2px solid #0071e3;
  border-radius: 0 8px 8px 0;
  padding: 8px 12px;
  margin-bottom: 8px;
}

.lf-qa-bengali-label {
  font-size: var(--lf-font-sublabel, 11.5px);
  font-weight: 700;
  color: #0071e3;
  text-transform: uppercase;
  margin-bottom: 3px;
}

.lf-qa-bengali-text {
  font-size: var(--lf-font-bengali, 17.5px);
  color: #1d1d1f;
  line-height: 1.5;
  font-weight: 500;
}

.lf-qa-examples-box {
  background: rgba(120, 120, 128, 0.08);
  border-radius: 8px;
  padding: 8px 11px;
  margin-bottom: 8px;
}

.lf-qa-example-item {
  font-size: var(--lf-font-example, 14px);
  color: #1d1d1f;
  line-height: 1.45;
  padding-left: 8px;
  border-left: 2px solid #0071e3;
  margin-bottom: 5px;
}

.lf-qa-example-bengali {
  font-size: var(--lf-font-base, 13.5px);
  color: #6e6e73;
  margin-top: 2px;
  line-height: 1.4;
}

.lf-qa-suggested-box {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 0.5px dashed rgba(0, 0, 0, 0.08);
}

.lf-qa-suggested-title {
  font-size: var(--lf-font-sublabel, 11px);
  font-weight: 600;
  color: #6e6e73;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 3px;
}

.lf-qa-suggested-chips {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lf-qa-suggested-chip {
  background: #ffffff;
  box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.08);
  border-radius: 7px;
  padding: 6px 11px;
  font-size: var(--lf-font-chip, 13px);
  color: #1d1d1f;
  cursor: pointer;
  text-align: left;
  transition: all 0.12s ease;
  display: flex;
  align-items: center;
  gap: 5px;
}

.lf-qa-suggested-chip:hover {
  background: rgba(0, 113, 227, 0.08);
  color: #0071e3;
  padding-left: 13px;
}

.lf-qa-actions-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  margin-top: 6px;
}

.lf-qa-mini-btn {
  font-size: var(--lf-font-sublabel, 11.5px);
  color: #6e6e73;
  background: #ffffff;
  box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.08);
  border: none;
  border-radius: 6px;
  padding: 3px 8px;
  cursor: pointer;
  transition: all 0.12s ease;
}

.lf-qa-mini-btn:hover {
  background: var(--hover);
  color: #1d1d1f;
}

.lf-thinking-box {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(0, 113, 227, 0.08);
  border-radius: 7px;
  font-size: var(--lf-font-base, 13px);
  color: #0071e3;
  animation: lfFadeIn 0.16s ease;
}

.lf-thinking-dots {
  display: flex;
  gap: 3px;
}

.lf-thinking-dots span {
  width: 4px;
  height: 4px;
  background: #0071e3;
  border-radius: 50%;
  animation: lfDotBounce 1.2s infinite ease-in-out;
}

.lf-thinking-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.lf-thinking-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes lfDotBounce {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.4;
  }
  40% {
    transform: scale(1.15);
    opacity: 1;
  }
}

.lf-qa-input-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #ffffff;
  box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.1);
  border-radius: 9px;
  padding: 4px 6px 4px 12px;
  transition: box-shadow 0.14s ease;
}

.lf-qa-input-bar:focus-within {
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.28);
}

.lf-qa-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #1d1d1f;
  font-size: var(--lf-font-base, 14px);
  line-height: 1.45;
  font-family: inherit;
  padding: 4px 0;
}

.lf-qa-input::placeholder {
  color: #a1a1a6;
}

.lf-qa-submit-btn {
  background: #0071e3;
  border: none;
  border-radius: 7px;
  color: #ffffff;
  font-weight: 600;
  font-size: var(--lf-font-base, 13px);
  padding: 6px 13px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: filter 0.12s ease;
}

.lf-qa-submit-btn:hover:not(:disabled) {
  filter: brightness(1.08);
}

.lf-qa-submit-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ============================================================
   Dark Mode System for In-Page Floating Popup
   ============================================================ */
:host([data-theme="dark"]),
.lexiflow-popup[data-theme="dark"],
.lexiflow-popup.theme-dark {
  background: rgba(28, 28, 30, 0.95);
  border-color: rgba(255, 255, 255, 0.14);
  box-shadow: 0 0 0 0.5px rgba(255, 255, 255, 0.1), inset 0 0.5px 0 rgba(255, 255, 255, 0.15), 0 24px 64px rgba(0, 0, 0, 0.6);
  color: #f5f5f7;
}

.lexiflow-popup[data-theme="dark"] .lf-header,
.lexiflow-popup.theme-dark .lf-header {
  background: rgba(36, 36, 38, 0.9);
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.08);
}

.lexiflow-popup[data-theme="dark"] .lf-word,
.lexiflow-popup[data-theme="dark"] .lf-heading-word,
.lexiflow-popup[data-theme="dark"] .lf-heading-sentence,
.lexiflow-popup.theme-dark .lf-word,
.lexiflow-popup.theme-dark .lf-heading-word,
.lexiflow-popup.theme-dark .lf-heading-sentence {
  color: #ffffff;
}

.lexiflow-popup[data-theme="dark"] .lf-drag-indicator,
.lexiflow-popup.theme-dark .lf-drag-indicator {
  color: #636366;
}

.lexiflow-popup[data-theme="dark"] .lf-drag-indicator:hover,
.lexiflow-popup.theme-dark .lf-drag-indicator:hover {
  color: #38bdf8;
}

.lexiflow-popup[data-theme="dark"] .lf-btn-icon,
.lexiflow-popup.theme-dark .lf-btn-icon {
  color: #a1a1a6;
}

.lexiflow-popup[data-theme="dark"] .lf-btn-icon:hover,
.lexiflow-popup.theme-dark .lf-btn-icon:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.lexiflow-popup[data-theme="dark"] .lf-zoom-btn,
.lexiflow-popup.theme-dark .lf-zoom-btn {
  background: rgba(56, 189, 248, 0.12);
  border-color: rgba(56, 189, 248, 0.3);
  color: #38bdf8;
}

.lexiflow-popup[data-theme="dark"] .lf-zoom-btn:hover,
.lexiflow-popup.theme-dark .lf-zoom-btn:hover {
  background: rgba(56, 189, 248, 0.22);
  color: #7dd3fc;
}

.lexiflow-popup[data-theme="dark"] .lf-tabs,
.lexiflow-popup.theme-dark .lf-tabs {
  background: rgba(255, 255, 255, 0.08);
}

.lexiflow-popup[data-theme="dark"] .lf-tab,
.lexiflow-popup.theme-dark .lf-tab {
  color: #a1a1a6;
}

.lexiflow-popup[data-theme="dark"] .lf-tab:hover,
.lexiflow-popup.theme-dark .lf-tab:hover {
  color: #ffffff;
}

.lexiflow-popup[data-theme="dark"] .lf-tab.active,
.lexiflow-popup.theme-dark .lf-tab.active {
  background: #2c2c2e;
  color: #38bdf8;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

/* All readable definitions, explanations and translations in Dark Mode: Crisp Pure White */
.lexiflow-popup[data-theme="dark"] .lf-def-text,
.lexiflow-popup[data-theme="dark"] .lf-easy-english-text,
.lexiflow-popup[data-theme="dark"] .lf-easy-bengali-text,
.lexiflow-popup[data-theme="dark"] .lf-bengali-meaning,
.lexiflow-popup[data-theme="dark"] .lf-context-text,
.lexiflow-popup[data-theme="dark"] .lf-sentence-text,
.lexiflow-popup[data-theme="dark"] .lf-phrase-orig,
.lexiflow-popup[data-theme="dark"] .lf-phrase-bengali,
.lexiflow-popup[data-theme="dark"] .lf-qa-body-text,
.lexiflow-popup[data-theme="dark"] .lf-qa-bengali-text,
.lexiflow-popup[data-theme="dark"] .lf-vocab-meaning,
.lexiflow-popup[data-theme="dark"] .lf-clause-text,
.lexiflow-popup[data-theme="dark"] .lf-idiom-text,
.lexiflow-popup[data-theme="dark"] .lf-confusing-text,
.lexiflow-popup.theme-dark .lf-def-text,
.lexiflow-popup.theme-dark .lf-easy-english-text,
.lexiflow-popup.theme-dark .lf-easy-bengali-text,
.lexiflow-popup.theme-dark .lf-bengali-meaning,
.lexiflow-popup.theme-dark .lf-context-text,
.lexiflow-popup.theme-dark .lf-sentence-text,
.lexiflow-popup.theme-dark .lf-phrase-orig,
.lexiflow-popup.theme-dark .lf-phrase-bengali,
.lexiflow-popup.theme-dark .lf-qa-body-text,
.lexiflow-popup.theme-dark .lf-qa-bengali-text,
.lexiflow-popup.theme-dark .lf-vocab-meaning,
.lexiflow-popup.theme-dark .lf-clause-text,
.lexiflow-popup.theme-dark .lf-idiom-text,
.lexiflow-popup.theme-dark .lf-confusing-text {
  color: #ffffff !important;
}

/* Sublabels, Section Labels & Metadata: Light Slate/Silver */
.lexiflow-popup[data-theme="dark"] .lf-section-sublabel,
.lexiflow-popup[data-theme="dark"] .lf-section-label,
.lexiflow-popup[data-theme="dark"] .lf-sublabel,
.lexiflow-popup.theme-dark .lf-section-sublabel,
.lexiflow-popup.theme-dark .lf-section-label,
.lexiflow-popup.theme-dark .lf-sublabel {
  color: #cbd5e1 !important;
}

/* Bengali Box & Language Headers in Dark Mode */
.lexiflow-popup[data-theme="dark"] .lf-bengali-box,
.lexiflow-popup.theme-dark .lf-bengali-box {
  background: rgba(56, 189, 248, 0.12) !important;
  border-left-color: #38bdf8 !important;
}

.lexiflow-popup[data-theme="dark"] .lf-bengali-box-header,
.lexiflow-popup[data-theme="dark"] .lf-target-header,
.lexiflow-popup[data-theme="dark"] .lf-context-label,
.lexiflow-popup[data-theme="dark"] .lf-vocab-bengali,
.lexiflow-popup[data-theme="dark"] .lf-syntactic-title,
.lexiflow-popup.theme-dark .lf-bengali-box-header,
.lexiflow-popup.theme-dark .lf-target-header,
.lexiflow-popup.theme-dark .lf-context-label,
.lexiflow-popup.theme-dark .lf-vocab-bengali,
.lexiflow-popup.theme-dark .lf-syntactic-title {
  color: #38bdf8 !important;
}

.lexiflow-popup[data-theme="dark"] .lf-target-badge,
.lexiflow-popup[data-theme="dark"] .lf-quick-target-badge,
.lexiflow-popup.theme-dark .lf-target-badge,
.lexiflow-popup.theme-dark .lf-quick-target-badge {
  background: rgba(56, 189, 248, 0.22) !important;
  color: #38bdf8 !important;
}

/* Context Box in Dark Mode */
.lexiflow-popup[data-theme="dark"] .lf-context-box,
.lexiflow-popup.theme-dark .lf-context-box {
  background: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

/* Natural Example & Highlights in Dark Mode */
.lexiflow-popup[data-theme="dark"] .lf-example-box,
.lexiflow-popup[data-theme="dark"] .lf-sense-example,
.lexiflow-popup.theme-dark .lf-example-box,
.lexiflow-popup.theme-dark .lf-sense-example {
  border-left-color: #38bdf8 !important;
}

.lexiflow-popup[data-theme="dark"] .lf-example-text,
.lexiflow-popup.theme-dark .lf-example-text {
  color: #f1f5f9 !important;
}

.lexiflow-popup[data-theme="dark"] .lf-example-bengali,
.lexiflow-popup[data-theme="dark"] .lf-bengali-explanation,
.lexiflow-popup[data-theme="dark"] .lf-def-example,
.lexiflow-popup.theme-dark .lf-example-bengali,
.lexiflow-popup.theme-dark .lf-bengali-explanation,
.lexiflow-popup.theme-dark .lf-def-example {
  color: #cbd5e1 !important;
  border-left-color: rgba(255, 255, 255, 0.16) !important;
}

/* Secondary Metadata & Titles in Dark Mode */
.lexiflow-popup[data-theme="dark"] .lf-clause-role,
.lexiflow-popup[data-theme="dark"] .lf-clause-bengali,
.lexiflow-popup[data-theme="dark"] .lf-collocations-title,
.lexiflow-popup[data-theme="dark"] .lf-idioms-title,
.lexiflow-popup[data-theme="dark"] .lf-confusing-title,
.lexiflow-popup[data-theme="dark"] .lf-preview-label,
.lexiflow-popup.theme-dark .lf-clause-role,
.lexiflow-popup.theme-dark .lf-clause-bengali,
.lexiflow-popup.theme-dark .lf-collocations-title,
.lexiflow-popup.theme-dark .lf-idioms-title,
.lexiflow-popup.theme-dark .lf-confusing-title,
.lexiflow-popup.theme-dark .lf-preview-label {
  color: #a1a1a6 !important;
}

/* Quick AI Chips & Triggers */
.lexiflow-popup[data-theme="dark"] .lf-quick-ai-box,
.lexiflow-popup.theme-dark .lf-quick-ai-box {
  background: rgba(56, 189, 248, 0.08);
  border-color: rgba(56, 189, 248, 0.22);
}

.lexiflow-popup[data-theme="dark"] .lf-quick-ai-title,
.lexiflow-popup.theme-dark .lf-quick-ai-title {
  color: #38bdf8;
}

.lexiflow-popup[data-theme="dark"] .lf-quick-chip,
.lexiflow-popup.theme-dark .lf-quick-chip {
  background: #242426;
  border-color: rgba(56, 189, 248, 0.35);
  color: #38bdf8;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

.lexiflow-popup[data-theme="dark"] .lf-quick-chip:hover,
.lexiflow-popup.theme-dark .lf-quick-chip:hover {
  background: rgba(56, 189, 248, 0.2);
  border-color: #38bdf8;
}

.lexiflow-popup[data-theme="dark"] .lf-quick-preview-row,
.lexiflow-popup.theme-dark .lf-quick-preview-row {
  border-top-color: rgba(255, 255, 255, 0.08);
}

.lexiflow-popup[data-theme="dark"] .lf-see-all-btn,
.lexiflow-popup.theme-dark .lf-see-all-btn {
  color: #38bdf8;
}

.lexiflow-popup[data-theme="dark"] .lf-synonym-tag,
.lexiflow-popup.theme-dark .lf-synonym-tag {
  background: rgba(255, 255, 255, 0.1) !important;
  color: #ffffff !important;
}

.lexiflow-popup[data-theme="dark"] .lf-synonym-tag:hover,
.lexiflow-popup.theme-dark .lf-synonym-tag:hover {
  background: rgba(56, 189, 248, 0.22) !important;
  color: #38bdf8 !important;
}

.lexiflow-popup[data-theme="dark"] .lf-honesty-bar,
.lexiflow-popup.theme-dark .lf-honesty-bar {
  border-top-color: rgba(255, 255, 255, 0.08);
}

.lexiflow-popup[data-theme="dark"] .lf-machine-voice-btn,
.lexiflow-popup.theme-dark .lf-machine-voice-btn {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
  color: #a1a1a6;
}

.lexiflow-popup[data-theme="dark"] .lf-machine-voice-btn:hover,
.lexiflow-popup.theme-dark .lf-machine-voice-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
}

.lexiflow-popup[data-theme="dark"] .lf-footer,
.lexiflow-popup.theme-dark .lf-footer {
  background: rgba(36, 36, 38, 0.92);
  border-top: 0.5px solid rgba(255, 255, 255, 0.08);
  color: #a1a1a6;
}

.lexiflow-popup[data-theme="dark"] .lf-btn-action.secondary,
.lexiflow-popup.theme-dark .lf-btn-action.secondary {
  background: rgba(255, 255, 255, 0.08);
  color: #38bdf8;
}

.lexiflow-popup[data-theme="dark"] .lf-btn-action.secondary:hover,
.lexiflow-popup.theme-dark .lf-btn-action.secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}

.lexiflow-popup[data-theme="dark"] .lf-btn-action.saved,
.lexiflow-popup.theme-dark .lf-btn-action.saved {
  background: rgba(56, 189, 248, 0.18);
  color: #38bdf8;
}

/* Detailed Cards & Lists */
.lexiflow-popup[data-theme="dark"] .lf-sense-item,
.lexiflow-popup[data-theme="dark"] .lf-sentence-card,
.lexiflow-popup[data-theme="dark"] .lf-vocab-item,
.lexiflow-popup[data-theme="dark"] .lf-phrase-item,
.lexiflow-popup.theme-dark .lf-sense-item,
.lexiflow-popup.theme-dark .lf-sentence-card,
.lexiflow-popup.theme-dark .lf-vocab-item,
.lexiflow-popup.theme-dark .lf-phrase-item {
  background: #242426;
  box-shadow: 0 0 0 0.5px rgba(255, 255, 255, 0.1);
}

.lexiflow-popup[data-theme="dark"] .lf-sense-item.contextual,
.lexiflow-popup.theme-dark .lf-sense-item.contextual {
  background: rgba(56, 189, 248, 0.08);
  box-shadow: 0 0 0 1px #38bdf8;
}

.lexiflow-popup[data-theme="dark"] .lf-sentence-text,
.lexiflow-popup.theme-dark .lf-sentence-text {
  color: #f5f5f7;
}

.lexiflow-popup[data-theme="dark"] .lf-sentence-hint,
.lexiflow-popup.theme-dark .lf-sentence-hint {
  color: #8e8e93;
}

.lexiflow-popup[data-theme="dark"] .lf-sentence-word:hover,
.lexiflow-popup.theme-dark .lf-sentence-word:hover {
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
}

.lexiflow-popup[data-theme="dark"] .lf-clause-item,
.lexiflow-popup.theme-dark .lf-clause-item {
  background: rgba(255, 255, 255, 0.06);
  border-left-color: #38bdf8;
}

.lexiflow-popup[data-theme="dark"] .lf-phrase-orig,
.lexiflow-popup.theme-dark .lf-phrase-orig {
  color: #ffffff;
}

.lexiflow-popup[data-theme="dark"] .lf-phrase-english,
.lexiflow-popup.theme-dark .lf-phrase-english {
  color: #a1a1a6;
}

.lexiflow-popup[data-theme="dark"] .lf-phrase-bengali,
.lexiflow-popup.theme-dark .lf-phrase-bengali {
  color: #ffffff;
}

/* Ask AI Coach in Dark Mode */
.lexiflow-popup[data-theme="dark"] .lf-ask-ai-panel,
.lexiflow-popup.theme-dark .lf-ask-ai-panel {
  background: rgba(255, 255, 255, 0.05);
}

.lexiflow-popup[data-theme="dark"] .lf-qa-header,
.lexiflow-popup.theme-dark .lf-qa-header {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.lexiflow-popup[data-theme="dark"] .lf-qa-title,
.lexiflow-popup.theme-dark .lf-qa-title {
  color: #ffffff;
}

.lexiflow-popup[data-theme="dark"] .lf-qa-chip,
.lexiflow-popup.theme-dark .lf-qa-chip {
  background: #242426;
  color: #38bdf8;
  box-shadow: 0 0 0 0.5px rgba(255, 255, 255, 0.1);
}

.lexiflow-popup[data-theme="dark"] .lf-qa-chip:hover,
.lexiflow-popup.theme-dark .lf-qa-chip:hover {
  background: rgba(56, 189, 248, 0.2);
}

.lexiflow-popup[data-theme="dark"] .lf-chat-ai,
.lexiflow-popup.theme-dark .lf-chat-ai {
  background: #242426;
  box-shadow: 0 0 0 0.5px rgba(255, 255, 255, 0.1);
  border-left-color: #38bdf8;
}

.lexiflow-popup[data-theme="dark"] .lf-qa-body-text,
.lexiflow-popup.theme-dark .lf-qa-body-text {
  color: #f5f5f7;
}

.lexiflow-popup[data-theme="dark"] .lf-qa-bengali-card,
.lexiflow-popup.theme-dark .lf-qa-bengali-card {
  background: rgba(56, 189, 248, 0.1);
  border-left-color: #38bdf8;
}

.lexiflow-popup[data-theme="dark"] .lf-qa-bengali-text,
.lexiflow-popup.theme-dark .lf-qa-bengali-text {
  color: #ffffff;
}

.lexiflow-popup[data-theme="dark"] .lf-qa-examples-box,
.lexiflow-popup.theme-dark .lf-qa-examples-box {
  background: rgba(255, 255, 255, 0.05);
}

.lexiflow-popup[data-theme="dark"] .lf-qa-example-item,
.lexiflow-popup.theme-dark .lf-qa-example-item {
  color: #e5e5ea;
  border-left-color: #38bdf8;
}

.lexiflow-popup[data-theme="dark"] .lf-qa-suggested-chip,
.lexiflow-popup.theme-dark .lf-qa-suggested-chip {
  background: #242426;
  box-shadow: 0 0 0 0.5px rgba(255, 255, 255, 0.1);
  color: #f5f5f7;
}

.lexiflow-popup[data-theme="dark"] .lf-qa-suggested-chip:hover,
.lexiflow-popup.theme-dark .lf-qa-suggested-chip:hover {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
}

.lexiflow-popup[data-theme="dark"] .lf-qa-input-bar,
.lexiflow-popup.theme-dark .lf-qa-input-bar {
  background: #242426;
  box-shadow: 0 0 0 0.5px rgba(255, 255, 255, 0.15);
}

.lexiflow-popup[data-theme="dark"] .lf-qa-input-bar:focus-within,
.lexiflow-popup.theme-dark .lf-qa-input-bar:focus-within {
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.35);
}

.lexiflow-popup[data-theme="dark"] .lf-qa-input,
.lexiflow-popup.theme-dark .lf-qa-input {
  color: #f5f5f7;
}

.lexiflow-popup[data-theme="dark"] .lf-feedback-box,
.lexiflow-popup.theme-dark .lf-feedback-box {
  background: #242426;
  box-shadow: 0 0 0 0.5px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.4);
}

.lexiflow-popup[data-theme="dark"] .lf-feedback-reason,
.lexiflow-popup[data-theme="dark"] .lf-feedback-note,
.lexiflow-popup.theme-dark .lf-feedback-reason,
.lexiflow-popup.theme-dark .lf-feedback-note {
  background: #1c1c1e !important;
  color: #ffffff !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
}

/* Bulletproof Global Text Contrast Safeguard for Dark Mode */
.lexiflow-popup[data-theme="dark"] [style*="color: #1d1d1f"],
.lexiflow-popup[data-theme="dark"] [style*="color:#1d1d1f"],
.lexiflow-popup[data-theme="dark"] [style*="color: #424245"],
.lexiflow-popup[data-theme="dark"] [style*="color:#424245"],
.lexiflow-popup[data-theme="dark"] [style*="color: #515154"],
.lexiflow-popup[data-theme="dark"] [style*="color:#515154"],
.lexiflow-popup.theme-dark [style*="color: #1d1d1f"],
.lexiflow-popup.theme-dark [style*="color:#1d1d1f"],
.lexiflow-popup.theme-dark [style*="color: #424245"],
.lexiflow-popup.theme-dark [style*="color:#424245"],
.lexiflow-popup.theme-dark [style*="color: #515154"],
.lexiflow-popup.theme-dark [style*="color:#515154"] {
  color: #ffffff !important;
}

.lexiflow-popup[data-theme="dark"] [style*="color: #0071e3"],
.lexiflow-popup[data-theme="dark"] [style*="color:#0071e3"],
.lexiflow-popup.theme-dark [style*="color: #0071e3"],
.lexiflow-popup.theme-dark [style*="color:#0071e3"] {
  color: #38bdf8 !important;
}

.lexiflow-popup[data-theme="dark"] [style*="color: #86868b"],
.lexiflow-popup[data-theme="dark"] [style*="color:#86868b"],
.lexiflow-popup[data-theme="dark"] [style*="color: #6e6e73"],
.lexiflow-popup[data-theme="dark"] [style*="color:#6e6e73"],
.lexiflow-popup.theme-dark [style*="color: #86868b"],
.lexiflow-popup.theme-dark [style*="color:#86868b"],
.lexiflow-popup.theme-dark [style*="color: #6e6e73"],
.lexiflow-popup.theme-dark [style*="color:#6e6e73"] {
  color: #cbd5e1 !important;
}

.lexiflow-popup[data-theme="dark"] [style*="background: rgba(0, 0, 0, 0.04)"],
.lexiflow-popup[data-theme="dark"] [style*="background: rgba(0, 0, 0, 0.03)"],
.lexiflow-popup[data-theme="dark"] [style*="background: rgba(0,0,0,0.04)"],
.lexiflow-popup.theme-dark [style*="background: rgba(0, 0, 0, 0.04)"],
.lexiflow-popup.theme-dark [style*="background: rgba(0, 0, 0, 0.03)"],
.lexiflow-popup.theme-dark [style*="background: rgba(0,0,0,0.04)"] {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #ffffff !important;
}

.lexiflow-popup[data-theme="dark"] .lf-content::-webkit-scrollbar-track,
.lexiflow-popup.theme-dark .lf-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05) !important;
}

.lexiflow-popup[data-theme="dark"] .lf-content::-webkit-scrollbar-thumb,
.lexiflow-popup.theme-dark .lf-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.25) !important;
  border: 1.5px solid #1c1c1e !important;
}

.lexiflow-popup[data-theme="dark"] .lf-content::-webkit-scrollbar-thumb:hover,
.lexiflow-popup.theme-dark .lf-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4) !important;
}

@media (prefers-reduced-motion: reduce) {
  .lexiflow-popup,
  .lf-spinner,
  .lf-trigger-btn {
    animation: none !important;
    transition: none !important;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .lexiflow-popup {
    background: #ffffff !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
}

/* ========================================================
   FEATURE A: AI HIGHLIGHT TOOLBAR & SUMMARY DRAWER STYLES
   ======================================================== */
.lexiflow-highlight-toolbar-container {
  display: none !important;
  position: fixed;
  bottom: 24px;
  right: 28px;
  z-index: 2147483646;
  pointer-events: none;
}

.lf-hl-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(28, 28, 30, 0.92);
  border: 0.5px solid rgba(255, 255, 255, 0.15);
  border-radius: 999px;
  padding: 6px 14px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  color: #ffffff;
  user-select: none;
}

.lf-hl-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}

.lf-hl-sparkle {
  font-size: 14px;
}

.lf-hl-title {
  color: #f5f5f7;
  letter-spacing: -0.01em;
}

.lf-hl-badge {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: #a1a1a6;
  font-weight: 500;
}

.lf-hl-badge.active {
  background: rgba(0, 113, 227, 0.25);
  color: #2997ff;
  font-weight: 600;
}

.lf-hl-divider {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.16);
}

.lf-hl-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.lf-hl-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 0.5px solid rgba(255, 255, 255, 0.12);
  color: #f5f5f7;
  padding: 5px 12px;
  border-radius: 14px;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: all 0.18s ease;
}

.lf-hl-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  transform: translateY(-1px);
}

.lf-hl-btn.primary {
  background: #0071e3;
  color: #ffffff;
  border-color: #0071e3;
  font-weight: 600;
}

.lf-hl-btn.primary:hover {
  background: #0077ed;
  box-shadow: 0 2px 10px rgba(0, 113, 227, 0.4);
}

.lf-hl-btn.active {
  background: rgba(0, 113, 227, 0.3);
  color: #2997ff;
  border-color: rgba(41, 151, 255, 0.5);
}

.lf-hl-btn-icon {
  background: rgba(255, 255, 255, 0.08);
  border: 0.5px solid rgba(255, 255, 255, 0.1);
  color: #f5f5f7;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s ease;
}

.lf-hl-btn-icon:hover {
  background: rgba(255, 255, 255, 0.2);
}

.lf-hl-btn-icon.danger:hover {
  background: rgba(255, 69, 58, 0.3);
  color: #ff453a;
}

.lf-hl-nav-group {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(0, 0, 0, 0.25);
  padding: 2px 4px;
  border-radius: 16px;
}

.lf-hl-counter {
  font-size: 11.5px;
  font-weight: 600;
  color: #2997ff;
  min-width: 24px;
  text-align: center;
}

.lf-hl-filters {
  display: flex;
  align-items: center;
  gap: 4px;
}

.lf-hl-chip {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  border: 0.5px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: #86868b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.lf-hl-chip.selected {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.4);
}

.lf-hl-colors {
  display: flex;
  align-items: center;
  gap: 5px;
  padding-left: 2px;
}

.lf-hl-color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1.5px solid transparent;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.lf-hl-color-dot.color-yellow { background-color: #facc15; }
.lf-hl-color-dot.color-blue   { background-color: #3b82f6; }
.lf-hl-color-dot.color-green  { background-color: #22c55e; }
.lf-hl-color-dot.color-pink   { background-color: #ec4899; }
.lf-hl-color-dot.color-purple { background-color: #a855f7; }

.lf-hl-color-dot:hover {
  transform: scale(1.25);
}

.lf-hl-color-dot.active {
  border-color: #ffffff;
  transform: scale(1.2);
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.6);
}

/* Summary Drawer */
.lf-hl-summary-card {
  width: 360px;
  max-height: 480px;
  background: rgba(28, 28, 30, 0.96);
  border: 0.5px solid rgba(255, 255, 255, 0.15);
  border-radius: 18px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: lf-fade-up 0.22s ease-out;
}

@keyframes lf-fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.lf-hl-summary-header {
  padding: 14px 16px 10px;
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.lf-hl-summary-title {
  font-size: 14.5px;
  font-weight: 600;
  color: #f5f5f7;
  margin-bottom: 2px;
}

.lf-hl-summary-subtitle {
  font-size: 11.5px;
  color: #86868b;
  line-height: 1.35;
}

.lf-hl-summary-list {
  padding: 8px 12px;
  overflow-y: auto;
  max-height: 380px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lf-hl-summary-item {
  background: rgba(255, 255, 255, 0.05);
  border: 0.5px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 9px 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.lf-hl-summary-item:hover {
  background: rgba(0, 113, 227, 0.15);
  border-color: rgba(0, 113, 227, 0.35);
  transform: translateX(2px);
}

.lf-hl-summary-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.lf-hl-summary-term {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  color: #ffffff;
}

.lf-hl-type-tag {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  letter-spacing: 0.04em;
}

.lf-hl-type-tag.type-word { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
.lf-hl-type-tag.type-phrase { background: rgba(168, 85, 247, 0.2); color: #c084fc; }
.lf-hl-type-tag.type-idiom { background: rgba(236, 72, 153, 0.2); color: #f472b6; }

.lf-hl-diff-badge {
  font-size: 9.5px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  text-transform: capitalize;
}

.lf-hl-diff-badge.diff-easy { background: rgba(34, 197, 94, 0.15); color: #4ade80; }
.lf-hl-diff-badge.diff-medium { background: rgba(234, 179, 8, 0.15); color: #facc15; }
.lf-hl-diff-badge.diff-hard { background: rgba(239, 68, 68, 0.15); color: #f87171; }

.lf-hl-summary-meaning {
  font-size: 12px;
  color: #d1d1d6;
  margin-bottom: 2px;
  line-height: 1.35;
}

.lf-hl-summary-bengali {
  font-size: 12.5px;
  color: #30d158;
  font-weight: 500;
}

/* ========================================================
   FEATURE B: 9-LAYER GRAMMAR & CLAUSES UPGRADE STYLES
   ======================================================== */
.lf-grammar-section-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #0071e3;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.lexiflow-popup[data-theme="dark"] .lf-grammar-section-title,
.lexiflow-popup.theme-dark .lf-grammar-section-title {
  color: #2997ff;
}

.lf-structure-card {
  background: rgba(0, 113, 227, 0.05);
  border: 1px solid rgba(0, 113, 227, 0.15);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 14px;
}

.lexiflow-popup[data-theme="dark"] .lf-structure-card,
.lexiflow-popup.theme-dark .lf-structure-card {
  background: rgba(41, 151, 255, 0.08);
  border-color: rgba(41, 151, 255, 0.2);
}

.lf-structure-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.lf-structure-type-pill {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  background: #0071e3;
  color: #ffffff;
  padding: 2px 8px;
  border-radius: 6px;
}

.lf-structure-expl {
  font-size: 13px;
  color: #3a3a3c;
  line-height: 1.45;
  margin-bottom: 4px;
}

.lexiflow-popup[data-theme="dark"] .lf-structure-expl,
.lexiflow-popup.theme-dark .lf-structure-expl {
  color: #e5e5ea;
}

.lf-structure-expl-bn {
  font-size: 13.5px;
  color: #0071e3;
  font-weight: 600;
  line-height: 1.45;
}

.lexiflow-popup[data-theme="dark"] .lf-structure-expl-bn,
.lexiflow-popup.theme-dark .lf-structure-expl-bn {
  color: #2997ff;
}

/* Layer 4: Structure Map Visual Tree */
.lf-structure-map-tree {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
  border: 1px dashed rgba(0, 0, 0, 0.12);
}

.lexiflow-popup[data-theme="dark"] .lf-structure-map-tree,
.lexiflow-popup.theme-dark .lf-structure-map-tree {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.12);
}

.lf-map-node {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.8);
  border: 0.5px solid rgba(0, 0, 0, 0.08);
}

.lexiflow-popup[data-theme="dark"] .lf-map-node,
.lexiflow-popup.theme-dark .lf-map-node {
  background: rgba(44, 44, 46, 0.9);
  border-color: rgba(255, 255, 255, 0.08);
}

.lf-map-node.is-main {
  border-left: 3.5px solid #0071e3;
}

.lf-map-relation-pill {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(0, 113, 227, 0.1);
  color: #0071e3;
  white-space: nowrap;
}

.lexiflow-popup[data-theme="dark"] .lf-map-relation-pill,
.lexiflow-popup.theme-dark .lf-map-relation-pill {
  background: rgba(41, 151, 255, 0.2);
  color: #2997ff;
}

/* Layer 5: Grammar Rule Cards (7-Item formula) */
.lf-rule-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 12px;
  transition: box-shadow 0.15s ease;
}

.lexiflow-popup[data-theme="dark"] .lf-rule-card,
.lexiflow-popup.theme-dark .lf-rule-card {
  background: rgba(36, 36, 38, 0.85);
  border-color: rgba(255, 255, 255, 0.08);
}

.lf-rule-name {
  font-size: 13.5px;
  font-weight: 700;
  color: #1d1d1f;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.lexiflow-popup[data-theme="dark"] .lf-rule-name,
.lexiflow-popup.theme-dark .lf-rule-name {
  color: #ffffff;
}

.lf-rule-formula-box {
  background: rgba(255, 149, 0, 0.08);
  border-left: 3px solid #ff9500;
  padding: 6px 10px;
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  font-weight: 600;
  color: #d97706;
  margin: 6px 0;
}

.lexiflow-popup[data-theme="dark"] .lf-rule-formula-box,
.lexiflow-popup.theme-dark .lf-rule-formula-box {
  background: rgba(255, 159, 10, 0.15);
  color: #ff9f0a;
}

.lf-rule-confusion-box {
  background: rgba(255, 59, 48, 0.06);
  border-left: 3px solid #ff3b30;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  color: #b91c1c;
  margin-top: 6px;
}

.lexiflow-popup[data-theme="dark"] .lf-rule-confusion-box,
.lexiflow-popup.theme-dark .lf-rule-confusion-box {
  background: rgba(255, 69, 58, 0.12);
  color: #ff453a;
}

/* Layer 6: Connectors */
.lf-connector-box {
  background: rgba(52, 199, 89, 0.06);
  border: 1px solid rgba(52, 199, 89, 0.2);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 12px;
}

.lexiflow-popup[data-theme="dark"] .lf-connector-box,
.lexiflow-popup.theme-dark .lf-connector-box {
  background: rgba(48, 209, 88, 0.1);
  border-color: rgba(48, 209, 88, 0.25);
}

/* Layer 9: Practice Quiz Card */
.lf-practice-box {
  background: linear-gradient(135deg, rgba(0, 113, 227, 0.08) 0%, rgba(175, 82, 222, 0.08) 100%);
  border: 1px solid rgba(0, 113, 227, 0.2);
  border-radius: 14px;
  padding: 14px 16px;
  margin-top: 14px;
}

.lexiflow-popup[data-theme="dark"] .lf-practice-box,
.lexiflow-popup.theme-dark .lf-practice-box {
  background: linear-gradient(135deg, rgba(41, 151, 255, 0.12) 0%, rgba(191, 90, 242, 0.12) 100%);
  border-color: rgba(41, 151, 255, 0.3);
}

.lf-practice-q {
  font-size: 13.5px;
  font-weight: 600;
  color: #1d1d1f;
  margin-bottom: 10px;
}

.lexiflow-popup[data-theme="dark"] .lf-practice-q,
.lexiflow-popup.theme-dark .lf-practice-q {
  color: #ffffff;
}

.lf-practice-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.lf-practice-opt-btn {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 12.5px;
  cursor: pointer;
  color: #1d1d1f;
  transition: all 0.15s ease;
}

.lexiflow-popup[data-theme="dark"] .lf-practice-opt-btn,
.lexiflow-popup.theme-dark .lf-practice-opt-btn {
  background: rgba(44, 44, 46, 0.9);
  border-color: rgba(255, 255, 255, 0.12);
  color: #f5f5f7;
}

.lf-practice-opt-btn:hover {
  background: rgba(0, 113, 227, 0.12);
  border-color: #0071e3;
}

.lf-practice-answer-reveal {
  background: rgba(52, 199, 89, 0.1);
  border-left: 3px solid #34c759;
  padding: 8px 12px;
  border-radius: 6px;
  margin-top: 8px;
  font-size: 12.5px;
  line-height: 1.45;
}

.lexiflow-popup[data-theme="dark"] .lf-practice-answer-reveal,
.lexiflow-popup.theme-dark .lf-practice-answer-reveal {
  background: rgba(48, 209, 88, 0.15);
  border-color: #30d158;
}
`;
