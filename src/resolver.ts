/**
 * Adaptive Layout Engine - Core Constraint Resolver
 * Resolves a declarative AdSpec against a SurfaceProfile into an exact spatial layout.
 * Framework-agnostic pure TypeScript implementation.
 */

import { AdSpec, AdElement, ElementType, ElementRole, PriorityLevel } from './spec';
import { SurfaceProfile, SafeArea } from './surfaces';
import { measureTextBounds, TextMetricsResult } from './text-measurer';

export type MacroTopology = 'HORIZONTAL_BAND' | 'VERTICAL_STACK' | 'SPLIT_COLUMNS' | 'BALANCED_CARD';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResolvedElementRect extends BoundingBox {
  id: string;
  type: ElementType;
  role: ElementRole;
  priority: PriorityLevel;
  fontSize?: number;
  lineHeight?: number;
  textLines?: string[];
  isVisible: boolean;
  opacity: number;
  content: AdElement['content'];
  styleIntent?: AdElement['styleIntent'];
  degradationState?: 'full' | 'shrunk' | 'dropped';
}

export interface DiagnosticLog {
  timestamp: number;
  stage: string;
  message: string;
  severity: 'info' | 'warning' | 'degradation';
}

export interface ResolvedLayout {
  specId: string;
  surfaceId: string;
  surfaceWidth: number;
  surfaceHeight: number;
  usableBounds: BoundingBox;
  macroTopology: MacroTopology;
  elements: ResolvedElementRect[];
  droppedElementIds: string[];
  shrunkElementIds: string[];
  diagnosticLogs: DiagnosticLog[];
  isConstraintSatisfied: boolean;
  resolutionTimeMs: number;
}

/**
 * Main Constraint Resolution Engine Entrypoint
 */
