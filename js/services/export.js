/**
 * Export service — CSV and PDF (premium feature)
 */

import { AttendanceDB } from '../db/attendance.js';
import { StudentsDB } from '../db/students.js';
import { STATUS_LABELS } from '../utils/i18n.js';

export const ExportService = {
  /**
   * Export attendance as CSV for a group and date range.
   * Columns: 번호, 이름, date1, date2, ...
   * Adds BOM for Korean Excel compatibility.
   */
  async exportCSV(group, startDate, endDate) {
    const students = await StudentsDB.getByGroup(group.id);
    const recordMap = await AttendanceDB.getByGroupDateRange(group.id, startDate, endDate);

    // Determine all dates in range that have records OR are in the range
    const allDates = _dateRange(startDate, endDate);

    const headers = ['번호', '이름', ...allDates];
    const rows = students.map(s => [
      s.number,
      s.name,
      ...allDates.map(d => {
        const rec = recordMap[`${s.id}_${d}`];
        return rec ? STATUS_LABELS[rec.status] : '';
      }),
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const BOM = '\uFEFF'; // UTF-8 BOM for Korean Excel
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    _download(blob, `출석부_${group.name}_${startDate}_${endDate}.csv`);
  },

  /**
   * Export attendance as PDF for a group and date range.
   * Requires jsPDF + autoTable loaded via CDN.
   */
  async exportPDF(group, startDate, endDate) {
    if (!window.jspdf?.jsPDF) {
      throw new Error('PDF 라이브러리가 로드되지 않았습니다. 잠시 후 다시 시도해 주세요.');
    }

    const students = await StudentsDB.getByGroup(group.id);
    const recordMap = await AttendanceDB.getByGroupDateRange(group.id, startDate, endDate);
    const allDates = _dateRange(startDate, endDate);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: allDates.length > 15 ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Title (note: jsPDF doesn't support Korean without a custom font;
    // fall back to romanization or embed font separately)
    doc.setFontSize(14);
    doc.text(`${group.name} - 출석부`, 14, 18);
    doc.setFontSize(10);
    doc.text(`기간: ${startDate} ~ ${endDate}`, 14, 26);

    // Status → short label for PDF
    const shortLabel = { present: '출', absent: '결', late: '지', early: '조' };

    const head = [['번호', '이름', ...allDates.map(d => d.slice(5))]]; // MM-DD
    const body = students.map(s => [
      s.number,
      s.name,
      ...allDates.map(d => {
        const rec = recordMap[`${s.id}_${d}`];
        return rec ? shortLabel[rec.status] : '';
      }),
    ]);

    // Status cell colors
    const STATUS_BG = {
      '출': [209, 250, 229], // green
      '결': [254, 226, 226], // red
      '지': [254, 243, 199], // amber
      '조': [237, 233, 254], // purple
    };

    doc.autoTable({
      head,
      body,
      startY: 32,
      styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 22, halign: 'left' },
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index >= 2) {
          const val = data.cell.raw;
          const bg = STATUS_BG[val];
          if (bg) {
            doc.setFillColor(...bg);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
            doc.setTextColor(50, 50, 50);
            doc.setFontSize(7);
            doc.text(String(val), data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, { align: 'center' });
          }
        }
      },
    });

    doc.save(`출석부_${group.name}_${startDate}_${endDate}.pdf`);
  },
};

/** Helper: array of YYYY-MM-DD strings between start and end (inclusive) */
function _dateRange(startDate, endDate) {
  const dates = [];
  let current = startDate;
  while (current <= endDate) {
    dates.push(current);
    const d = new Date(current + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    current = d.toISOString().slice(0, 10);
  }
  return dates;
}

/** Helper: trigger browser file download */
function _download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

export default ExportService;
