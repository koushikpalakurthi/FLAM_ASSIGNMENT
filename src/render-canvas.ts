/**
 * HTML5 Canvas 2D Rendering Backend
 * Pure canvas renderer that renders a ResolvedLayout independently of DOM layout trees.
 */

import { ResolvedLayout, ResolvedElementRect } from './resolver';
import { SurfaceProfile } from './surfaces';

export function renderLayoutToCanvas(
  canvas: HTMLCanvasElement,
  layout: ResolvedLayout,
  surface: SurfaceProfile,
  scale: number = 1
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = surface.width * scale;
  const h = surface.height * scale;

  canvas.width = w;
  canvas.height = h;

  // 1. Background Gradient
  const bgGradient = ctx.createLinearGradient(0, 0, w, h);
  bgGradient.addColorStop(0, '#0f172a');
  bgGradient.addColorStop(0.5, '#1e1b4b');
  bgGradient.addColorStop(1, '#0f172a');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, w, h);

  // 2. Safe Area Border Overlay
  if (surface.safeArea) {
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeRect(
      surface.safeArea.left * scale,
      surface.safeArea.top * scale,
      layout.usableBounds.width * scale,
      layout.usableBounds.height * scale
    );
    ctx.setLineDash([]);
  }

  // Sort elements by priority for proper z-ordering
  const sortedRects = [...layout.elements].sort((a, b) => b.priority - a.priority);

  for (const rect of sortedRects) {
    if (!rect.isVisible || rect.opacity === 0) continue;

    const rx = rect.x * scale;
    const ry = rect.y * scale;
    const rw = rect.width * scale;
    const rh = rect.height * scale;
    const fontSize = (rect.fontSize || 14) * scale;

    ctx.save();

    switch (rect.role) {
      case 'branding': {
        // Logo pill & icon
        ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
        ctx.strokeStyle = 'rgba(129, 140, 248, 0.4)';
        ctx.lineWidth = 1;
        roundRect(ctx, rx, ry, rw, rh, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = `800 ${fontSize}px 'Plus Jakarta Sans', sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillText(rect.content.text || 'FLAM', rx + 12 * scale, ry + rh / 2);
        break;
      }

      case 'hero': {
        // Hero Product Card Placeholder
        const heroGrad = ctx.createLinearGradient(rx, ry, rx + rw, ry + rh);
        heroGrad.addColorStop(0, '#312e81');
        heroGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = heroGrad;
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, rx, ry, rw, rh, 14);
        ctx.fill();
        ctx.stroke();

        // Canvas product graphic icon representation
        ctx.fillStyle = 'rgba(129, 140, 248, 0.2)';
        ctx.beginPath();
        ctx.arc(rx + rw / 2, ry + rh / 2, Math.min(rw, rh) * 0.25, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#a5b4fc';
        ctx.font = `600 ${Math.max(10, 12 * scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Product Image', rx + rw / 2, ry + rh / 2);
        ctx.textAlign = 'left';
        break;
      }

      case 'primary': {
        // Headline Typography
        ctx.fillStyle = '#ffffff';
        ctx.font = `800 ${fontSize}px 'Plus Jakarta Sans', sans-serif`;
        ctx.textBaseline = 'top';

        if (rect.textLines && rect.textLines.length > 0) {
          const lh = (rect.lineHeight || fontSize * 1.2) * scale;
          rect.textLines.forEach((line, i) => {
            ctx.fillText(line, rx, ry + i * lh);
          });
        } else {
          ctx.fillText(rect.content.text || '', rx, ry);
        }
        break;
      }

      case 'secondary': {
        // Price Tag
        ctx.fillStyle = '#fbbf24';
        ctx.font = `800 ${fontSize}px 'Plus Jakarta Sans', sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillText(rect.content.price || rect.content.text || '', rx, ry + rh / 2);
        break;
      }

      case 'action': {
        // CTA Button
        const btnGrad = ctx.createLinearGradient(rx, ry, rx + rw, ry);
        btnGrad.addColorStop(0, '#6366f1');
        btnGrad.addColorStop(1, '#8b5cf6');
        ctx.fillStyle = btnGrad;
        roundRect(ctx, rx, ry, rw, rh, 10);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = `700 ${fontSize}px 'Plus Jakarta Sans', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rect.content.label || 'Shop Now', rx + rw / 2, ry + rh / 2);
        ctx.textAlign = 'left';
        break;
      }

      case 'accent': {
        ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
        ctx.strokeStyle = 'rgba(165, 180, 252, 0.4)';
        roundRect(ctx, rx, ry, rw, rh, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#a5b4fc';
        ctx.font = `700 ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rect.content.badgeText || 'SPECIAL', rx + rw / 2, ry + rh / 2);
        ctx.textAlign = 'left';
        break;
      }
    }

    ctx.restore();
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