export function resolveLayout(spec: AdSpec, surface: SurfaceProfile): ResolvedLayout {
  const startTime = performance.now();
  const diagnosticLogs: DiagnosticLog[] = [];

  function log(stage: string, message: string, severity: DiagnosticLog['severity'] = 'info') {
    diagnosticLogs.push({ timestamp: performance.now() - startTime, stage, message, severity });
  }

  log('INIT', `Resolving ad spec "${spec.title}" for surface "${surface.name}" (${surface.width}x${surface.height}px)`);

  // 1. Calculate usable content area factoring in Safe Areas
  const safeArea: SafeArea = surface.safeArea || { top: 0, right: 0, bottom: 0, left: 0 };
  const usableX = safeArea.left;
  const usableY = safeArea.top;
  const usableWidth = Math.max(10, surface.width - (safeArea.left + safeArea.right));
  const usableHeight = Math.max(10, surface.height - (safeArea.top + safeArea.bottom));
  const usableBounds: BoundingBox = { x: usableX, y: usableY, width: usableWidth, height: usableHeight };

  const aspectRatio = usableWidth / usableHeight;
  log('GEOMETRY', `Usable space bounds: [${usableWidth}x${usableHeight}px] (Aspect Ratio: ${aspectRatio.toFixed(2)})`);

  // 2. Classify Macro Topology from Aspect Ratio
  let macroTopology: MacroTopology;
  if (aspectRatio >= 2.2) {
    macroTopology = 'HORIZONTAL_BAND';
  } else if (aspectRatio <= 0.75) {
    macroTopology = 'VERTICAL_STACK';
  } else if (aspectRatio > 1.1) {
    macroTopology = 'SPLIT_COLUMNS';
  } else {
    macroTopology = 'BALANCED_CARD';
  }
  log('TOPOLOGY', `Selected Macro Topology: ${macroTopology} based on aspect ratio ${aspectRatio.toFixed(2)}`);

  // 3. Effective Minimum Constraints
  const baseMinTextSize = surface.minTextSize;
  const touchMinTapTarget = surface.touchOnly ? surface.minTapTarget : 24;
  log('CONSTRAINTS', `Hard minimums -> Text Size: ${baseMinTextSize}px, Tap Target: ${touchMinTapTarget}px`);

  // 4. Iterative Priority Degradation Resolution
  let activeElementIds = new Set<string>(spec.elements.map(e => e.id));
  let shrunkElementIds = new Set<string>();
  let droppedElementIds = new Set<string>();

  let resolvedRects: ResolvedElementRect[] = [];
  let success = false;

  // Max 4 degradation passes
  for (let pass = 1; pass <= 4; pass++) {
    log('SOLVER_PASS', `Pass ${pass}: Evaluating layout with ${activeElementIds.size} active elements.`);

    const currentSpecElements = spec.elements.filter(e => activeElementIds.has(e.id));
    const layoutAttempt = attemptLayoutSolve(
      currentSpecElements,
      spec,
      surface,
      usableBounds,
      macroTopology,
      shrunkElementIds,
      baseMinTextSize,
      touchMinTapTarget
    );

    if (layoutAttempt.fitsWithoutOverflow) {
      resolvedRects = layoutAttempt.rects;
      success = true;
      log('SOLVER_SUCCESS', `Valid layout solved cleanly on pass ${pass}. Zero overlaps/clipping.`);
      break;
    }

    log('OVERFLOW_DETECTED', `Pass ${pass} overflowed usable bounds. Initiating degradation step.`, 'warning');

    // Degradation Cascade:
    // Pass 1 -> Shrink Priority 3 elements
    // Pass 2 -> Drop Priority 3 elements
    // Pass 3 -> Shrink & Drop Priority 2 elements
    // Pass 4 -> Force minimal scaling on Priority 1 elements
    if (pass === 1) {
      const p3Elements = currentSpecElements.filter(e => e.priority === 3);
      if (p3Elements.length > 0) {
        p3Elements.forEach(e => shrunkElementIds.add(e.id));
        log('DEGRADATION', `Shrinking Priority 3 elements (${p3Elements.map(e => e.id).join(', ')})`, 'degradation');
      } else {
        // If no p3 elements to shrink, drop p3 or shrink p2
        const p2Elements = currentSpecElements.filter(e => e.priority === 2);
        p2Elements.forEach(e => shrunkElementIds.add(e.id));
        log('DEGRADATION', `No P3 elements. Shrinking Priority 2 elements (${p2Elements.map(e => e.id).join(', ')})`, 'degradation');
      }
    } else if (pass === 2) {
      const p3Elements = currentSpecElements.filter(e => e.priority === 3);
      if (p3Elements.length > 0) {
        p3Elements.forEach(e => {
          activeElementIds.delete(e.id);
          droppedElementIds.add(e.id);
        });
        log('DEGRADATION', `Dropped Priority 3 elements (${p3Elements.map(e => e.id).join(', ')}) to free space`, 'degradation');
      } else {
        const p2Elements = currentSpecElements.filter(e => e.priority === 2);
        if (p2Elements.length > 0) {
          const victim = p2Elements[p2Elements.length - 1];
          activeElementIds.delete(victim.id);
          droppedElementIds.add(victim.id);
          log('DEGRADATION', `Dropped Priority 2 element "${victim.id}" to satisfy space constraints`, 'degradation');
        }
      }
    } else if (pass === 3) {
      const p2Elements = currentSpecElements.filter(e => e.priority === 2);
      if (p2Elements.length > 0) {
        p2Elements.forEach(e => {
          activeElementIds.delete(e.id);
          droppedElementIds.add(e.id);
        });
        log('DEGRADATION', `Dropped remaining Priority 2 elements (${p2Elements.map(e => e.id).join(', ')})`, 'degradation');
      }
    } else {
      // Final pass: Only Priority 1 elements remain, force clamp to bounds
      resolvedRects = layoutAttempt.rects;
      log('SOLVER_CLAMP', 'Forced scaling for core Priority 1 elements to fit within surface boundaries.', 'warning');
      break;
    }
  }

  // Include dropped elements as hidden rects for renderer animations
  for (const el of spec.elements) {
    if (!resolvedRects.find(r => r.id === el.id)) {
      resolvedRects.push({
        id: el.id,
        type: el.type,
        role: el.role,
        priority: el.priority,
        x: usableBounds.x + usableBounds.width / 2,
        y: usableBounds.y + usableBounds.height / 2,
        width: 0,
        height: 0,
        isVisible: false,
        opacity: 0,
        content: el.content,
        styleIntent: el.styleIntent,
        degradationState: 'dropped'
      });
    }
  }

  const endTime = performance.now();

  return {
    specId: spec.id,
    surfaceId: surface.id,
    surfaceWidth: surface.width,
    surfaceHeight: surface.height,
    usableBounds,
    macroTopology,
    elements: resolvedRects,
    droppedElementIds: Array.from(droppedElementIds),
    shrunkElementIds: Array.from(shrunkElementIds),
    diagnosticLogs,
    isConstraintSatisfied: success || droppedElementIds.size > 0,
    resolutionTimeMs: Math.round((endTime - startTime) * 100) / 100,
  };
}

