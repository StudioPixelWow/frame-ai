/**
 * Design Preview Renderer — Converts DesignJSON to self-contained HTML
 *
 * Takes a DesignJSON and produces a self-contained HTML string that can
 * be rendered as a preview. All CSS is inlined, no external dependencies.
 * Supports RTL, percentage-based positioning, and all element types.
 *
 * Server-side only.
 */
import type { DesignJSON, DesignElement, DesignElementStyle } from '@/lib/db/schema';

/* ── Style Builder ───────────────────────────────────────────────────── */

/** Convert a DesignElementStyle object to an inline CSS string */
function buildInlineStyle(style: DesignElementStyle): string {
  const parts: string[] = [];

  if (style.backgroundColor) parts.push(`background-color:${style.backgroundColor}`);
  if (style.color) parts.push(`color:${style.color}`);
  if (style.fontSize) parts.push(`font-size:${style.fontSize}px`);
  if (style.fontFamily) parts.push(`font-family:${style.fontFamily}`);
  if (style.fontWeight) parts.push(`font-weight:${style.fontWeight}`);
  if (style.textAlign) parts.push(`text-align:${style.textAlign}`);
  if (style.borderRadius !== undefined) parts.push(`border-radius:${style.borderRadius}px`);
  if (style.padding !== undefined) parts.push(`padding:${style.padding}px`);
  if (style.border) parts.push(`border:${style.border}`);
  if (style.shadow) parts.push(`box-shadow:${style.shadow}`);
  if (style.opacity !== undefined && style.opacity !== 1) parts.push(`opacity:${style.opacity}`);
  if (style.gradient) parts.push(`background:${style.gradient}`);

  return parts.join(';');
}

/** Build positioning style for an element (percentage-based absolute) */
function buildPositionStyle(el: DesignElement): string {
  const parts = [
    'position:absolute',
    `left:${el.x}%`,
    `top:${el.y}%`,
    `width:${el.width}%`,
    `height:${el.height}%`,
    `z-index:${el.zIndex}`,
  ];

  if (el.rotation) {
    parts.push(`transform:rotate(${el.rotation}deg)`);
  }

  return parts.join(';');
}

/* ── Element Renderers ───────────────────────────────────────────────── */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderHeadline(el: DesignElement): string {
  const text = escapeHtml(el.props?.text || '');
  const pos = buildPositionStyle(el);
  const style = buildInlineStyle(el.style);
  return `<div style="${pos};display:flex;align-items:center;justify-content:flex-start">
    <h1 style="${style};margin:0;line-height:1.2;width:100%">${text}</h1>
  </div>`;
}

function renderSubtitle(el: DesignElement): string {
  const text = escapeHtml(el.props?.text || '');
  const pos = buildPositionStyle(el);
  const style = buildInlineStyle(el.style);
  return `<div style="${pos};display:flex;align-items:center;justify-content:flex-start">
    <h2 style="${style};margin:0;line-height:1.3;width:100%">${text}</h2>
  </div>`;
}

function renderBodyText(el: DesignElement): string {
  const text = escapeHtml(el.props?.text || '');
  const pos = buildPositionStyle(el);
  const style = buildInlineStyle(el.style);
  return `<div style="${pos};overflow:hidden">
    <p style="${style};margin:0;line-height:1.5;width:100%">${text}</p>
  </div>`;
}

function renderCtaButton(el: DesignElement): string {
  const text = escapeHtml(el.props?.text || '');
  const pos = buildPositionStyle(el);
  const style = buildInlineStyle(el.style);
  return `<div style="${pos};display:flex;align-items:center;justify-content:center">
    <a href="#" style="${style};display:flex;align-items:center;justify-content:center;text-decoration:none;width:100%;height:100%;box-sizing:border-box;cursor:pointer">${text}</a>
  </div>`;
}

