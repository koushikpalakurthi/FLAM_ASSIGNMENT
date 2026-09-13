/**
 * Surface Profile & Constraint Definitions
 * Defines physical/environmental constraints of ad placement surfaces.
 */

export type ViewingDistance = 'near' | 'medium' | 'far';

export interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface SurfaceProfile {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  safeArea: SafeArea;
  minTapTarget: number;    // e.g. 44px for mobile touch, 60px for kiosk, 0 for broadcast non-touch
  minTextSize: number;     // Hard lower bound for legible font size (px)
  viewingDistance: ViewingDistance;
  touchOnly: boolean;
  aspectRatio?: number;    // Computed helper (width / height)
}

/**
 * Standard Surface Profiles required by specification
 */
export const defaultSurfaces: Record<string, SurfaceProfile> = {
  mobileInterstitial: {
    id: 'mobileInterstitial',
    name: 'Mobile Interstitial (Portrait)',
    description: 'Tall 9:16 portrait screen for smartphone full-screen ads',
    width: 320,
    height: 480,
    safeArea: { top: 32, right: 16, bottom: 24, left: 16 },
    minTapTarget: 44,
    minTextSize: 12,
    viewingDistance: 'near',
    touchOnly: true,
  },

  mobileLandscape: {
    id: 'mobileLandscape',
    name: 'Mobile Landscape Banner',
    description: 'Wide 3:2 landscape screen for mobile inline placements',
    width: 480,
    height: 320,
    safeArea: { top: 16, right: 20, bottom: 16, left: 20 },
    minTapTarget: 44,
    minTextSize: 12,
    viewingDistance: 'near',
    touchOnly: true,
  },

  broadcastLowerThird: {
    id: 'broadcastLowerThird',
    name: 'Broadcast Lower-Third',
    description: 'Ultra-wide 1920x250 overlay for TV/video streams (far viewing)',
    width: 1920,
    height: 250,
    safeArea: { top: 20, right: 80, bottom: 20, left: 80 },
    minTapTarget: 0, // Non-interactive television display
    minTextSize: 32, // Large legibility threshold for 10ft viewing distance
    viewingDistance: 'far',
    touchOnly: false,
  },

  retailKiosk: {
    id: 'retailKiosk',
    name: 'Retail Kiosk (Square 1:1)',
    description: '1080x1080 high-res touch screen in store environments',
    width: 1080,
    height: 1080,
    safeArea: { top: 40, right: 40, bottom: 40, left: 40 },
    minTapTarget: 60, // Larger touch targets for standing kiosk interaction
    minTextSize: 20,
    viewingDistance: 'medium',
    touchOnly: true,
  },
};

/**
 * Factory helper for dynamic/custom surfaces
 */
export function createCustomSurface(params: Omit<SurfaceProfile, 'aspectRatio'>): SurfaceProfile {
  if (params.width <= 0 || params.height <= 0) {
    throw new Error('Surface dimensions must be positive non-zero numbers.');
  }

  return {
    ...params,
    aspectRatio: params.width / params.height,
  };
}
