/**
 * Export service — CSV and PDF (premium feature)
 */

import { AttendanceDB } from '../db/attendance.js';
import { StudentsDB } from '../db/students.js';
import { STATUS_LABELS, t } from '../utils/i18n.js';
import { shiftDate } from '../utils/date.js';

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
   * Requires jsPDF loaded via CDN.
   *
   * jsPDF 기본 폰트는 라틴 문자만 지원해 한글/일본어가 깨지므로,
   * 기기 시스템 폰트로 canvas에 페이지를 그린 뒤 이미지로 PDF에 넣는다.
   */
  async exportPDF(group, startDate, endDate) {
    if (!window.jspdf?.jsPDF) {
      throw new Error(t('export.pdfLibError'));
    }

    const students = await StudentsDB.getByGroup(group.id);
    const recordMap = await AttendanceDB.getByGroupDateRange(group.id, startDate, endDate);
    const allDates = _dateRange(startDate, endDate);

    const landscape = allDates.length > 15;
    const pageW = landscape ? 297 : 210;
    const pageH = landscape ? 210 : 297;

    // Status → short label for PDF cells
    const shortLabel = {
      present: t('export.statusShortPresent'),
      absent:  t('export.statusShortAbsent'),
      late:    t('export.statusShortLate'),
      early:   t('export.statusShortEarly'),
    };

    const table = {
      title:  `${group.name} - ${t('export.pdfTitle')}`,
      period: t('export.pdfPeriod', { start: startDate, end: endDate }),
      head:   [t('export.headerNumber'), t('export.headerName'), ...allDates.map(d => d.slice(5))], // MM-DD
      rows:   students.map(s => [
        { text: String(s.number ?? '') },
        { text: s.name },
        ...allDates.map(d => {
          const rec = recordMap[`${s.id}_${d}`];
          return rec ? { text: shortLabel[rec.status] ?? '', status: rec.status } : { text: '' };
        }),
      ]),
    };

    // 웹폰트 로딩 전에 그리면 fallback 폰트로 렌더링됨
    await document.fonts?.ready;
    const pages = _renderPdfPages(table, pageW, pageH);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: landscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    pages.forEach((canvas, i) => {
      if (i > 0) doc.addPage();
      doc.addImage(canvas, 'PNG', 0, 0, pageW, pageH, undefined, 'FAST');
    });

    const filename = t('export.pdfFilename', { name: group.name, start: startDate, end: endDate }) + '.pdf';
    // doc.save()는 Android WebView에서 blob URL 네비게이션을 유발하므로 사용 금지
    const blob = doc.output('blob');
    await _saveFile(blob, filename);
  },
};

// PDF 페이지 레이아웃 (단위: mm)
const PDF_PX_PER_MM = 8;   // 약 200dpi
const PDF_MARGIN    = 14;
const PDF_TABLE_TOP = 32;
const PDF_ROW_H     = 7;
const PDF_CELL_PAD  = 1.2;
const PDF_COL_NUM   = 10;
const PDF_COL_NAME  = 24;
const PDF_FONT_PT   = 8;
const PDF_MIN_PT    = 4;

const PDF_COLOR = {
  text:    '#1C1917',
  muted:   '#57534E',
  grid:    '#D6D3D1',
  headBg:  '#4F46E5',
  headTxt: '#FFFFFF',
  stripe:  '#F5F5F4',
};

const PDF_STATUS_BG = {
  present: '#D1FAE5', // green
  absent:  '#FEE2E2', // red
  late:    '#FEF3C7', // amber
  early:   '#EDE9FE', // purple
};

/**
 * Helper: 출석표를 A4 페이지 단위 canvas 배열로 그린다.
 * 행이 많으면 여러 페이지로 나누고, 매 페이지에 제목과 헤더 행을 반복한다.
 */
