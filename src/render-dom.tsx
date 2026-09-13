/**
 * DOM/CSS Rendering Backend
 * Renders a ResolvedLayout to interactive DOM nodes with smooth CSS/Framer Motion transitions.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ResolvedLayout, ResolvedElementRect } from './resolver';
import { SurfaceProfile } from './surfaces';
import { Sparkles, ShoppingBag, ShieldCheck, AlertCircle, Eye, Hand, Headphones, Zap } from 'lucide-react';

interface DOMRendererProps {
  layout: ResolvedLayout;
  surface: SurfaceProfile;
  scale?: number;
  showSafeAreaGuides?: boolean;
  showTapTargetGuides?: boolean;
}

export const DOMRenderer: React.FC<DOMRendererProps> = ({
  layout,
  surface,
  scale = 1,
  showSafeAreaGuides = true,
  showTapTargetGuides = true,
}) => {
  const containerW = surface.width * scale;
  const containerH = surface.height * scale;

  return (
    <div
      className="relative overflow-hidden bg-slate-950 border border-slate-700/80 shadow-2xl rounded-2xl transition-all duration-300 select-none glow-indigo"
      style={{
        width: `${containerW}px`,
        height: `${containerH}px`,
        background: 'radial-gradient(ellipse at top left, #1e1b4b 0%, #0f172a 45%, #030712 100%)',
      }}
    >
      {/* Background Decorative Mesh Glow */}
      <div className="absolute -top-16 -left-16 w-56 h-56 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -right-16 w-56 h-56 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Safe Area Guideline Overlay */}
      {showSafeAreaGuides && surface.safeArea && (
        <div
          className="absolute border border-dashed border-cyan-400/40 pointer-events-none rounded-xl transition-all duration-300 z-40 bg-cyan-500/[0.02]"
          style={{
            left: `${surface.safeArea.left * scale}px`,
            top: `${surface.safeArea.top * scale}px`,
            width: `${layout.usableBounds.width * scale}px`,
            height: `${layout.usableBounds.height * scale}px`,
          }}
        >
          <span className="absolute top-1 left-2 text-[9px] font-mono tracking-wider text-cyan-300/80 uppercase font-bold bg-slate-950/80 px-1.5 py-0.5 rounded border border-cyan-500/30">
            Safe Area ({layout.usableBounds.width}x{layout.usableBounds.height}px)
          </span>
        </div>
      )}

      {/* Render Active & Transitioning Elements */}
      <AnimatePresence mode="sync">
        {layout.elements.map((rect) => {
          if (!rect.isVisible && rect.opacity === 0) return null;

          return (
            <motion.div
              key={rect.id}
              initial={false}
              animate={{
                x: rect.x * scale,
                y: rect.y * scale,
                width: rect.width * scale,
                height: rect.height * scale,
                opacity: rect.opacity,
                scale: rect.isVisible ? 1 : 0.8,
              }}
              transition={{
                type: 'spring',
                stiffness: 350,
                damping: 28,
              }}
              className="absolute flex items-center transition-shadow group z-10"
              style={{
                zIndex: rect.priority === 1 ? 30 : rect.priority === 2 ? 20 : 10,
              }}
            >
              <RenderElementContent
                rect={rect}
                scale={scale}
                surface={surface}
                showTapTargetGuides={showTapTargetGuides}
              />

              {/* Degradation State Indicator Badge */}
              {rect.degradationState === 'shrunk' && (
                <div className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-amber-500 text-slate-950 font-extrabold text-[9px] rounded-full shadow-lg pointer-events-none z-50 flex items-center gap-1">
                  <span>Shrunk</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

const RenderElementContent: React.FC<{
  rect: ResolvedElementRect;
  scale: number;
  surface: SurfaceProfile;
  showTapTargetGuides: boolean;
}> = ({ rect, scale, surface, showTapTargetGuides }) => {
  const scaledFontSize = rect.fontSize ? rect.fontSize * scale : 14 * scale;
  const [imgFailed, setImgFailed] = useState(false);

  switch (rect.role) {
    case 'branding':
      return (
        <div className="w-full h-full flex items-center justify-start gap-2 text-indigo-300 font-bold tracking-tight">
          <div className="p-1.5 bg-indigo-500/20 border border-indigo-400/40 rounded-xl flex items-center justify-center text-indigo-300 shadow-md">
            <Sparkles size={Math.max(12, 16 * scale)} />
          </div>
          <span className="font-black text-white truncate tracking-wider" style={{ fontSize: `${scaledFontSize}px` }}>
            {rect.content.text || 'FLAM'}
          </span>
        </div>
      );

    case 'hero':
      return (
        <div className="w-full h-full relative rounded-2xl overflow-hidden border border-indigo-500/30 bg-gradient-to-br from-indigo-950/90 via-slate-900 to-slate-950 shadow-2xl group hover:border-indigo-400/60 transition-colors flex items-center justify-center">
          {rect.content.imageUrl && !imgFailed ? (
            <img
              src={rect.content.imageUrl}
              alt="Product"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-indigo-900/40 via-purple-950/30 to-slate-950">
              <div className="p-3 bg-indigo-500/20 border border-indigo-400/40 rounded-full text-indigo-300 mb-2 shadow-lg animate-pulse">
                <Headphones size={Math.max(18, 32 * scale)} />
              </div>
              <span className="text-white font-extrabold tracking-tight truncate text-xs">
                Spatial Audio Pro
              </span>
              <span className="text-[10px] text-indigo-300/80 font-mono mt-0.5">High-Fidelity Audio</span>
            </div>
          )}
        </div>
      );

    case 'primary':
      return (
        <div className="w-full h-full flex items-center">
          <h1
            className="font-extrabold tracking-tight text-white leading-tight drop-shadow-md"
            style={{
              fontSize: `${scaledFontSize}px`,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            {rect.content.text}
          </h1>
        </div>
      );

    case 'secondary':
      return (
        <div className="w-full h-full flex items-center gap-2">
          <span
            className="font-black text-amber-400 tracking-tight drop-shadow-md"
            style={{ fontSize: `${scaledFontSize}px` }}
          >
            {rect.content.price || rect.content.text}
          </span>
          {rect.content.originalPrice && (
            <span
              className="line-through text-slate-400 font-semibold"
              style={{ fontSize: `${scaledFontSize * 0.7}px` }}
            >
              {rect.content.originalPrice}
            </span>
          )}
        </div>
      );

    case 'action': {
      const isTouchValid = !surface.touchOnly || rect.height >= surface.minTapTarget;
      return (
        <div className="w-full h-full relative flex items-center justify-center">
          <button
            className={`w-full h-full flex items-center justify-center gap-2 font-extrabold text-white rounded-xl shadow-xl transition-all active:scale-95 ${
              isTouchValid
                ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 hover:brightness-110 shadow-indigo-500/30 border border-indigo-400/40'
                : 'bg-rose-600/90 border border-rose-400/50'
            }`}
            style={{
              fontSize: `${scaledFontSize}px`,
              padding: `${6 * scale}px ${12 * scale}px`,
            }}
          >
            <Zap size={Math.max(12, 16 * scale)} className="fill-white/20" />
            <span className="truncate">{rect.content.label || 'Shop Now'}</span>
          </button>

          {/* Tap Target Constraint Indicator */}
          {showTapTargetGuides && surface.touchOnly && (
            <div
              className={`absolute -bottom-4 right-0 px-1 py-0.5 text-[8px] font-mono rounded flex items-center gap-1 shadow-md ${
                isTouchValid ? 'bg-slate-900 text-emerald-400 border border-emerald-500/40' : 'bg-rose-950 text-rose-300 border border-rose-500/50'
              }`}
            >
              <Hand size={10} />
              <span>{rect.height}px (min: {surface.minTapTarget}px)</span>
            </div>
          )}
        </div>
      );
    }

    case 'accent':
      return (
        <div
          className="w-full h-full flex items-center justify-center bg-indigo-500/20 border border-indigo-400/50 rounded-full px-3 text-indigo-300 font-bold uppercase tracking-wider shadow-md"
          style={{ fontSize: `${scaledFontSize}px` }}
        >
          <span>{rect.content.badgeText || 'SPECIAL'}</span>
        </div>
      );

    default:
      return (
        <div className="w-full h-full bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white">
          {rect.id}
        </div>
      );
  }
};
