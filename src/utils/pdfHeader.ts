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
 * Draws the shared institutional dark-slate banner at the top of jsPDF reports
 * and returns the banner height in millimeters so callers can offset metadata
 * blocks and AutoTables cleanly without overlaps.
 */
export function drawInstitutionalPdfHeader(
  doc: jsPDF,
  options: InstitutionalHeaderOptions
): number {
  const {
    reportTitle,
    boardSubtitle = PDF_BOARD_SUBTITLE,
    accentColor = [16, 185, 129], // emerald-500
    titleColor = [52, 211, 153], // emerald-400
    footerNote,
  } = options;

  const pageWidth = doc.internal.pageSize.getWidth();
  const isLandscape = pageWidth > doc.internal.pageSize.getHeight();
  const bannerHeight = footerNote ? 36 : 33;

  // Dark slate header background
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, bannerHeight, 'F');

  // Top accent stripe
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(0, 0, pageWidth, 3, 'F');

  // Line 1: Institute Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isLandscape ? 14.5 : 13.5);
  doc.text(PDF_INSTITUTE_NAME, pageWidth / 2, 10, { align: 'center' });

  // Line 2: Department Name
  doc.setTextColor(226, 232, 240); // slate-200
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isLandscape ? 11 : 10);
  doc.text(PDF_DEPARTMENT_NAME, pageWidth / 2, 16, { align: 'center' });

  // Line 3: BTEB Subtitle
  doc.setTextColor(203, 213, 225); // slate-300
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(isLandscape ? 8.5 : 8);
  doc.text(boardSubtitle, pageWidth / 2, 21.8, { align: 'center' });

  // Line 4: Report Title
  doc.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isLandscape ? 10 : 9.5);
  doc.text(reportTitle, pageWidth / 2, 28, { align: 'center' });

  if (footerNote) {
    doc.setTextColor(148, 163, 184); // slate-400
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(footerNote, pageWidth / 2, 32.2, { align: 'center' });
  }

  return bannerHeight;
}