function renderImage(el: DesignElement): string {
  const src = el.props?.src || '';
  const alt = escapeHtml(el.props?.alt || 'תמונה');
  const objectFit = el.props?.objectFit || 'cover';
  const pos = buildPositionStyle(el);
  const style = buildInlineStyle(el.style);

  if (src) {
    return `<div style="${pos};overflow:hidden;${style}">
      <img src="${escapeHtml(src)}" alt="${alt}" style="width:100%;height:100%;object-fit:${objectFit};display:block" />
    </div>`;
  }

  // Placeholder when no image source
  return `<div style="${pos};overflow:hidden;${style};background-color:#E0E0E0;display:flex;align-items:center;justify-content:center">
    <span style="color:#999;font-size:14px;font-family:Arial,sans-serif">📷</span>
  </div>`;
}

function renderLogo(el: DesignElement): string {
  const src = el.props?.src || '';
  const alt = escapeHtml(el.props?.alt || 'לוגו');
  const pos = buildPositionStyle(el);
  const style = buildInlineStyle(el.style);

  if (src) {
    return `<div style="${pos};${style}">
      <img src="${escapeHtml(src)}" alt="${alt}" style="width:100%;height:100%;object-fit:contain" />
    </div>`;
  }

  return `<div style="${pos};${style};display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.1);border-radius:4px">
    <span style="color:#999;font-size:12px;font-family:Arial,sans-serif">LOGO</span>
  </div>`;
}

function renderBadge(el: DesignElement): string {
  const text = escapeHtml(el.props?.text || '');
  const pos = buildPositionStyle(el);
  const style = buildInlineStyle(el.style);
  return `<div style="${pos};display:flex;align-items:center;justify-content:center">
    <span style="${style};display:flex;align-items:center;justify-content:center;width:100%;height:100%;box-sizing:border-box;white-space:nowrap">${text}</span>
  </div>`;
}

function renderDivider(el: DesignElement): string {
  const pos = buildPositionStyle(el);
  const style = buildInlineStyle(el.style);
  return `<div style="${pos}">
    <hr style="border:none;height:100%;width:100%;margin:0;${style}" />
  </div>`;
}

function renderOverlay(el: DesignElement): string {
  const pos = buildPositionStyle(el);
  const gradient = el.props?.gradient || '';
  const style = buildInlineStyle(el.style);
  const bg = gradient ? `background:${gradient}` : style;
  return `<div style="${pos};${bg};pointer-events:none"></div>`;
}

function renderShape(el: DesignElement): string {
  const pos = buildPositionStyle(el);
  const style = buildInlineStyle(el.style);
  return `<div style="${pos};${style}"></div>`;
}

function renderFeatureList(el: DesignElement): string {
  const items: string[] = el.props?.items || [];
  const icon = escapeHtml(el.props?.icon || '✓');
  const pos = buildPositionStyle(el);
  const style = buildInlineStyle(el.style);

  const listItems = items
    .map(
      (item) =>
        `<li style="margin-bottom:6px;display:flex;align-items:center;gap:8px">
          <span style="flex-shrink:0">${icon}</span>
          <span>${escapeHtml(item)}</span>
        </li>`
    )
    .join('');

  return `<div style="${pos};overflow:hidden">
    <ul style="${style};list-style:none;margin:0;padding:0;width:100%;box-sizing:border-box">${listItems}</ul>
  </div>`;
}

function renderContactBlock(el: DesignElement): string {
  const phone = escapeHtml(el.props?.phone || '');
  const email = escapeHtml(el.props?.email || '');
  const pos = buildPositionStyle(el);
  const style = buildInlineStyle(el.style);

  const parts: string[] = [];
  if (phone) parts.push(`<span>📞 ${phone}</span>`);
  if (email) parts.push(`<span>✉️ ${email}</span>`);

  return `<div style="${pos};display:flex;align-items:center;justify-content:flex-start;gap:16px">
    <div style="${style};display:flex;gap:16px;align-items:center;width:100%">${parts.join('')}</div>
  </div>`;
}

