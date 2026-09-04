'use client';

import { useState } from 'react';
import { ColorMode, Side, PagesPerSheet } from '@/types';
import { parseCustomColorPages } from '@/services/pricing';

interface PrintPreviewCanvasProps {
  colorMode: ColorMode;
  customColorPages?: string;
  side: Side;
  pagesPerSheet: PagesPerSheet | number;
  pageCount?: number;
}

export default function PrintPreviewCanvas({
  colorMode,
  customColorPages = '',
  side,
  pagesPerSheet,
  pageCount = 30,
}: PrintPreviewCanvasProps) {
  const [viewSide, setViewSide] = useState<'FRONT' | 'BACK'>('FRONT');

  const isBothSides = side === Side.BOTH;
  const pps = Number(pagesPerSheet) === 2 ? 2 : 1; // 1 or 2 horizontal
  const colorPagesSet = parseCustomColorPages(customColorPages, pageCount);

  // Check if a specific PDF page is color
  const isPageColor = (pageNum: number) => {
    if (colorMode === ColorMode.COLOR) return true;
    if (colorMode === ColorMode.CUSTOM_PAGES) return colorPagesSet.has(pageNum);
    return false;
  };

  const [bgTheme, setBgTheme] = useState<'blueprint' | 'cyber' | 'warm' | 'slate'>('blueprint');

  const THEMES: Record<string, { bg: string; grid: string; glow: string; label: string }> = {
    blueprint: {
      bg: 'bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 border-blue-800/40',
      grid: 'bg-[linear-gradient(to_right,#3b82f61a_1px,transparent_1px),linear-gradient(to_bottom,#3b82f61a_1px,transparent_1px)] [background-size:20px_20px]',
      glow: 'bg-blue-500/10',
      label: '📐 Blueprint',
    },
    cyber: {
      bg: 'bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-950 border-purple-700/40',
      grid: 'bg-[radial-gradient(#a855f7_1px,transparent_1px)] [background-size:18px_18px] opacity-20',
      glow: 'bg-purple-500/15',
      label: '✨ Cyber',
    },
    warm: {
      bg: 'bg-gradient-to-br from-amber-950 via-stone-900 to-zinc-950 border-amber-800/40',
      grid: 'bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:24px_24px] opacity-15',
      glow: 'bg-amber-500/10',
      label: '🪵 Studio',
    },
    slate: {
      bg: 'bg-gradient-to-br from-slate-900 via-zinc-900 to-slate-950 border-slate-700/50',
      grid: 'bg-[radial-gradient(#64748b_1px,transparent_1px)] [background-size:16px_16px] opacity-15',
      glow: 'bg-slate-500/10',
      label: '⬛ Slate',
    },
  };

  const activeTheme = THEMES[bgTheme] || THEMES.blueprint;

  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-2xl border transition-all duration-500 ${activeTheme.bg}`}>
      {/* Background UI Grid texture accent */}
      <div className={`absolute inset-0 pointer-events-none ${activeTheme.grid}`} />
      <div className={`absolute -top-24 -left-24 w-64 h-64 rounded-full blur-3xl pointer-events-none ${activeTheme.glow}`} />
      <div className={`absolute -bottom-24 -right-24 w-64 h-64 rounded-full blur-3xl pointer-events-none ${activeTheme.glow}`} />

      {/* Header bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <span className="text-xs font-bold text-surface-100 uppercase tracking-wider">
            Live Print Spec Preview
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Background theme selector */}
          <div className="flex bg-black/30 p-0.5 rounded-lg border border-white/10 text-[10px]">
            {Object.entries(THEMES).map(([key, t]) => (
              <button
                key={key}
                type="button"
                onClick={() => setBgTheme(key as any)}
                className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                  bgTheme === key
                    ? 'bg-white text-surface-900 shadow-xs'
                    : 'text-surface-300 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Both sides flip button */}
          {isBothSides ? (
            <button
              onClick={() => setViewSide(viewSide === 'FRONT' ? 'BACK' : 'FRONT')}
              className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-500 text-white text-xs px-3 py-1 rounded-xl transition-all font-semibold shadow-lg shadow-primary-600/30 active:scale-95"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Flip to {viewSide === 'FRONT' ? 'Back' : 'Front'}
            </button>
          ) : (
            <span className="text-[11px] font-medium bg-white/10 text-surface-200 border border-white/10 px-2.5 py-0.5 rounded-full">
              Single Side
            </span>
          )}
        </div>
      </div>

      {/* PAPER CANVAS CONTAINER */}
      <div className="relative z-10 flex flex-col items-center justify-center py-2">
        {/* Physical Paper Sheet (Landscape for 2-pages horizontal, Portrait for 1-page) */}
        <div
          className={`relative bg-white text-surface-900 rounded-xl shadow-2xl p-4 transition-all duration-300 border border-surface-300 flex flex-col justify-between ${
            pps === 2
              ? 'w-72 sm:w-80 aspect-[1.4/1]' // Horizontal Landscape orientation for 2-pages
              : 'w-48 sm:w-56 aspect-[1/1.4]' // Vertical Portrait orientation for 1-page
          }`}
        >
          {/* Paper Top Spec Banner */}
          <div className="flex items-center justify-between text-[9px] font-mono text-surface-400 border-b border-surface-200 pb-1 mb-2">
            <span>A4 PAPER SHEET</span>
            <span className="font-bold text-primary-600">
              {isBothSides ? `${viewSide} SIDE` : 'FRONT'}
            </span>
          </div>

          {/* Page Grid (1 Page Portrait OR 2 Pages Horizontal Side-by-Side) */}
          <div className={`flex-1 grid gap-2.5 ${pps === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {Array.from({ length: pps }).map((_, idx) => {
              // Calculate page number
              let pageNum = idx + 1;
              if (isBothSides && viewSide === 'BACK') {
                pageNum = pps + idx + 1;
              }

              const hasColor = isPageColor(pageNum);

              return (
                <div
                  key={idx}
                  className={`relative border rounded-lg p-2 flex flex-col justify-between transition-all ${
                    hasColor
                      ? 'border-violet-300 bg-violet-50/60 shadow-sm'
                      : 'border-surface-300 bg-surface-50/80'
                  }`}
                >
                  {/* Page Top Header */}
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      hasColor
                        ? 'bg-violet-600 text-white shadow-xs'
                        : 'bg-surface-200 text-surface-700'
                    }`}>
                      Page {pageNum <= pageCount ? pageNum : '-'}
                    </span>
                    <span className={`text-[8px] font-bold ${
                      hasColor ? 'text-violet-600' : 'text-surface-400'
                    }`}>
                      {hasColor ? '🎨 Color' : '🖨 B&W'}
                    </span>
                  </div>

                  {/* Dummy Simulated Document Lines & Margins */}
                  <div className="space-y-1 my-1.5">
                    <div className={`h-1 rounded w-3/4 ${hasColor ? 'bg-violet-400' : 'bg-surface-400'}`} />
                    <div className={`h-1 rounded w-full ${hasColor ? 'bg-violet-300' : 'bg-surface-300'}`} />
                    <div className={`h-1 rounded w-5/6 ${hasColor ? 'bg-violet-300' : 'bg-surface-200'}`} />
                    <div className={`h-1 rounded w-2/3 ${hasColor ? 'bg-violet-300' : 'bg-surface-200'}`} />
                  </div>

                  {/* Page Footer */}
                  <div className="text-[7px] text-surface-400 text-right font-mono">
                    {pps === 2 ? 'Horizontal Layout' : 'Full Page'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paper Footer Spec */}
          <div className="flex justify-between items-center text-[8px] text-surface-400 mt-2 pt-1 border-t border-surface-100 font-mono">
            <span>CampusXerox Spec</span>
            <span>{pps === 2 ? '2 Pages Side-by-Side' : '1 Page Full Sheet'}</span>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="relative z-10 text-center text-xs text-surface-300 mt-3 flex items-center justify-center gap-3">
        <span>📄 {pps === 2 ? '2 Pages Per Sheet (Horizontal)' : '1 Page Per Sheet'}</span>
        <span>·</span>
        <span>{isBothSides ? '🔄 Double-Sided (Both Sides)' : '📄 Single-Sided'}</span>
      </div>
    </div>
  );
}
