import { jsPDF } from 'jspdf';
import { FormFillupInvoiceData, InvoiceLineMetric } from './formFillupInvoiceLogic';
import { User } from '../types/attendance';

export interface FormFillupInvoicePDFOptions {
  invoice: FormFillupInvoiceData;
  coordinator?: User;
  generatedBy?: User | null;
  includeSignatures?: boolean;
}

const FONT_STACK =
  "'Noto Sans Bengali', 'Plus Jakarta Sans', 'SolaimanLipi', 'Kalpurush', Arial, sans-serif";

function formatCellNum(n: number): string {
  return n > 0 ? String(n) : '';
}

function drawCenteredLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  w: number,
  h: number,
  lineHeight: number
) {
  const totalHeight = lines.length * lineHeight;
  const startY = y + (h - totalHeight) / 2 + lineHeight * 0.72;
  lines.forEach((line, idx) => {
    ctx.fillText(line, x + w / 2, startY + idx * lineHeight);
  });
}

function drawMetricRowCells(
  ctx: CanvasRenderingContext2D,
  metric: InvoiceLineMetric,
  colX: number[],
  colW: number[],
  y: number,
  rowH: number,
  strokeColor: string
) {
  // Draw cell borders for columns 2..6 (Rate, Count, Total, Board, Institute)
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  for (let c = 2; c <= 6; c++) {
    ctx.strokeRect(colX[c], y, colW[c], rowH);
  }

  ctx.fillStyle = '#111827';
  ctx.font = `500 28px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const cy = y + rowH / 2 + 10;

  // Rate/Dor (always shown)
  ctx.fillText(metric.rateDisplay, colX[2] + colW[2] / 2, cy);
  // Count (blank if 0)
  ctx.fillText(formatCellNum(metric.count), colX[3] + colW[3] / 2, cy);
  // Total Tk
  ctx.fillText(formatCellNum(metric.totalTk), colX[4] + colW[4] / 2, cy);
  // Board Share
  ctx.fillText(formatCellNum(metric.boardShareTk), colX[5] + colW[5] / 2, cy);
  // Institute Share
  ctx.fillText(formatCellNum(metric.instituteShareTk), colX[6] + colW[6] / 2, cy);
}

/**
 * Renders the Form Fill-up Invoice on an A4-proportioned high-DPI canvas so
 * the browser's native HarfBuzz text shaper renders all Bangla conjuncts and
 * vowel signs cleanly, matching the official printed layout.
 */
export async function renderFormFillupInvoiceCanvas(
  options: FormFillupInvoicePDFOptions
): Promise<HTMLCanvasElement> {
  const { invoice, coordinator, generatedBy, includeSignatures = false } = options;

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const width = 1654; // A4 Portrait @ 200 DPI
  const height = 2339;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to initialize canvas rendering context.');
  }

  // Crisp white paper background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const strokeColor = '#1e293b';
  const marginX = 105;
  const tableWidth = width - marginX * 2; // 1444

  // Column widths matching reference image proportions
  const colW = [235, 165, 164, 215, 220, 220, 225]; // sum = 1444
  const colX: number[] = [];
  let runningX = marginX;
  for (const w of colW) {
    colX.push(runningX);
    runningX += w;
  }
  const mergedLabelW = colW[0] + colW[1]; // 400

  // Title Header Block (Centered)
  ctx.fillStyle = '#1e293b';
  ctx.textAlign = 'center';

  ctx.font = `700 30px ${FONT_STACK}`;
  ctx.fillText(invoice.instituteEnglishName, width / 2, 128, tableWidth);

  ctx.font = `600 24px ${FONT_STACK}`;
  ctx.fillStyle = '#334155';
  ctx.fillText(invoice.departmentName, width / 2, 166, tableWidth);

  ctx.fillStyle = '#0f172a';
  ctx.font = `700 40px ${FONT_STACK}`;
  ctx.fillText(invoice.instituteName, width / 2, 224, tableWidth);

  ctx.font = `700 25px ${FONT_STACK}`;
  ctx.fillText(invoice.subtitleLine, width / 2, 276, tableWidth);

  ctx.font = `700 28px ${FONT_STACK}`;
  ctx.fillText(invoice.statementTitle, width / 2, 326, tableWidth);

  // Table Geometry
  const tableStartY = 374;
  const headerTopH = 74;
  const headerSubH = 70;
  const headerTotalH = headerTopH + headerSubH; // 144
  const rowH = 96;

  // Draw Table Header
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;

  // Col 1 & Col 2 split rows
  ctx.strokeRect(colX[0], tableStartY, colW[0], headerTopH);
  ctx.strokeRect(colX[1], tableStartY, colW[1], headerTopH);
  ctx.strokeRect(colX[0], tableStartY + headerTopH, colW[0], headerSubH);
  ctx.strokeRect(colX[1], tableStartY + headerTopH, colW[1], headerSubH);

  // Cols 3..7 full header height
  for (let c = 2; c <= 6; c++) {
    ctx.strokeRect(colX[c], tableStartY, colW[c], headerTotalH);
  }

  ctx.fillStyle = '#0f172a';
  ctx.font = `700 26px ${FONT_STACK}`;
  drawCenteredLines(ctx, ['টেকনোলজি'], colX[0], tableStartY, colW[0], headerTopH, 32);
  drawCenteredLines(ctx, ['পর্ব'], colX[1], tableStartY, colW[1], headerTopH, 32);

  ctx.font = `700 25px ${FONT_STACK}`;
  drawCenteredLines(
    ctx,
    [invoice.technologyLabel],
    colX[0],
    tableStartY + headerTopH,
    colW[0],
    headerSubH,
    32
  );
  drawCenteredLines(
    ctx,
    [invoice.semester],
    colX[1],
    tableStartY + headerTopH,
    colW[1],
    headerSubH,
    32
  );

  ctx.font = `700 26px ${FONT_STACK}`;
  drawCenteredLines(ctx, ['রেট/দর'], colX[2], tableStartY, colW[2], headerTotalH, 34);
  drawCenteredLines(
    ctx,
    ['ছাত্র/ছাত্রীর', 'সংখ্যা'],
    colX[3],
    tableStartY,
    colW[3],
    headerTotalH,
    34
  );
  drawCenteredLines(
    ctx,
    ['সর্বমোট', 'টাকা'],
    colX[4],
    tableStartY,
    colW[4],
    headerTotalH,
    34
  );
  drawCenteredLines(
    ctx,
    ['বোর্ড', 'প্রাপ্ত', 'অংশ'],
    colX[5],
    tableStartY,
    colW[5],
    headerTotalH,
    34
  );
  drawCenteredLines(
    ctx,
    ['প্রতিষ্ঠান', 'প্রাপ্ত', 'অংশ'],
    colX[6],
    tableStartY,
    colW[6],
    headerTotalH,
    34
  );

  let y = tableStartY + headerTotalH;

  // 1. পরীক্ষার ফি (1 row)
  ctx.strokeRect(colX[0], y, mergedLabelW, rowH);
  ctx.font = `600 27px ${FONT_STACK}`;
  drawCenteredLines(ctx, ['পরীক্ষার ফি'], colX[0], y, mergedLabelW, rowH, 32);
  drawMetricRowCells(ctx, invoice.rows.examFee, colX, colW, y, rowH, strokeColor);
  y += rowH;

  // 2. নম্বরপত্র ফি (2 sub-rows: Regular + Referred)
  ctx.strokeRect(colX[0], y, mergedLabelW, rowH * 2);
  ctx.font = `600 27px ${FONT_STACK}`;
  drawCenteredLines(ctx, ['নম্বরপত্র ফি'], colX[0], y, mergedLabelW, rowH * 2, 32);
  drawMetricRowCells(ctx, invoice.rows.marksheetRegular, colX, colW, y, rowH, strokeColor);
  drawMetricRowCells(
    ctx,
    invoice.rows.marksheetReferred,
    colX,
    colW,
    y + rowH,
    rowH,
    strokeColor
  );
  y += rowH * 2;

  // 3. প্রশ্ন পত্র বাবদ (1 row)
  ctx.strokeRect(colX[0], y, mergedLabelW, rowH);
  ctx.font = `600 27px ${FONT_STACK}`;
  drawCenteredLines(ctx, ['প্রশ্ন পত্র বাবদ'], colX[0], y, mergedLabelW, rowH, 32);
  drawMetricRowCells(ctx, invoice.rows.questionFee, colX, colW, y, rowH, strokeColor);
  y += rowH;

  // 4. রেফার্ড পরীক্ষার ফি (1 row)
  ctx.strokeRect(colX[0], y, mergedLabelW, rowH);
  ctx.font = `600 27px ${FONT_STACK}`;
  drawCenteredLines(ctx, ['রেফার্ড পরীক্ষার ফি'], colX[0], y, mergedLabelW, rowH, 32);
  drawMetricRowCells(ctx, invoice.rows.referredExamFee, colX, colW, y, rowH, strokeColor);
  y += rowH;

  // 5. বিলম্ব ফি (1 row)
  ctx.strokeRect(colX[0], y, mergedLabelW, rowH);
  ctx.font = `600 27px ${FONT_STACK}`;
  drawCenteredLines(ctx, ['বিলম্ব ফি'], colX[0], y, mergedLabelW, rowH, 32);
  drawMetricRowCells(ctx, invoice.rows.delayFee, colX, colW, y, rowH, strokeColor);
  y += rowH;

  // 6. কেন্দ্র ফি (2 sub-rows: Regular + Referred)
  ctx.strokeRect(colX[0], y, mergedLabelW, rowH * 2);
  ctx.font = `600 27px ${FONT_STACK}`;
  drawCenteredLines(ctx, ['কেন্দ্র ফি'], colX[0], y, mergedLabelW, rowH * 2, 32);
  drawMetricRowCells(ctx, invoice.rows.centerRegular, colX, colW, y, rowH, strokeColor);
  drawMetricRowCells(
    ctx,
    invoice.rows.centerReferred,
    colX,
    colW,
    y + rowH,
    rowH,
    strokeColor
  );
  y += rowH * 2;

  // 7. ব্যবহারিক ফি (1 row)
  ctx.strokeRect(colX[0], y, mergedLabelW, rowH);
  ctx.font = `600 27px ${FONT_STACK}`;
  drawCenteredLines(ctx, ['ব্যবহারিক ফি'], colX[0], y, mergedLabelW, rowH, 32);
  drawMetricRowCells(ctx, invoice.rows.practicalFee, colX, colW, y, rowH, strokeColor);
  y += rowH;

  // Footer Row: সর্ব মোটঃ (Left label unboxed, Right 5 cells boxed exactly like picture)
  const footerH = 100;
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 29px ${FONT_STACK}`;
  drawCenteredLines(ctx, ['সর্ব মোটঃ'], colX[0], y, mergedLabelW, footerH, 34);

  for (let c = 2; c <= 6; c++) {
    ctx.strokeRect(colX[c], y, colW[c], footerH);
  }

  ctx.font = `700 29px ${FONT_STACK}`;
  const footerCenterY = y + footerH / 2 + 10;
  ctx.fillText(String(invoice.grandTotalTk), colX[4] + colW[4] / 2, footerCenterY);
  ctx.fillText(String(invoice.boardTotalTk), colX[5] + colW[5] / 2, footerCenterY);
  ctx.fillText(String(invoice.instituteTotalTk), colX[6] + colW[6] / 2, footerCenterY);
  y += footerH;

  if (includeSignatures) {
    const sigY = Math.max(y + 240, 1980);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;

    // Left signature
    ctx.beginPath();
    ctx.moveTo(marginX + 20, sigY);
    ctx.lineTo(marginX + 420, sigY);
    ctx.stroke();

    // Right signature
    ctx.beginPath();
    ctx.moveTo(width - marginX - 420, sigY);
    ctx.lineTo(width - marginX - 20, sigY);
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.font = `600 23px ${FONT_STACK}`;
    ctx.fillText('দায়িত্বপ্রাপ্ত শিক্ষক / সমন্বয়ক', marginX + 220, sigY + 38);
    ctx.fillText('অধ্যক্ষ / বিভাগীয় প্রধান', width - marginX - 220, sigY + 38);

    const signer = coordinator?.name || generatedBy?.name;
    if (signer) {
      ctx.fillStyle = '#475569';
      ctx.font = `400 20px ${FONT_STACK}`;
      ctx.fillText(signer, marginX + 220, sigY + 70);
    }
  }

  // Discreet generation line at page footer
  const dateStr = new Date().toISOString().split('T')[0];
  const actorName = generatedBy?.name || coordinator?.name || 'Assigned Coordinator';
  ctx.fillStyle = '#64748b';
  ctx.font = `400 18px ${FONT_STACK}`;
  ctx.textAlign = 'left';
  ctx.fillText(
    `Prepared by: ${actorName} · Candidates: ${invoice.includedStudentCount} · Date: ${dateStr}`,
    marginX,
    height - 70
  );

  return canvas;
}

export async function generateFormFillupInvoicePDF(
  options: FormFillupInvoicePDFOptions
): Promise<jsPDF> {
  const canvas = await renderFormFillupInvoiceCanvas(options);
  const imgData = canvas.toDataURL('image/png', 1.0);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
  return doc;
}

export function getFormFillupInvoiceFileName(semester: string): string {
  const safeSem = semester.replace(/[^a-zA-Z0-9_-]+/g, '');
  const dateStr = new Date().toISOString().split('T')[0];
  return `BTEB_Form_Fillup_Invoice_${safeSem}_Semester_${dateStr}.pdf`;
}