function renderOfferBlock(el: DesignElement): string {
  const price = escapeHtml(el.props?.price || '');
  const description = escapeHtml(el.props?.description || '');
  const currency = escapeHtml(el.props?.currency || '₪');
  const pos = buildPositionStyle(el);
  const style = buildInlineStyle(el.style);
  const priceFontSize = (el.style.fontSize || 36);
  const descFontSize = Math.round(priceFontSize * 0.45);

  return `<div style="${pos};display:flex;flex-direction:column;justify-content:center;${style};box-sizing:border-box">
    <div style="font-size:${priceFontSize}px;font-weight:800;line-height:1.1">${currency}${price}</div>
    ${description ? `<div style="font-size:${descFontSize}px;opacity:0.8;margin-top:4px">${description}</div>` : ''}
  </div>`;
}

function renderStatisticBlock(el: DesignElement): string {
  const value = escapeHtml(el.props?.value || '');
  const label = escapeHtml(el.props?.label || '');
  const unit = escapeHtml(el.props?.unit || '');
  const pos = buildPositionStyle(el);
  const style = buildInlineStyle(el.style);
  const valueFontSize = el.style.fontSize || 42;
  const labelFontSize = Math.round(valueFontSize * 0.4);

  return `<div style="${pos};display:flex;flex-direction:column;align-items:center;justify-content:center;${style}">
    <div style="font-size:${valueFontSize}px;font-weight:800;line-height:1.1">${value}${unit}</div>
    <div style="font-size:${labelFontSize}px;opacity:0.7;margin-top:4px">${label}</div>
  </div>`;
}

