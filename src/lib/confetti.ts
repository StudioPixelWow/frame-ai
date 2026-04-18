/**
 * Lightweight CSS-based confetti burst.
 * No external dependencies — appends DOM elements that auto-remove.
 */

const COLORS = ['#00B5FE', '#22C55E', '#F59E0B', '#8b5cf6', '#EF4444', '#ec4899', '#00D9FF'];
const SHAPES = ['50%', '2px', '0'];

export function fireConfetti(count = 40, durationMs = 3200) {
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '99999',
    overflow: 'hidden',
  });
  document.body.appendChild(container);

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    const size = 6 + Math.random() * 6;
    const x = 40 + Math.random() * 20; // center-ish
    const drift = -30 + Math.random() * 60;
    const delay = Math.random() * 0.6;
    const dur = 2.2 + Math.random() * 1.8;

    Object.assign(el.style, {
      position: 'absolute',
      left: `${x}%`,
      top: '-12px',
      width: `${size}px`,
      height: `${size}px`,
      background: COLORS[i % COLORS.length],
      borderRadius: SHAPES[i % SHAPES.length],
      opacity: '0',
      animation: `confetti-fall ${dur}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}s forwards`,
      ['--drift' as any]: `${drift}px`,
    });
    container.appendChild(el);
  }

  setTimeout(() => container.remove(), durationMs);
}
