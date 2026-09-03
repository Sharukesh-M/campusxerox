import { ColorMode, Side, BindingType, type PrintConfig, type PriceBreakdown, type PricingSettings, type PdfDocumentConfig } from '@/types';

/**
 * Parse page range string (e.g. "1, 22" or "1, 5-10, 22") into a set of unique 1-indexed page numbers.
 */
export function parseCustomColorPages(rangeStr: string, totalPages: number): Set<number> {
  const result = new Set<number>();
  if (!rangeStr || !rangeStr.trim()) return result;

  const parts = rangeStr.split(/[,;\s]+/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        const from = Math.max(1, Math.min(start, end));
        const to = Math.min(totalPages, Math.max(start, end));
        for (let p = from; p <= to; p++) {
          result.add(p);
        }
      }
    } else {
      const pageNum = parseInt(trimmed, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        result.add(pageNum);
      }
    }
  }

  return result;
}

/**
 * Server-side pricing engine for a single PDF configuration.
 */
export function calculatePrintPrice(
  config: PrintConfig,
  prices: PricingSettings
): PriceBreakdown {
  const { pageCount, colorMode, customColorPages = '', side, pagesPerSheet, copies, bindingType } = config;

  let colorPagesCount = 0;
  let bwPagesCount = 0;
  let physicalSheets = 0;
  let pricePerUnit = 0;
  let printingSubtotal = 0;

  const colorRate = Number(prices.color_per_page);
  const bwSingleRate = Number(prices.bw_single_side);
  const bwBothRate = Number(prices.bw_both_side);
  const bwTwoRate = Number(prices.bw_two_pages_sheet);

  if (colorMode === ColorMode.COLOR) {
    colorPagesCount = pageCount;
    bwPagesCount = 0;
    physicalSheets = calculatePhysicalSheets(pageCount, pagesPerSheet, side);
    pricePerUnit = colorRate;
    printingSubtotal = roundTo2(pageCount * colorRate * copies);
  } else if (colorMode === ColorMode.CUSTOM_PAGES) {
    const customPagesSet = parseCustomColorPages(customColorPages, pageCount);
    colorPagesCount = customPagesSet.size;
    bwPagesCount = pageCount - colorPagesCount;

    const colorSubtotal = colorPagesCount * colorRate;

    let bwSubtotal = 0;
    if (pagesPerSheet === 2) {
      const bwSheets = side === Side.BOTH ? Math.ceil(bwPagesCount / 4) : Math.ceil(bwPagesCount / 2);
      bwSubtotal = bwSheets * bwTwoRate;
    } else {
      if (side === Side.BOTH) {
        const bwSheets = Math.ceil(bwPagesCount / 2);
        bwSubtotal = bwSheets * bwBothRate;
      } else {
        bwSubtotal = bwPagesCount * bwSingleRate;
      }
    }

    physicalSheets = calculatePhysicalSheets(pageCount, pagesPerSheet, side);
    pricePerUnit = bwSingleRate;
    printingSubtotal = roundTo2((colorSubtotal + bwSubtotal) * copies);
  } else {
    // All B&W
    colorPagesCount = 0;
    bwPagesCount = pageCount;

    if (pagesPerSheet === 2) {
      physicalSheets = side === Side.BOTH ? Math.ceil(pageCount / 4) : Math.ceil(pageCount / 2);
      pricePerUnit = bwTwoRate;
    } else {
      if (side === Side.BOTH) {
        physicalSheets = Math.ceil(pageCount / 2);
        pricePerUnit = bwBothRate;
      } else {
        physicalSheets = pageCount;
        pricePerUnit = bwSingleRate;
      }
    }

    printingSubtotal = roundTo2(physicalSheets * pricePerUnit * copies);
  }

  let bindingCost = 0;
  if (bindingType === BindingType.SOFT) {
    bindingCost = Number(prices.soft_binding_cost || 20.00) * copies;
  }

  const totalAmount = roundTo2(printingSubtotal + bindingCost);

  return {
    physicalSheets,
    pricePerUnit,
    colorPagesCount,
    bwPagesCount,
    printingSubtotal,
    bindingCost,
    totalAmount,
  };
}

/**
 * Calculate total pricing across multiple PDF documents with individual per-PDF configurations.
 */
export function calculateMultiPdfOrderPrice(
  pdfConfigs: PdfDocumentConfig[],
  prices: PricingSettings
): PriceBreakdown {
  let totalSheets = 0;
  let totalColorPages = 0;
  let totalBwPages = 0;
  let totalPrintingSubtotal = 0;
  let totalBindingCost = 0;

  for (const item of pdfConfigs) {
    const breakdown = calculatePrintPrice(
      {
        pageCount: item.pageCount,
        colorMode: item.colorMode || ColorMode.BW,
        customColorPages: item.customColorPages || '',
        side: item.side || Side.SINGLE,
        pagesPerSheet: item.pagesPerSheet || 1,
        copies: item.copies || 1,
        bindingType: item.bindingType || BindingType.NONE,
      },
      prices
    );

    totalSheets += breakdown.physicalSheets;
    totalColorPages += breakdown.colorPagesCount;
    totalBwPages += breakdown.bwPagesCount;
    totalPrintingSubtotal += breakdown.printingSubtotal;
    totalBindingCost += breakdown.bindingCost;
  }

  const grandTotal = roundTo2(totalPrintingSubtotal + totalBindingCost);

  return {
    physicalSheets: totalSheets,
    pricePerUnit: 0,
    colorPagesCount: totalColorPages,
    bwPagesCount: totalBwPages,
    printingSubtotal: roundTo2(totalPrintingSubtotal),
    bindingCost: roundTo2(totalBindingCost),
    totalAmount: grandTotal,
  };
}

function calculatePhysicalSheets(
  pageCount: number,
  pagesPerSheet: number,
  side: Side
): number {
  const sidesPerSheet = side === Side.BOTH ? 2 : 1;
  const pagesPerPhysicalSheet = pagesPerSheet * sidesPerSheet;
  return Math.ceil(pageCount / pagesPerPhysicalSheet);
}

function roundTo2(num: number): number {
  return Math.round(num * 100) / 100;
}
