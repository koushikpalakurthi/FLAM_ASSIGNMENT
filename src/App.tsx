import React, { useState, useMemo, useEffect, useRef } from 'react';
import { defineAd, AdSpec, AdElement } from './spec';
import { defaultSurfaces, SurfaceProfile, createCustomSurface } from './surfaces';
import { resolveLayout, ResolvedLayout } from './resolver';
import { DOMRenderer } from './render-dom';
import { renderLayoutToCanvas } from './render-canvas';
import {
  Smartphone,
  Tv,
  Monitor,
  Maximize2,
  Sliders,
  Sparkles,
  Code2,
  Layers,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Info,
  Plus,
  Play,
  Activity,
  Box,
  Eye,
  Hand,
  Settings2,
  RefreshCw
} from 'lucide-react';

// Default Realistic Product Ad Spec
const sampleAdSpec = defineAd({
  id: 'flam-audio-pro-ad',
  title: 'FLAM Audio Pro Launch',
  brandName: 'FLAM Audio',
  elements: [
    {
      id: 'brand-logo',
      type: 'image',
      role: 'branding',
      priority: 3,
      content: { text: 'FLAM AUDIO' }
    },
    {
      id: 'product-image',
      type: 'image',
      role: 'hero',
      priority: 1,
      content: {
        imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
        text: 'Spatial Audio Pro Headphones'
      }
    },
    {
      id: 'headline',
      type: 'text',
      role: 'primary',
      priority: 1,
      content: {
        text: 'Next-Gen Spatial Audio. Pure Silence.'
      }
    },
    {
      id: 'price',
      type: 'text',
      role: 'secondary',
      priority: 2,
      content: {
        price: '$299',
        originalPrice: '$399'
      }
    },
    {
      id: 'cta-button',
      type: 'button',
      role: 'action',
      priority: 1,
      content: {
        label: 'Claim Offer'
      }
    },
    {
      id: 'accent-badge',
      type: 'badge',
      role: 'accent',
      priority: 3,
      content: {
        badgeText: 'LIMITED EDITION'
      }
    }
  ]
});

