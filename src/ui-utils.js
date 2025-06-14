/*
 * Tooltip utilities
 * Provides a single helper to make sure the tooltip CSS used across the
 * extension is injected exactly once.
 */

/**
 * Injects the tooltip styles into <head> if they are not already present.
 */
export function ensureTooltipStyles() {
  if (document.getElementById('slack-helper-tooltip-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'slack-helper-tooltip-styles';
  style.textContent = `
    [data-tooltip] {
      position: relative;
    }
    [data-tooltip]::after {
      content: attr(data-tooltip);
      position: absolute;
      top: 110%;
      left: 75%;
      transform: translateX(-75%);
      background: rgba(0, 0, 0, 0.75);
      color: #fff;
      padding: 4px 8px;
      border-radius: 4px;
      white-space: nowrap;
      font-size: 12px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.1s ease-in-out;
      z-index: 10000;
    }
    [data-tooltip]:hover::after {
      opacity: 1;
    }
  `;

  document.head.appendChild(style);
} 