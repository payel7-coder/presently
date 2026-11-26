import { jsPDF } from 'jspdf';

export const PDF_INSTITUTE_NAME = 'Model Institute of Science and Technology';
export const PDF_DEPARTMENT_NAME = 'Department of Computer Science & Technology';
export const PDF_BOARD_SUBTITLE =
  'Bangladesh Technical Education Board (BTEB) • Diploma in Engineering (Probidhan 2022)';

export interface InstitutionalHeaderOptions {
  reportTitle: string;
  boardSubtitle?: string;
  accentColor?: [number, number, number];
  titleColor?: [number, number, number];
  footerNote?: string;
}

/**
 * Draws a clean, minimalist black-and-white institutional header at the top of jsPDF reports
 * (transparent/white paper background, zero banner fill) and returns the header height
 * in millimeters so callers can offset metadata blocks and AutoTables cleanly.
 */
export function drawInstitutionalPdfHeader(
  doc: jsPDF,
  options: InstitutionalHeaderOptions
): number {
  const {
    reportTitle,
    boardSubtitle = PDF_BOARD_SUBTITLE,
    footerNote,
  } = options;

  const pageWidth = doc.internal.pageSize.getWidth();
  const isLandscape = pageWidth > doc.internal.pageSize.getHeight();
  const bannerHeight = footerNote ? 36 : 33;
  const marginX = 10;

  // Line 1: Institute Name
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isLandscape ? 14.5 : 13.5);
  doc.text(PDF_INSTITUTE_NAME, pageWidth / 2, 10.5, { align: 'center' });

  // Line 2: Department Name
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isLandscape ? 10.5 : 10);
  doc.text(PDF_DEPARTMENT_NAME, pageWidth / 2, 16, { align: 'center' });

  // Line 3: BTEB Subtitle
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(isLandscape ? 8 : 7.5);
  doc.text(boardSubtitle, pageWidth / 2, 21.2, { align: 'center' });

  // Line 4: Report Title
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isLandscape ? 10 : 9.5);
  doc.text(reportTitle, pageWidth / 2, 27.2, { align: 'center' });

  if (footerNote) {
    doc.setTextColor(90, 90, 90);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(footerNote, pageWidth / 2, 31.6, { align: 'center' });
  }

  // Clean minimalist black hairline divider
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.line(marginX, bannerHeight - 1.5, pageWidth - marginX, bannerHeight - 1.5);
  doc.setLineWidth(0.2);

  return bannerHeight;
}
