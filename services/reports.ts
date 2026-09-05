/**
 * Reports service — generates PDF order summary reports for admin.
 * Uses jsPDF for clean, server-side PDF report rendering.
 */

import { jsPDF } from 'jspdf';
import type { Order } from '@/types';

export function generateOrdersPdfReport(
  orders: Order[],
  statusFilter: string = 'ALL'
): Buffer {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 16;

  // Header Banner
  doc.setFillColor(30, 41, 59); // Deep Slate background
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('CampusXerox — Orders Summary Report', margin, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  const nowStr = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  doc.text(`Generated on: ${nowStr}  |  Category Filter: ${statusFilter}`, margin, 21);

  y = 36;

  // Stats Summary Bar
  const totalAmount = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 14, 3, 3, 'F');

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Orders: ${orders.length}`, margin + 6, y + 9);
  doc.text(`Total Revenue Sum: INR ${totalAmount.toFixed(2)}`, margin + 80, y + 9);
  doc.text(`Shop Contact: Surya (8015587361)`, pageWidth - margin - 60, y + 9);

  y += 22;

  // Table Column Definitions & Widths
  const columns = [
    { header: '#', width: 8 },
    { header: 'Order Code', width: 22 },
    { header: 'Student Name', width: 38 },
    { header: 'Phone Number', width: 28 },
    { header: 'Email Address', width: 48 },
    { header: 'Amount (₹)', width: 24 },
    { header: 'Payment Mode', width: 26 },
    { header: 'Status', width: 35 },
    { header: 'Created Date', width: 40 },
  ];

  // Render Table Header
  doc.setFillColor(79, 70, 229); // Primary Indigo header
  doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');

  let currentX = margin + 2;
  for (const col of columns) {
    doc.text(col.header, currentX, y + 5.5);
    currentX += col.width;
  }

  y += 8;

  // Render Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  let rowCount = 0;
  for (const o of orders) {
    // Check for page overflow
    if (y + 10 > pageHeight - 15) {
      doc.addPage();
      y = 16;

      // Re-render header on new page
      doc.setFillColor(79, 70, 229);
      doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');

      let colX = margin + 2;
      for (const col of columns) {
        doc.text(col.header, colX, y + 5.5);
        colX += col.width;
      }
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
    }

    rowCount++;
    // Alternating row background
    if (rowCount % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, pageWidth - margin * 2, 7.5, 'F');
    }

    doc.setTextColor(30, 41, 59);

    const values = [
      String(rowCount),
      `#${o.order_code || ''}`,
      (o.student_name || 'Student').slice(0, 18),
      o.phone_number || '-',
      (o.email || '-').slice(0, 24),
      `₹${Number(o.total_amount || 0).toFixed(2)}`,
      o.utr_number === 'HAND_CASH' ? 'Hand Cash' : 'UPI',
      o.order_status || o.payment_status || 'PENDING',
      new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    ];

    let valX = margin + 2;
    for (let i = 0; i < columns.length; i++) {
      doc.text(values[i], valX, y + 5);
      valX += columns[i].width;
    }

    // Row bottom border line
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + 7.5, pageWidth - margin, y + 7.5);

    y += 7.5;
  }

  // Footer Page Number
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${totalPages}  |  CampusXerox Computer-Generated Official Report`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