function renderTestimonialBlock(el: DesignElement): string {
  const quote = escapeHtml(el.props?.quote || '');
  const author = escapeHtml(el.props?.author || '');
  const showQuoteMark = el.props?.showQuoteMark !== false;
  const pos = buildPositionStyle(el);
  const style = buildInlineStyle(el.style);
  const quoteFontSize = el.style.fontSize || 20;
  const authorFontSize = Math.round(quoteFontSize * 0.7);

  return `<div style="${pos};display:flex;flex-direction:column;justify-content:center;${style};box-sizing:border-box">
    ${showQuoteMark ? `<div style="font-size:${quoteFontSize * 2}px;line-height:0.8;opacity:0.3;margin-bottom:8px">"</div>` : ''}
    <div style="font-size:${quoteFontSize}px;line-height:1.4">${quote}</div>
    ${author ? `<div style="font-size:${authorFontSize}px;opacity:0.7;margin-top:8px">— ${author}</div>` : ''}
  </div>`;
}

function renderPropertyHighlights(el: DesignElement): string {
  const highlights: Array<{ icon?: string; label: string; value: string }> =
    el.props?.highlights || [];
  const pos = buildPositionStyle(el);
  const style = buildInlineStyle(el.style);

  const items = highlights
    .map(
      (h) =>
        `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1">
          ${h.icon ? `<span style="font-size:18px">${escapeHtml(h.icon)}</span>` : ''}
          <span style="font-weight:700;font-size:16px">${escapeHtml(h.value)}</span>
          <span style="font-size:12px;opacity:0.7">${escapeHtml(h.label)}</span>
        </div>`
    )
    .join('');

  return `<div style="${pos};display:flex;align-items:center;justify-content:center">
    <div style="${style};display:flex;gap:12px;align-items:stretch;justify-content:space-around;width:100%;height:100%;box-sizing:border-box">${items}</div>
  </div>`;
}

function renderAgentBlock(el: DesignElement): string {
  const name = escapeHtml(el.props?.name || '');
  const title = escapeHtml(el.props?.title || '');
  const photo = el.props?.photo || '';
  const pos = buildPositionStyle(el);
  const style = buildInlineStyle(el.style);

  const photoHtml = photo
    ? `<img src="${escapeHtml(photo)}" alt="${name}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;flex-shrink:0" />`
    : `<div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.2);flex-shrink:0;display:flex;align-items:center;justify-content:center">
        <span style="font-size:20px">👤</span>
      </div>`;

  return `<div style="${pos};display:flex;align-items:center;gap:10px;${style}">
    ${photoHtml}
    <div style="display:flex;flex-direction:column;gap:2px">
      <div style="font-weight:700;font-size:16px">${name}</div>
      <div style="font-size:13px;opacity:0.7">${title}</div>
    </div>
  </div>`;
}

function renderProjectDetails(el: DesignElement): string {
  const details: Record<string, string> = el.props?.details || {};
  const pos = buildPositionStyle(el);
  const style = buildInlineStyle(el.style);

  const rows = Object.entries(details)
    .map(
      ([key, val]) =>
        `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
          <span style="opacity:0.7">${escapeHtml(key)}</span>
          <span style="font-weight:600">${escapeHtml(val)}</span>
        </div>`
    )
    .join('');

  return `<div style="${pos};overflow:hidden">
    <div style="${style};width:100%;box-sizing:border-box">${rows}</div>
  </div>`;
}

/* ── Element Dispatch ────────────────────────────────────────────────── */

function renderElement(el: DesignElement): string {
  if (el.visible === false) return '';

  switch (el.type) {
    case 'headline':            return renderHeadline(el);
    case 'subtitle':            return renderSubtitle(el);
    case 'body_text':           return renderBodyText(el);
    case 'cta_button':          return renderCtaButton(el);
    case 'image':               return renderImage(el);
    case 'logo':                return renderLogo(el);
    case 'badge':               return renderBadge(el);
    case 'divider':             return renderDivider(el);
    case 'overlay':             return renderOverlay(el);
    case 'shape':               return renderShape(el);
    case 'feature_list':        return renderFeatureList(el);
    case 'contact_block':       return renderContactBlock(el);
    case 'offer_block':         return renderOfferBlock(el);
    case 'statistic_block':     return renderStatisticBlock(el);
    case 'testimonial_block':   return renderTestimonialBlock(el);
    case 'property_highlights': return renderPropertyHighlights(el);
    case 'agent_block':         return renderAgentBlock(el);
    case 'project_details':     return renderProjectDetails(el);
    case 'map_block':           return ''; // Not rendered in preview
    default:
      console.warn(`[PreviewRenderer] Unknown element type: "${el.type}"`);
      return '';
  }
}

/* ── Main Renderer ───────────────────────────────────────────────────── */

/**
 * Render a DesignJSON to a self-contained HTML string.
 *
 * The output is:
 * - Self-contained (inline CSS, no external dependencies)
 * - Uses exact canvas dimensions from the design
 * - Positions elements absolutely with percentage-based coordinates
 * - Supports RTL (dir="rtl")
 * - Scales properly when rendered in a smaller container
 */
export function renderDesignToHtml(design: DesignJSON): string {
  const { canvas, elements, metadata } = design;
  const { width, height } = canvas;

  // Build background styles
  const bgParts: string[] = [];
  if (canvas.backgroundGradient) {
    bgParts.push(`background:${canvas.backgroundGradient}`);
  } else if (canvas.backgroundColor) {
    bgParts.push(`background-color:${canvas.backgroundColor}`);
  } else {
    bgParts.push('background-color:#FFFFFF');
  }
  if (canvas.backgroundImage) {
    bgParts.push(`background-image:url('${canvas.backgroundImage}')`);
    bgParts.push('background-size:cover');
    bgParts.push('background-position:center');
  }

  // Sort elements by z-index for proper rendering order
  const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);

  // Render all elements
  const elementsHtml = sortedElements.map((el) => renderElement(el)).join('\n  ');

  // Background overlay (if specified)
  const overlayHtml = canvas.backgroundOverlay
    ? `<div style="position:absolute;top:0;left:0;width:100%;height:100%;background:${canvas.backgroundOverlay};z-index:1;pointer-events:none"></div>`
    : '';

  return `<div style="position:relative;width:${width}px;height:${height}px;overflow:hidden;direction:rtl;${bgParts.join(';')};font-family:'Heebo','Assistant','Arial',sans-serif;box-sizing:border-box">
  ${overlayHtml}
  ${elementsHtml}
</div>`;
}