export default function App() {
  const [selectedSurfaceKey, setSelectedSurfaceKey] = useState<string>('mobileInterstitial');
  const [surfacesMap, setSurfacesMap] = useState<Record<string, SurfaceProfile>>(defaultSurfaces);
  const [heightMultiplier, setHeightMultiplier] = useState<number>(1.0);
  const [activeTab, setActiveTab] = useState<'dom' | 'canvas' | 'split'>('dom');
  const [showGuides, setShowGuides] = useState<boolean>(true);
  const [showLogs, setShowLogs] = useState<boolean>(true);
  const [currentSpec, setCurrentSpec] = useState<AdSpec>(sampleAdSpec);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState<boolean>(false);

  // New Surface Form State
  const [customName, setCustomName] = useState('Billboard Ultrawide');
  const [customWidth, setCustomWidth] = useState(1400);
  const [customHeight, setCustomHeight] = useState(400);
  const [customViewingDistance, setCustomViewingDistance] = useState<'near' | 'medium' | 'far'>('far');
  const [customTouchOnly, setCustomTouchOnly] = useState(false);
  const [customMinTapTarget, setCustomMinTapTarget] = useState(44);
  const [customMinTextSize, setCustomMinTextSize] = useState(24);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Derive active surface factoring in the dynamic height degradation slider
  const activeBaseSurface = surfacesMap[selectedSurfaceKey] || defaultSurfaces.mobileInterstitial;
  const effectiveSurface: SurfaceProfile = useMemo(() => {
    const effectiveH = Math.round(activeBaseSurface.height * heightMultiplier);
    return {
      ...activeBaseSurface,
      height: effectiveH,
      aspectRatio: activeBaseSurface.width / effectiveH,
    };
  }, [activeBaseSurface, heightMultiplier]);

  // Execute Constraint Resolution Engine
  const resolvedLayout: ResolvedLayout = useMemo(() => {
    return resolveLayout(currentSpec, effectiveSurface);
  }, [currentSpec, effectiveSurface]);

  // Compute suitable UI display zoom scale factor
  const zoomScale = useMemo(() => {
    if (effectiveSurface.width > 1200) return 0.45;
    if (effectiveSurface.width > 800) return 0.55;
    if (effectiveSurface.height > 800) return 0.6;
    return 1.0;
  }, [effectiveSurface.width, effectiveSurface.height]);

  // Canvas Render Effect
  useEffect(() => {
    if ((activeTab === 'canvas' || activeTab === 'split') && canvasRef.current) {
      renderLayoutToCanvas(canvasRef.current, resolvedLayout, effectiveSurface, zoomScale);
    }
  }, [resolvedLayout, effectiveSurface, activeTab, zoomScale]);

  const handleCreateCustomSurface = (e: React.FormEvent) => {
    e.preventDefault();
    const newKey = `custom_${Date.now()}`;
    const newSurface = createCustomSurface({
      id: newKey,
      name: customName,
      description: `Custom ${customWidth}x${customHeight} (${customViewingDistance} viewing)`,
      width: customWidth,
      height: customHeight,
      safeArea: { top: 20, right: 30, bottom: 20, left: 30 },
      minTapTarget: customTouchOnly ? customMinTapTarget : 0,
      minTextSize: customMinTextSize,
      viewingDistance: customViewingDistance,
      touchOnly: customTouchOnly,
    });

    setSurfacesMap(prev => ({ ...prev, [newKey]: newSurface }));
    setSelectedSurfaceKey(newKey);
    setIsCustomModalOpen(false);
    setHeightMultiplier(1.0);
  };

  const toggleElementPriority = (elementId: string) => {
    setCurrentSpec(prev => ({
      ...prev,
      elements: prev.elements.map(el => {
        if (el.id !== elementId) return el;
        const nextPriority = el.priority === 1 ? 2 : el.priority === 2 ? 3 : 1;
        return { ...el, priority: nextPriority as 1 | 2 | 3 };
      })
    }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20 text-white">
            <Flame size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-lg tracking-tight text-white">FLAM Engine</h1>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 rounded-full uppercase tracking-wider">
                Multi-Surface Adaptive Layout
              </span>
            </div>
            <p className="text-xs text-slate-400">Constraint-Driven Ad Spec Solver without hardcoded per-surface rules</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('dom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'dom' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              DOM Renderer
            </button>
            <button
              onClick={() => setActiveTab('canvas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'canvas' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Canvas 2D Backend
            </button>
            <button
              onClick={() => setActiveTab('split')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'split' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Side-by-Side View
            </button>
          </div>

          <button
            onClick={() => setShowGuides(!showGuides)}
            className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
              showGuides
                ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Toggle Safe Area & Tap Target Guides"
          >
            <Box size={16} />
            <span>Guides</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        {/* Left Sidebar: Surface Picker & Constraints Control */}
        <div className="lg:col-span-3 border-r border-slate-800/80 bg-slate-900/40 p-5 flex flex-col gap-6 overflow-y-auto max-h-[calc(100vh-65px)]">
          {/* Surface Profile Selector */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={14} className="text-indigo-400" />
                Surface Profiles
              </span>
              <button
                onClick={() => setIsCustomModalOpen(true)}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-500/10 px-2 py-1 rounded-md border border-indigo-500/20"
              >
                <Plus size={12} />
                <span>Add Surface</span>
              </button>
            </div>

            <div className="space-y-2">
              {Object.entries(surfacesMap).map(([key, surface]) => {
                const isSelected = key === selectedSurfaceKey;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedSurfaceKey(key);
                      setHeightMultiplier(1.0);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-gradient-to-r from-indigo-950/80 to-slate-900 border-indigo-500/80 shadow-lg shadow-indigo-500/10 text-white'
                        : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-100 flex items-center gap-2">
                        {getSurfaceIcon(surface)}
                        {surface.name}
                      </span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                      <span>{surface.width}x{surface.height}px</span>
                      <span>•</span>
                      <span className="capitalize">{surface.viewingDistance} view</span>
                      <span>•</span>
                      <span>minText: {surface.minTextSize}px</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority Degradation Simulator Slider */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders size={14} className="text-amber-400" />
                Spatial Constraint Shrinker
              </label>
              <span className="text-xs font-mono text-amber-400 font-bold">
                {Math.round(heightMultiplier * 100)}% ({effectiveSurface.height}px)
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Shrink available surface height to watch engine dynamically degrade & drop priority 3/2 elements cleanly!
            </p>
            <input
              type="range"
              min="0.3"
              max="1.0"
              step="0.05"
              value={heightMultiplier}
              onChange={(e) => setHeightMultiplier(parseFloat(e.target.value))}
              className="w-full accent-amber-500 bg-slate-800 rounded-lg cursor-pointer h-2"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>30% Restricted Height</span>
              <span>100% Full Height</span>
            </div>
          </div>

          {/* Ad Spec Element Priority Editor */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Settings2 size={14} className="text-indigo-400" />
                Spec Element Priorities
              </span>
            </div>
            <p className="text-xs text-slate-400">Click priority tags to cycle priority (P1 = Highest, P3 = Lowest)</p>
            
            <div className="space-y-2">
              {currentSpec.elements.map((el) => {
                const isDropped = resolvedLayout.droppedElementIds.includes(el.id);
                const isShrunk = resolvedLayout.shrunkElementIds.includes(el.id);

                return (
                  <div
                    key={el.id}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-colors ${
                      isDropped
                        ? 'bg-rose-950/30 border-rose-900/50 text-slate-500'
                        : isShrunk
                        ? 'bg-amber-950/30 border-amber-900/50 text-slate-200'
                        : 'bg-slate-950/60 border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-semibold capitalize text-slate-300">{el.role}</span>
                      <span className="text-[10px] font-mono text-slate-500 truncate">({el.id})</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isDropped ? (
                        <span className="text-[10px] font-bold text-rose-400 px-1.5 py-0.5 bg-rose-950 rounded">Dropped</span>
                      ) : isShrunk ? (
                        <span className="text-[10px] font-bold text-amber-400 px-1.5 py-0.5 bg-amber-950 rounded">Shrunk</span>
                      ) : null}

                      <button
                        onClick={() => toggleElementPriority(el.id)}
                        className={`px-2 py-0.5 rounded font-extrabold text-[11px] transition-transform active:scale-90 ${
                          el.priority === 1
                            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                            : el.priority === 2
                            ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                            : 'bg-slate-700/50 border border-slate-600 text-slate-400'
                        }`}
                      >
                        P{el.priority}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center Preview Workspace */}
        <div className="lg:col-span-6 p-6 flex flex-col items-center justify-center bg-slate-950 relative overflow-auto min-h-[500px]">
          {/* Surface Header Banner */}
          <div className="mb-4 flex items-center gap-3 bg-slate-900/90 px-4 py-2 rounded-full border border-slate-800 text-xs text-slate-300">
            <span className="font-bold text-indigo-400">{activeBaseSurface.name}</span>
            <span>•</span>
            <span className="font-mono">{effectiveSurface.width}x{effectiveSurface.height}px</span>
            <span>•</span>
            <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full font-bold uppercase tracking-wider text-[10px]">
              Topology: {resolvedLayout.macroTopology}
            </span>
          </div>

          {/* Render Views */}
          {activeTab === 'dom' && (
            <DOMRenderer
              layout={resolvedLayout}
              surface={effectiveSurface}
              scale={zoomScale}
              showSafeAreaGuides={showGuides}
              showTapTargetGuides={showGuides}
            />
          )}

          {activeTab === 'canvas' && (
            <div className="relative flex flex-col items-center">
              <canvas
                ref={canvasRef}
                className="rounded-2xl border border-slate-700 shadow-2xl bg-slate-900"
              />
              <span className="mt-2 text-[11px] font-mono text-slate-400">Rendered via HTML5 Canvas 2D Backend</span>
            </div>
          )}

          {activeTab === 'split' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl items-center justify-center">
              <div className="flex flex-col items-center">
                <span className="mb-2 text-xs font-bold text-indigo-400">DOM/CSS Renderer</span>
                <DOMRenderer
                  layout={resolvedLayout}
                  surface={effectiveSurface}
                  scale={zoomScale * 0.7}
                  showSafeAreaGuides={showGuides}
                  showTapTargetGuides={showGuides}
                />
              </div>
              <div className="flex flex-col items-center">
                <span className="mb-2 text-xs font-bold text-purple-400">Canvas 2D Backend</span>
                <canvas
                  ref={canvasRef}
                  className="rounded-2xl border border-slate-700 shadow-2xl bg-slate-900"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Engine Diagnostics & Constraint Log */}
        <div className="lg:col-span-3 border-l border-slate-800/80 bg-slate-900/40 p-5 flex flex-col gap-5 overflow-y-auto max-h-[calc(100vh-65px)]">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <Activity size={14} className="text-emerald-400" />
              Solver Diagnostic Metrics
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                <span className="text-[10px] text-slate-400 block font-medium">Resolution Time</span>
                <span className="text-lg font-black font-mono text-emerald-400">{resolvedLayout.resolutionTimeMs}ms</span>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                <span className="text-[10px] text-slate-400 block font-medium">Constraint Status</span>
                <span className={`text-xs font-extrabold flex items-center gap-1 mt-1 ${
                  resolvedLayout.isConstraintSatisfied ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {resolvedLayout.isConstraintSatisfied ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  {resolvedLayout.isConstraintSatisfied ? '100% Satisfied' : 'Degraded Fit'}
                </span>
              </div>
            </div>
          </div>

          {/* Degradation Summary Card */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Degradation Report
            </span>

            <div className="flex flex-col gap-1.5 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Active Elements:</span>
                <span className="text-slate-100 font-bold">{resolvedLayout.elements.filter(e => e.isVisible).length} / {currentSpec.elements.length}</span>
              </div>
              <div className="flex justify-between text-amber-400">
                <span>Shrunk Elements:</span>
                <span className="font-bold">{resolvedLayout.shrunkElementIds.length}</span>
              </div>
              <div className="flex justify-between text-rose-400">
                <span>Dropped Elements:</span>
                <span className="font-bold">{resolvedLayout.droppedElementIds.length}</span>
              </div>
            </div>
          </div>

          {/* Step-by-Step Solver Execution Log */}
          <div className="flex-1 flex flex-col min-h-[250px]">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Code2 size={14} className="text-cyan-400" />
              Solver Execution Trace Log
            </span>

            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] overflow-y-auto space-y-2 max-h-[350px]">
              {resolvedLayout.diagnosticLogs.map((logItem, index) => (
                <div
                  key={index}
                  className={`p-1.5 rounded border transition-colors ${
                    logItem.severity === 'degradation'
                      ? 'bg-amber-950/30 border-amber-800/40 text-amber-300'
                      : logItem.severity === 'warning'
                      ? 'bg-rose-950/30 border-rose-800/40 text-rose-300'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[9px] text-slate-500 mb-0.5">
                    <span className="font-bold uppercase tracking-wider text-cyan-400">{logItem.stage}</span>
                    <span>+{logItem.timestamp.toFixed(1)}ms</span>
                  </div>
                  <p className="leading-snug">{logItem.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal for 5th Custom Surface Creator */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus size={18} className="text-indigo-400" />
                Add Custom Surface Profile
              </h3>
              <button
                onClick={() => setIsCustomModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomSurface} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Surface Name</label>
                <input
                  type="text"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Width (px)</label>
                  <input
                    type="number"
                    value={customWidth}
                    onChange={e => setCustomWidth(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Height (px)</label>
                  <input
                    type="number"
                    value={customHeight}
                    onChange={e => setCustomHeight(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Viewing Distance</label>
                  <select
                    value={customViewingDistance}
                    onChange={e => setCustomViewingDistance(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  >
                    <option value="near">Near (Handheld/Phone)</option>
                    <option value="medium">Medium (Kiosk/Desktop)</option>
                    <option value="far">Far (TV/Billboard)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Min Text Size (px)</label>
                  <input
                    type="number"
                    value={customMinTextSize}
                    onChange={e => setCustomMinTextSize(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <div>
                  <span className="block font-semibold text-slate-200">Touch Interactive</span>
                  <span className="text-[10px] text-slate-400">Enforces min tap target size constraint</span>
                </div>
                <input
                  type="checkbox"
                  checked={customTouchOnly}
                  onChange={e => setCustomTouchOnly(e.target.checked)}
                  className="w-4 h-4 accent-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCustomModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-500 shadow-lg shadow-indigo-600/30"
                >
                  Add Surface Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function getSurfaceIcon(surface: SurfaceProfile) {
  if (surface.width === 1920) return <Tv size={16} className="text-purple-400" />;
  if (surface.width === 1080 && surface.height === 1080) return <Monitor size={16} className="text-cyan-400" />;
  if (surface.width < surface.height) return <Smartphone size={16} className="text-emerald-400" />;
  return <Maximize2 size={16} className="text-amber-400" />;
}