function _renderPdfPages(table, pageW, pageH) {
  const S = PDF_PX_PER_MM;
  const fontFamily = getComputedStyle(document.body).fontFamily || 'sans-serif';
  const ptToPx = (pt) => pt * 0.3528 * S;

  const dateCount = table.head.length - 2;
  const dateW = (pageW - PDF_MARGIN * 2 - PDF_COL_NUM - PDF_COL_NAME) / Math.max(dateCount, 1);
  const colW = [PDF_COL_NUM, PDF_COL_NAME, ...Array(dateCount).fill(dateW)];

  // 헤더 행 1줄을 제외하고 한 페이지에 들어가는 본문 행 수
  const rowsPerPage = Math.max(1, Math.floor((pageH - PDF_TABLE_TOP - PDF_MARGIN) / PDF_ROW_H) - 1);

  // 셀 너비를 넘으면 최소 크기까지 글자를 줄임
  const setFittingFont = (ctx, text, maxPx, bold) => {
    let pt = PDF_FONT_PT;
    do {
      ctx.font = `${bold ? 'bold ' : ''}${ptToPx(pt)}px ${fontFamily}`;
      if (ctx.measureText(text).width <= maxPx) return;
      pt -= 0.5;
    } while (pt >= PDF_MIN_PT);
  };

  const drawRow = (ctx, cells, y, { header = false, stripe = false } = {}) => {
    let x = PDF_MARGIN;
    cells.forEach((cell, i) => {
      const w = colW[i];
      const bg = header ? PDF_COLOR.headBg : (PDF_STATUS_BG[cell.status] ?? (stripe ? PDF_COLOR.stripe : null));
      if (bg) {
        ctx.fillStyle = bg;
        ctx.fillRect(x * S, y * S, w * S, PDF_ROW_H * S);
      }
      ctx.strokeStyle = PDF_COLOR.grid;
      ctx.lineWidth = 1;
      ctx.strokeRect(x * S, y * S, w * S, PDF_ROW_H * S);

      if (cell.text) {
        const alignLeft = i === 1;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x * S, y * S, w * S, PDF_ROW_H * S);
        ctx.clip();
        setFittingFont(ctx, cell.text, (w - PDF_CELL_PAD * 2) * S, header);
        ctx.fillStyle = header ? PDF_COLOR.headTxt : PDF_COLOR.text;
        ctx.textAlign = alignLeft ? 'left' : 'center';
        ctx.fillText(cell.text, (alignLeft ? x + PDF_CELL_PAD : x + w / 2) * S, (y + PDF_ROW_H / 2) * S);
        ctx.restore();
      }
      x += w;
    });
  };

  const pages = [];
  for (let start = 0; ; start += rowsPerPage) {
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(pageW * S);
    canvas.height = Math.round(pageH * S);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    ctx.fillStyle = PDF_COLOR.text;
    ctx.font = `bold ${ptToPx(14)}px ${fontFamily}`;
    ctx.fillText(table.title, PDF_MARGIN * S, 17 * S);
    ctx.fillStyle = PDF_COLOR.muted;
    ctx.font = `${ptToPx(10)}px ${fontFamily}`;
    ctx.fillText(table.period, PDF_MARGIN * S, 25 * S);

    drawRow(ctx, table.head.map(text => ({ text })), PDF_TABLE_TOP, { header: true });
    table.rows.slice(start, start + rowsPerPage).forEach((cells, i) => {
      drawRow(ctx, cells, PDF_TABLE_TOP + PDF_ROW_H * (i + 1), { stripe: i % 2 === 1 });
    });

    pages.push(canvas);
    if (start + rowsPerPage >= table.rows.length) break;
  }
  return pages;
}

/** Helper: array of YYYY-MM-DD strings between start and end (inclusive) */
function _dateRange(startDate, endDate) {
  const dates = [];
  let current = startDate;
  while (current <= endDate) {
    dates.push(current);
    // toISOString()은 UTC 기준이라 UTC+ 시간대(한국/일본)에서 날짜가 전진하지 않아 무한 루프가 됨
    current = shiftDate(current, 1);
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
