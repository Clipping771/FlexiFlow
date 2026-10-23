// Scoped CSS styles injected directly into Shadow DOM root for complete isolation.
// The stylesheet lives in popupStyles.css so editors and linters can check it as real CSS.
import popupStyles from './popupStyles.css?raw';

export const POPUP_STYLES: string = popupStyles;
