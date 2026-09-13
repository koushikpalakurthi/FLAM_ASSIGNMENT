/**
 * Declarative Ad Specification Type System
 * Defines an ad's content and layout intent independently of target surface constraints.
 */

export type ElementType = 'text' | 'image' | 'button' | 'badge';

export type ElementRole =
  | 'hero'       // Core visual focus (e.g. product image/model)
  | 'primary'    // Main message (e.g. headline)
  | 'secondary'  // Secondary info (e.g. price, description, tag line)
  | 'action'     // Call to Action (e.g. "Shop Now" button)
  | 'branding'   // Brand mark / logo
  | 'accent';     // Promotional badge, starburst, rating

export type PriorityLevel = 1 | 2 | 3; // 1 = Critical (Never drop unless surface is micro), 2 = Important, 3 = Optional/Decorative

export interface ElementStyleIntent {
  preferredAspectRatio?: number; // e.g. 1.0 for square, 1.5 for landscape image
  accentColor?: string;
  textColor?: string;
  backgroundColor?: string;
  fontSizeMultiplier?: number;
  textWeight?: 'normal' | 'medium' | 'bold' | 'black';
  alignment?: 'left' | 'center' | 'right';
}

export interface AdElement {
  id: string;
  type: ElementType;
  role: ElementRole;
  priority: PriorityLevel;
  content: {
    text?: string;
    imageUrl?: string;
    label?: string;
    subtext?: string;
    badgeText?: string;
    price?: string;
    originalPrice?: string;
  };
  styleIntent?: ElementStyleIntent;
}

export interface AdSpec {
  id: string;
  title: string;
  brandName?: string;
  elements: AdElement[];
}

/**
 * Type-safe helper to construct an AdSpec.
 * Validates uniqueness of element IDs and constraints at runtime/compile-time.
 */
export function defineAd(spec: AdSpec): AdSpec {
  const seenIds = new Set<string>();
  
  if (!spec.elements || spec.elements.length === 0) {
    throw new Error('Ad spec must contain at least one element.');
  }

  for (const el of spec.elements) {
    if (seenIds.has(el.id)) {
      throw new Error(`Duplicate element ID detected in ad spec: "${el.id}"`);
    }
    seenIds.add(el.id);

    if (el.priority !== 1 && el.priority !== 2 && el.priority !== 3) {
      throw new Error(`Invalid priority level "${el.priority}" for element "${el.id}". Priority must be 1, 2, or 3.`);
    }
  }

  return spec;
}