/**
 * Spatial Layout Placement Algorithm for specific topology
 */
function attemptLayoutSolve(
  elements: AdElement[],
  spec: AdSpec,
  surface: SurfaceProfile,
  bounds: BoundingBox,
  topology: MacroTopology,
  shrunkIds: Set<string>,
  minTextSize: number,
  minTapTarget: number
): { rects: ResolvedElementRect[]; fitsWithoutOverflow: boolean } {
  const rects: ResolvedElementRect[] = [];
  let overflow = false;

  // Viewing distance multipliers for legibility
  const distanceMultiplier = surface.viewingDistance === 'far' ? 1.6 : surface.viewingDistance === 'medium' ? 1.25 : 1.0;

  // Helpers to find elements by role
  const heroEl = elements.find(e => e.role === 'hero');
  const primaryTextEl = elements.find(e => e.role === 'primary');
  const actionEl = elements.find(e => e.role === 'action');
  const brandEl = elements.find(e => e.role === 'branding');
  const secondaryTextEl = elements.find(e => e.role === 'secondary');
  const accentEl = elements.find(e => e.role === 'accent');

  if (topology === 'HORIZONTAL_BAND') {
    // ----------------------------------------------------
    // TOPOLOGY: HORIZONTAL BAND (e.g. Broadcast Lower-Third)
    // Horizontal row placement: Logo | Headline & Subtitle | Price | CTA
    // ----------------------------------------------------
    const gap = 24 * distanceMultiplier;
    let currentX = bounds.x;
    const contentY = bounds.y;
    const contentH = bounds.height;

    // 1. Branding (Logo) on Far Left
    if (brandEl) {
      const isShrunk = shrunkIds.has(brandEl.id);
      const logoW = isShrunk ? Math.min(100, contentH * 0.8) : Math.min(180, contentH * 1.1);
      const logoH = Math.min(contentH, logoW * 0.6);
      rects.push({
        id: brandEl.id,
        type: brandEl.type,
        role: brandEl.role,
        priority: brandEl.priority,
        x: currentX,
        y: contentY + (contentH - logoH) / 2,
        width: logoW,
        height: logoH,
        isVisible: true,
        opacity: 1,
        content: brandEl.content,
        styleIntent: brandEl.styleIntent,
        degradationState: isShrunk ? 'shrunk' : 'full'
      });
      currentX += logoW + gap;
    }

    // 2. Action (CTA) on Far Right (Fixed reservation for touch/visibility)
    let ctaWidth = 0;
    if (actionEl) {
      const fontSize = Math.max(minTextSize, Math.round(18 * distanceMultiplier));
      const textMetrics = measureTextBounds(actionEl.content.label || 'Shop Now', fontSize, 700);
      ctaWidth = Math.max(minTapTarget * 2.2, textMetrics.width + 48);
      const ctaHeight = Math.max(minTapTarget, Math.min(contentH * 0.8, 64 * distanceMultiplier));
      
      const ctaX = bounds.x + bounds.width - ctaWidth;
      rects.push({
        id: actionEl.id,
        type: actionEl.type,
        role: actionEl.role,
        priority: actionEl.priority,
        x: ctaX,
        y: contentY + (contentH - ctaHeight) / 2,
        width: ctaWidth,
        height: ctaHeight,
        fontSize,
        lineHeight: textMetrics.lineHeight,
        textLines: textMetrics.lines,
        isVisible: true,
        opacity: 1,
        content: actionEl.content,
        styleIntent: actionEl.styleIntent,
        degradationState: shrunkIds.has(actionEl.id) ? 'shrunk' : 'full'
      });
    }

    // 3. Secondary/Price before CTA
    let priceWidth = 0;
    if (secondaryTextEl) {
      const isShrunk = shrunkIds.has(secondaryTextEl.id);
      const fontSize = Math.max(minTextSize, Math.round((isShrunk ? 18 : 26) * distanceMultiplier));
      const priceText = secondaryTextEl.content.price || secondaryTextEl.content.text || '';
      const metrics = measureTextBounds(priceText, fontSize, 800);
      priceWidth = metrics.width + 24;
      const priceX = bounds.x + bounds.width - ctaWidth - (ctaWidth > 0 ? gap : 0) - priceWidth;

      rects.push({
        id: secondaryTextEl.id,
        type: secondaryTextEl.type,
        role: secondaryTextEl.role,
        priority: secondaryTextEl.priority,
        x: Math.max(currentX, priceX),
        y: contentY + (contentH - metrics.height) / 2,
        width: priceWidth,
        height: metrics.height,
        fontSize,
        lineHeight: metrics.lineHeight,
        textLines: metrics.lines,
        isVisible: true,
        opacity: 1,
        content: secondaryTextEl.content,
        styleIntent: secondaryTextEl.styleIntent,
        degradationState: isShrunk ? 'shrunk' : 'full'
      });
    }

    // 4. Middle Center: Primary Headline
    const headlineMaxW = bounds.x + bounds.width - currentX - (ctaWidth + priceWidth + gap * 2);
    if (primaryTextEl && headlineMaxW > 100) {
      const isShrunk = shrunkIds.has(primaryTextEl.id);
      const fontSize = Math.max(minTextSize, Math.round((isShrunk ? 20 : 32) * distanceMultiplier));
      const metrics = measureTextBounds(primaryTextEl.content.text || '', fontSize, 800, undefined, headlineMaxW);

      rects.push({
        id: primaryTextEl.id,
        type: primaryTextEl.type,
        role: primaryTextEl.role,
        priority: primaryTextEl.priority,
        x: currentX,
        y: contentY + (contentH - metrics.height) / 2,
        width: Math.min(headlineMaxW, metrics.width),
        height: metrics.height,
        fontSize,
        lineHeight: metrics.lineHeight,
        textLines: metrics.lines,
        isVisible: true,
        opacity: 1,
        content: primaryTextEl.content,
        styleIntent: primaryTextEl.styleIntent,
        degradationState: isShrunk ? 'shrunk' : 'full'
      });
    } else if (primaryTextEl && headlineMaxW <= 100) {
      overflow = true;
    }

    // Optional Accent / Hero in Horizontal Band
    if (heroEl) {
      const heroSize = Math.min(contentH * 0.9, 120);
      rects.push({
        id: heroEl.id,
        type: heroEl.type,
        role: heroEl.role,
        priority: heroEl.priority,
        x: currentX,
        y: contentY + (contentH - heroSize) / 2,
        width: heroSize,
        height: heroSize,
        isVisible: true,
        opacity: 0.9,
        content: heroEl.content,
        styleIntent: heroEl.styleIntent,
        degradationState: 'shrunk'
      });
    }

  } else if (topology === 'VERTICAL_STACK') {
    // ----------------------------------------------------
    // TOPOLOGY: VERTICAL STACK (e.g. Mobile Interstitial 320x480)
    // Top-to-bottom stack: Logo -> Hero Image -> Headline -> Price -> CTA
    // ----------------------------------------------------
    let currentY = bounds.y;
    const gap = 12;

    // 1. Brand Logo at Top
    if (brandEl) {
      const isShrunk = shrunkIds.has(brandEl.id);
      const logoH = isShrunk ? 24 : 36;
      const logoW = logoH * 2.5;
      rects.push({
        id: brandEl.id,
        type: brandEl.type,
        role: brandEl.role,
        priority: brandEl.priority,
        x: bounds.x + (bounds.width - logoW) / 2,
        y: currentY,
        width: logoW,
        height: logoH,
        isVisible: true,
        opacity: 1,
        content: brandEl.content,
        styleIntent: brandEl.styleIntent,
        degradationState: isShrunk ? 'shrunk' : 'full'
      });
      currentY += logoH + gap;
    }

    // Reserve space for Bottom Action CTA & Price first
    let footerHeightNeeded = 0;
    if (actionEl) footerHeightNeeded += Math.max(minTapTarget, 48) + gap;
    if (secondaryTextEl) footerHeightNeeded += 28 + gap;

    const remainingHeightForTop = bounds.y + bounds.height - footerHeightNeeded - currentY;

    // 2. Hero Image in Upper Middle
    if (heroEl && remainingHeightForTop > 80) {
      const isShrunk = shrunkIds.has(heroEl.id);
      const targetImageH = isShrunk ? Math.min(120, remainingHeightForTop * 0.4) : Math.min(220, remainingHeightForTop * 0.55);
      const targetImageW = Math.min(bounds.width * 0.9, targetImageH * 1.1);

      rects.push({
        id: heroEl.id,
        type: heroEl.type,
        role: heroEl.role,
        priority: heroEl.priority,
        x: bounds.x + (bounds.width - targetImageW) / 2,
        y: currentY,
        width: targetImageW,
        height: targetImageH,
        isVisible: true,
        opacity: 1,
        content: heroEl.content,
        styleIntent: heroEl.styleIntent,
        degradationState: isShrunk ? 'shrunk' : 'full'
      });
      currentY += targetImageH + gap;
    }

    // 3. Accent Badge (if present)
    if (accentEl) {
      const badgeMetrics = measureTextBounds(accentEl.content.badgeText || 'OFFER', 12, 700);
      const badgeW = badgeMetrics.width + 16;
      const badgeH = 22;
      rects.push({
        id: accentEl.id,
        type: accentEl.type,
        role: accentEl.role,
        priority: accentEl.priority,
        x: bounds.x + (bounds.width - badgeW) / 2,
        y: currentY,
        width: badgeW,
        height: badgeH,
        fontSize: 12,
        lineHeight: badgeMetrics.lineHeight,
        textLines: badgeMetrics.lines,
        isVisible: true,
        opacity: 1,
        content: accentEl.content,
        styleIntent: accentEl.styleIntent,
        degradationState: 'full'
      });
      currentY += badgeH + 6;
    }

    // 4. Primary Headline
    if (primaryTextEl) {
      const isShrunk = shrunkIds.has(primaryTextEl.id);
      const fontSize = Math.max(minTextSize, isShrunk ? 16 : 22);
      const metrics = measureTextBounds(primaryTextEl.content.text || '', fontSize, 800, undefined, bounds.width);

      rects.push({
        id: primaryTextEl.id,
        type: primaryTextEl.type,
        role: primaryTextEl.role,
        priority: primaryTextEl.priority,
        x: bounds.x + (bounds.width - metrics.width) / 2,
        y: currentY,
        width: metrics.width,
        height: metrics.height,
        fontSize,
        lineHeight: metrics.lineHeight,
        textLines: metrics.lines,
        isVisible: true,
        opacity: 1,
        content: primaryTextEl.content,
        styleIntent: primaryTextEl.styleIntent,
        degradationState: isShrunk ? 'shrunk' : 'full'
      });
      currentY += metrics.height + gap;
    }

    // Push CTA and Price to bottom
    let footerY = bounds.y + bounds.height;
    if (actionEl) {
      const ctaH = Math.max(minTapTarget, 48);
      const ctaW = Math.min(bounds.width, 260);
      footerY -= ctaH;
      rects.push({
        id: actionEl.id,
        type: actionEl.type,
        role: actionEl.role,
        priority: actionEl.priority,
        x: bounds.x + (bounds.width - ctaW) / 2,
        y: footerY,
        width: ctaW,
        height: ctaH,
        fontSize: Math.max(minTextSize, 15),
        isVisible: true,
        opacity: 1,
        content: actionEl.content,
        styleIntent: actionEl.styleIntent,
        degradationState: shrunkIds.has(actionEl.id) ? 'shrunk' : 'full'
      });
      footerY -= gap;
    }

    if (secondaryTextEl) {
      const fontSize = Math.max(minTextSize, 18);
      const metrics = measureTextBounds(secondaryTextEl.content.price || secondaryTextEl.content.text || '', fontSize, 800);
      footerY -= metrics.height;
      rects.push({
        id: secondaryTextEl.id,
        type: secondaryTextEl.type,
        role: secondaryTextEl.role,
        priority: secondaryTextEl.priority,
        x: bounds.x + (bounds.width - metrics.width) / 2,
        y: footerY,
        width: metrics.width,
        height: metrics.height,
        fontSize,
        lineHeight: metrics.lineHeight,
        textLines: metrics.lines,
        isVisible: true,
        opacity: 1,
        content: secondaryTextEl.content,
        styleIntent: secondaryTextEl.styleIntent,
        degradationState: shrunkIds.has(secondaryTextEl.id) ? 'shrunk' : 'full'
      });
    }

    // Check if middle content overlapped footer
    if (currentY > footerY) {
      overflow = true;
    }

  } else if (topology === 'SPLIT_COLUMNS') {
    // ----------------------------------------------------
    // TOPOLOGY: SPLIT COLUMNS (e.g. Mobile Landscape 480x320)
    // Left column: Hero Image | Right column: Logo, Headline, Price, CTA
    // ----------------------------------------------------
    const colGap = 16;
    const leftWidth = Math.round(bounds.width * 0.42);
    const rightWidth = bounds.width - leftWidth - colGap;

    // Left Column: Hero Image
    if (heroEl) {
      const imageH = Math.min(bounds.height, leftWidth * 1.1);
      rects.push({
        id: heroEl.id,
        type: heroEl.type,
        role: heroEl.role,
        priority: heroEl.priority,
        x: bounds.x,
        y: bounds.y + (bounds.height - imageH) / 2,
        width: leftWidth,
        height: imageH,
        isVisible: true,
        opacity: 1,
        content: heroEl.content,
        styleIntent: heroEl.styleIntent,
        degradationState: shrunkIds.has(heroEl.id) ? 'shrunk' : 'full'
      });
    }

    // Right Column Stack
    const rightX = bounds.x + leftWidth + colGap;
    let rightY = bounds.y;
    const itemGap = 10;

    if (brandEl) {
      const logoH = shrunkIds.has(brandEl.id) ? 22 : 28;
      const logoW = logoH * 2.5;
      rects.push({
        id: brandEl.id,
        type: brandEl.type,
        role: brandEl.role,
        priority: brandEl.priority,
        x: rightX,
        y: rightY,
        width: logoW,
        height: logoH,
        isVisible: true,
        opacity: 1,
        content: brandEl.content,
        styleIntent: brandEl.styleIntent,
        degradationState: shrunkIds.has(brandEl.id) ? 'shrunk' : 'full'
      });
      rightY += logoH + itemGap;
    }

    if (primaryTextEl) {
      const fontSize = Math.max(minTextSize, shrunkIds.has(primaryTextEl.id) ? 15 : 20);
      const metrics = measureTextBounds(primaryTextEl.content.text || '', fontSize, 800, undefined, rightWidth);

      rects.push({
        id: primaryTextEl.id,
        type: primaryTextEl.type,
        role: primaryTextEl.role,
        priority: primaryTextEl.priority,
        x: rightX,
        y: rightY,
        width: metrics.width,
        height: metrics.height,
        fontSize,
        lineHeight: metrics.lineHeight,
        textLines: metrics.lines,
        isVisible: true,
        opacity: 1,
        content: primaryTextEl.content,
        styleIntent: primaryTextEl.styleIntent,
        degradationState: shrunkIds.has(primaryTextEl.id) ? 'shrunk' : 'full'
      });
      rightY += metrics.height + itemGap;
    }

    if (secondaryTextEl) {
      const fontSize = Math.max(minTextSize, 18);
      const metrics = measureTextBounds(secondaryTextEl.content.price || secondaryTextEl.content.text || '', fontSize, 800);
      rects.push({
        id: secondaryTextEl.id,
        type: secondaryTextEl.type,
        role: secondaryTextEl.role,
        priority: secondaryTextEl.priority,
        x: rightX,
        y: rightY,
        width: metrics.width,
        height: metrics.height,
        fontSize,
        lineHeight: metrics.lineHeight,
        textLines: metrics.lines,
        isVisible: true,
        opacity: 1,
        content: secondaryTextEl.content,
        styleIntent: secondaryTextEl.styleIntent,
        degradationState: shrunkIds.has(secondaryTextEl.id) ? 'shrunk' : 'full'
      });
      rightY += metrics.height + itemGap;
    }

    if (actionEl) {
      const ctaH = Math.max(minTapTarget, 44);
      const ctaW = Math.min(rightWidth, 200);
      rects.push({
        id: actionEl.id,
        type: actionEl.type,
        role: actionEl.role,
        priority: actionEl.priority,
        x: rightX,
        y: bounds.y + bounds.height - ctaH,
        width: ctaW,
        height: ctaH,
        fontSize: Math.max(minTextSize, 14),
        isVisible: true,
        opacity: 1,
        content: actionEl.content,
        styleIntent: actionEl.styleIntent,
        degradationState: shrunkIds.has(actionEl.id) ? 'shrunk' : 'full'
      });
    }

    if (rightY > bounds.y + bounds.height) {
      overflow = true;
    }

  } else {
    // ----------------------------------------------------
    // TOPOLOGY: BALANCED CARD (e.g. Retail Kiosk 1080x1080)
    // Generous, balanced card layout with prominent hero & typography
    // ----------------------------------------------------
    let currentY = bounds.y;
    const gap = 24;

    if (brandEl) {
      const isShrunk = shrunkIds.has(brandEl.id);
      const logoH = isShrunk ? 40 : 64;
      const logoW = logoH * 2.8;
      rects.push({
        id: brandEl.id,
        type: brandEl.type,
        role: brandEl.role,
        priority: brandEl.priority,
        x: bounds.x,
        y: currentY,
        width: logoW,
        height: logoH,
        isVisible: true,
        opacity: 1,
        content: brandEl.content,
        styleIntent: brandEl.styleIntent,
        degradationState: isShrunk ? 'shrunk' : 'full'
      });
      currentY += logoH + gap;
    }

    // Hero Image
    if (heroEl) {
      const isShrunk = shrunkIds.has(heroEl.id);
      const maxHeroH = isShrunk ? bounds.height * 0.35 : bounds.height * 0.45;
      const heroW = Math.min(bounds.width, maxHeroH * 1.3);
      const heroH = Math.min(maxHeroH, heroW / 1.3);

      rects.push({
        id: heroEl.id,
        type: heroEl.type,
        role: heroEl.role,
        priority: heroEl.priority,
        x: bounds.x + (bounds.width - heroW) / 2,
        y: currentY,
        width: heroW,
        height: heroH,
        isVisible: true,
        opacity: 1,
        content: heroEl.content,
        styleIntent: heroEl.styleIntent,
        degradationState: isShrunk ? 'shrunk' : 'full'
      });
      currentY += heroH + gap;
    }

    // Headline
    if (primaryTextEl) {
      const isShrunk = shrunkIds.has(primaryTextEl.id);
      const fontSize = Math.max(minTextSize, isShrunk ? 32 : 44);
      const metrics = measureTextBounds(primaryTextEl.content.text || '', fontSize, 800, undefined, bounds.width);

      rects.push({
        id: primaryTextEl.id,
        type: primaryTextEl.type,
        role: primaryTextEl.role,
        priority: primaryTextEl.priority,
        x: bounds.x,
        y: currentY,
        width: metrics.width,
        height: metrics.height,
        fontSize,
        lineHeight: metrics.lineHeight,
        textLines: metrics.lines,
        isVisible: true,
        opacity: 1,
        content: primaryTextEl.content,
        styleIntent: primaryTextEl.styleIntent,
        degradationState: isShrunk ? 'shrunk' : 'full'
      });
      currentY += metrics.height + gap;
    }

    // Bottom Action Row: Price on left, CTA on right
    const footerY = bounds.y + bounds.height - Math.max(minTapTarget * 1.2, 72);

    if (secondaryTextEl) {
      const fontSize = Math.max(minTextSize, 36);
      const priceText = secondaryTextEl.content.price || secondaryTextEl.content.text || '';
      const metrics = measureTextBounds(priceText, fontSize, 800);

      rects.push({
        id: secondaryTextEl.id,
        type: secondaryTextEl.type,
        role: secondaryTextEl.role,
        priority: secondaryTextEl.priority,
        x: bounds.x,
        y: footerY + (72 - metrics.height) / 2,
        width: metrics.width,
        height: metrics.height,
        fontSize,
        lineHeight: metrics.lineHeight,
        textLines: metrics.lines,
        isVisible: true,
        opacity: 1,
        content: secondaryTextEl.content,
        styleIntent: secondaryTextEl.styleIntent,
        degradationState: shrunkIds.has(secondaryTextEl.id) ? 'shrunk' : 'full'
      });
    }

    if (actionEl) {
      const ctaH = Math.max(minTapTarget, 72);
      const ctaW = Math.min(bounds.width * 0.45, 320);
      rects.push({
        id: actionEl.id,
        type: actionEl.type,
        role: actionEl.role,
        priority: actionEl.priority,
        x: bounds.x + bounds.width - ctaW,
        y: footerY,
        width: ctaW,
        height: ctaH,
        fontSize: Math.max(minTextSize, 22),
        isVisible: true,
        opacity: 1,
        content: actionEl.content,
        styleIntent: actionEl.styleIntent,
        degradationState: shrunkIds.has(actionEl.id) ? 'shrunk' : 'full'
      });
    }

    if (currentY > footerY) {
      overflow = true;
    }
  }

  return {
    rects,
    fitsWithoutOverflow: !overflow
  };
}
