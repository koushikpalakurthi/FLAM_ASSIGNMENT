/**
 * Text Measurement & Line Wrapping Engine
 * Calculates exact bounding dimensions for wrapped text based on font size, weight, and max width.
 */

export interface TextMetricsResult {
  width: number;
  height: number;
  lines: string[];
  lineHeight: number;
  fontSize: number;
}

let cachedCanvasContext: CanvasRenderingContext2D | null = null;

function getContext(): CanvasRenderingContext2D | null {
  if (cachedCanvasContext) return cachedCanvasContext;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    cachedCanvasContext = canvas.getContext('2d');
  }
  return cachedCanvasContext;
}

/**
 * Measure text and compute exact multi-line wrapping bounding box
 */
export function measureTextBounds(
  text: string,
  fontSize: number,
  fontWeight: string | number = 700,
  fontFamily: string = "'Plus Jakarta Sans', sans-serif",
  maxWidth: number = 1000
): TextMetricsResult {
  const ctx = getContext();
  const lineHeight = Math.round(fontSize * 1.25);

  if (!text) {
    return { width: 0, height: 0, lines: [], lineHeight, fontSize };
  }

  if (!ctx) {
    // Basic fallback estimation if canvas context is unavailable
    const avgCharWidth = fontSize * 0.55;
    const estimatedSingleWidth = text.length * avgCharWidth;
    const numLines = Math.max(1, Math.ceil(estimatedSingleWidth / Math.max(1, maxWidth)));
    const width = Math.min(maxWidth, estimatedSingleWidth);
    const height = numLines * lineHeight;
    return {
      width,
      height,
      lines: [text], // simplistic fallback
      lineHeight,
      fontSize
    };
  }

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const testLine = `${currentLine} ${word}`;
    const testWidth = ctx.measureText(testLine).width;

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);

  let maxLineWidth = 0;
  for (const line of lines) {
    const w = ctx.measureText(line).width;
    if (w > maxLineWidth) maxLineWidth = w;
  }

  const height = lines.length * lineHeight;

  return {
    width: Math.ceil(maxLineWidth),
    height,
    lines,
    lineHeight,
    fontSize,
  };
}
