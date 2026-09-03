/**
 * Receipt service — generates PDF receipts for completed orders.
 * Uses jsPDF for lightweight server-side PDF generation.
 */

import { jsPDF } from 'jspdf';
import type { Order, Profile } from '@/types';

/**
 * Generate a receipt PDF buffer for a completed order.
 */
export function generateReceipt(order: Order, profile: Profile): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5', // Smaller format for receipts
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 20;

  // ---- Header ----
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('CampusXerox', pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Print Order Receipt', pageWidth / 2, y, { align: 'center' });
  y += 12;

  // ---- Divider ----
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ---- Order Details ----
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Order #${order.order_code}`, margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const details = [
    ['Student', profile.name],
    ['Email', profile.email],
    ['File', order.file_name || 'N/A'],
    ['Pages', `${order.page_count} PDF pages`],
    [''],
    ['Color Mode', order.color_mode === 'BW' ? 'Black & White' : 'Color'],
    ['Sides', order.side === 'SINGLE' ? 'Single Side' : 'Both Sides'],
    ['Layout', `${order.pages_per_sheet} page(s) per sheet`],
    ['Copies', `${order.copies}`],
    [''],
    ['Order Date', formatDate(order.created_at)],
    ['Completed', order.completed_at ? formatDate(order.completed_at) : 'N/A'],
    ['UTR Number', order.utr_number || 'N/A'],
  ];

  for (const [label, value] of details) {
    if (!label) {
      y += 4;
      continue;
    }
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value || '', margin + 35, y);
    y += 6;
  }

  // ---- Divider ----
  y += 4;
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ---- Amount ----
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Total Amount Paid', margin, y);
  doc.text(`₹${Number(order.total_amount).toFixed(2)}`, pageWidth - margin, y, {
    align: 'right',
  });
  y += 12;

  // ---- Footer ----
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(128, 128, 128);
  doc.text('This is a computer-generated receipt.', pageWidth / 2, y, {
    align: 'center',
  });
  y += 4;
  doc.text(
    `Generated on ${formatDate(new Date().toISOString())}`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );

  // Return as Buffer
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
