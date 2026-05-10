/**
 * Export service — CSV and PDF (premium feature)
 */

import { AttendanceDB } from '../db/attendance.js';
import { StudentsDB } from '../db/students.js';
import { STATUS_LABELS, t } from '../utils/i18n.js';

export const ExportService = {
  /**
   * Export attendance as CSV for a group and date range.
   * Columns: 번호/# , 이름/Name, date1, date2, ...
   * Adds BOM for Korean Excel compatibility.
   */
  async exportCSV(group, startDate, endDate) {
    const students = await StudentsDB.getByGroup(group.id);
    const recordMap = await AttendanceDB.getByGroupDateRange(group.id, startDate, endDate);

    const allDates = _dateRange(startDate, endDate);

    const headers = [t('export.headerNumber'), t('export.headerName'), ...allDates];
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

    const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = t('export.csvFilename', { name: group.name, start: startDate, end: endDate }) + '.csv';
    await _saveFile(blob, filename);
  },

  /**
   * Export attendance as PDF for a group and date range.
   * Requires jsPDF + autoTable loaded via CDN.
   */
  async exportPDF(group, startDate, endDate) {
    if (!window.jspdf?.jsPDF) {
      throw new Error(t('export.pdfLibError'));
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

    doc.setFontSize(14);
    doc.text(`${group.name} - ${t('export.pdfTitle')}`, 14, 18);
    doc.setFontSize(10);
    doc.text(t('export.pdfPeriod', { start: startDate, end: endDate }), 14, 26);

    // Status → short label for PDF cells
    const shortLabel = {
      present: t('export.statusShortPresent'),
      absent:  t('export.statusShortAbsent'),
      late:    t('export.statusShortLate'),
      early:   t('export.statusShortEarly'),
    };

    // Cell background colors keyed by locale-aware short label
    const STATUS_BG = {
      [shortLabel.present]: [209, 250, 229], // green
      [shortLabel.absent]:  [254, 226, 226], // red
      [shortLabel.late]:    [254, 243, 199], // amber
      [shortLabel.early]:   [237, 233, 254], // purple
    };

    const head = [[t('export.headerNumber'), t('export.headerName'), ...allDates.map(d => d.slice(5))]]; // MM-DD
    const body = students.map(s => [
      s.number,
      s.name,
      ...allDates.map(d => {
        const rec = recordMap[`${s.id}_${d}`];
        return rec ? shortLabel[rec.status] : '';
      }),
    ]);

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

    const filename = t('export.pdfFilename', { name: group.name, start: startDate, end: endDate }) + '.pdf';
    // doc.save()는 Android WebView에서 blob URL 네비게이션을 유발하므로 사용 금지
    const blob = doc.output('blob');
    await _saveFile(blob, filename);
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

/**
 * 파일 저장 헬퍼
 *
 * Android (Capacitor): blob URL 클릭은 WebView 네비게이션을 유발해 앱이 freeze됨.
 * 대신 Filesystem 플러그인으로 캐시에 쓴 뒤 Share 플러그인으로 공유 시트를 띄운다.
 *
 * 웹: 기존 blob URL + <a download> 방식 유지.
 */
async function _saveFile(blob, filename) {
  const isNative = typeof window.Capacitor !== 'undefined' && window.Capacitor?.isNativePlatform?.();

  if (isNative) {
    const Filesystem = window.Capacitor.Plugins.Filesystem;
    const Share      = window.Capacitor.Plugins.Share;

    if (!Filesystem || !Share) {
      throw new Error('파일 저장 플러그인을 찾을 수 없습니다. 앱을 업데이트해주세요.');
    }

    // Blob → base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror   = reject;
      reader.readAsDataURL(blob);
    });

    // 캐시 디렉토리에 저장 (권한 불필요)
    const { uri } = await Filesystem.writeFile({
      path:      filename,
      data:      base64,
      directory: 'CACHE',
    });

    // 네이티브 공유 시트 표시
    await Share.share({ url: uri, dialogTitle: filename });
    return;
  }

  // 웹: blob URL + <a download>
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
