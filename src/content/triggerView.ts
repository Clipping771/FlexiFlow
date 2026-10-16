export class TriggerView {
  private element: HTMLElement;
  private onClickHandler: () => void;

  constructor(onClick: () => void) {
    this.onClickHandler = onClick;
    this.element = document.createElement('div');
    this.element.className = 'lf-trigger-btn';
    this.element.title = 'Look up in LexiFlow';
    this.element.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
      </svg>
    `;

    this.element.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
    });

    this.element.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.onClickHandler();
    });
  }

  getElement(): HTMLElement {
    return this.element;
  }

  setPosition(x: number, y: number): void {
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
  }
}
