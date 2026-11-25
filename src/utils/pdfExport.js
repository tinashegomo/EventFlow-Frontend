import { formatCurrency, formatDate, formatDateTime } from './dateHelpers';

/**
 * Client-side PDF export for quotations and invoices.
 *
 * The PDFs are generated in the browser with jsPDF (vector text, not a
 * screenshot), so the file stays small and the text stays selectable. Both
 * document types share one renderer; the differences (column set, date
 * labels, file name) live in DOCUMENT_TYPES below.
 *
 * jsPDF and jspdf-autotable are imported dynamically so they are only
 * downloaded when a user actually exports a document, keeping the main
 * application bundle unchanged.
 */

// A4 portrait, in millimetres.
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const RIGHT_EDGE = PAGE_WIDTH - MARGIN;
// Content must stop above this line so the footer never overlaps text.
const CONTENT_BOTTOM = PAGE_HEIGHT - 24;

// Light-theme palette (see src/index.css). PDFs are always printed on white,
// so the dark theme is deliberately ignored here.
const COLORS = {
  text: [26, 24, 20], // --color-text-primary
  secondary: [107, 102, 96], // --color-text-secondary
  muted: [133, 127, 120], // --color-text-muted, darkened for print
  border: [229, 226, 220], // --color-border
  accent: [193, 127, 36], // --color-accent
  headFill: [247, 245, 241],
};

/** "PARTIALLY_PAID" -> "Partially paid" */
const formatStatus = (status) => {
  if (!status) return '';
  const words = String(status).replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** 7.5 -> "7.5", 10 -> "10" */
const formatPercent = (value) => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

/** Strips characters that are unsafe in a downloaded file name. */
const filePart = (value) => {
  const cleaned = String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return cleaned || 'document';
};

/** Reads the organization logo (a base64 data URL) into drawable metadata. */
const readLogo = async (dataUrl) => {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return null;
  const match = /^data:image\/(png|jpe?g|webp)/i.exec(dataUrl);
  if (!match) return null;
  const extension = match[1].toLowerCase();
  const format = extension === 'jpg' ? 'JPEG' : extension.toUpperCase();

  const size = await new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
  if (!size || !size.width || !size.height) return null;
  return { dataUrl, format, ...size };
};

/**
 * Subtotals row set, shared by both document types. Percentages are only shown
 * when the document actually carries one, matching the on-screen preview.
 */
const buildTotals = (record) => {
  const rows = [{ label: 'Subtotal', value: formatCurrency(record.subtotal) }];

  const hasDiscount = (record.discountPercent || 0) > 0 || (record.discountAmount || 0) > 0;
  if (hasDiscount) {
    rows.push({
      label: record.discountPercent > 0 ? `Discount (${formatPercent(record.discountPercent)}%)` : 'Discount',
      value: `-${formatCurrency(record.discountAmount || 0)}`,
    });
  }

  const hasTax = (record.taxPercent || 0) > 0 || (record.taxAmount || 0) > 0;
  if (hasTax) {
    rows.push({
      label: record.taxPercent > 0 ? `Tax (${formatPercent(record.taxPercent)}%)` : 'Tax',
      value: formatCurrency(record.taxAmount || 0),
    });
  }

  return rows;
};

// Column widths always total CONTENT_WIDTH (182mm).
const DOCUMENT_TYPES = {
  quotation: {
    label: 'Quotation',
    fileName: (record) => `Quotation-${filePart(record.quotationNumber)}.pdf`,
    meta: (record) =>
      [
        ['Issued', formatDateTime(record.createdAt)],
        record.validUntil ? ['Valid until', formatDate(record.validUntil)] : null,
        record.status ? ['Status', formatStatus(record.status)] : null,
      ].filter(Boolean),
    columns: [
      { header: 'Item', width: 70, align: 'left', bold: true, value: (li) => li.snapshotName || '—' },
      { header: 'Size', width: 30, align: 'left', value: (li) => li.snapshotSize || '—' },
      { header: 'Qty', width: 14, align: 'right', value: (li) => li.quantity ?? '' },
      { header: 'Unit Price', width: 34, align: 'right', value: (li) => formatCurrency(li.snapshotPrice) },
      {
        header: 'Amount',
        width: 34,
        align: 'right',
        value: (li) => formatCurrency((li.snapshotPrice || 0) * (li.quantity || 0)),
      },
    ],
  },
  invoice: {
    label: 'Invoice',
    fileName: (record) => `Invoice-${filePart(record.invoiceNumber)}.pdf`,
    meta: (record) =>
      [
        ['Issued', formatDateTime(record.createdAt)],
        record.dueDate ? ['Due', formatDate(record.dueDate)] : null,
        record.status === 'PAID' && record.paidAt ? ['Paid on', formatDate(record.paidAt)] : null,
        record.status ? ['Status', formatStatus(record.status)] : null,
      ].filter(Boolean),
    columns: [
      { header: 'Description', width: 92, align: 'left', bold: true, value: (li) => li.description || '—' },
      { header: 'Qty', width: 16, align: 'right', value: (li) => li.quantity ?? '' },
      { header: 'Unit Price', width: 37, align: 'right', value: (li) => formatCurrency(li.unitPrice) },
      {
        header: 'Amount',
        width: 37,
        align: 'right',
        // The backend stores the line total; only fall back to a calculation.
        value: (li) => formatCurrency(li.total ?? (li.unitPrice || 0) * (li.quantity || 0)),
      },
    ],
  },
};

/**
 * Organization mark on the left, document identity on the right.
 * Returns the y position of the horizontal rule under the header.
 */
const drawHeader = (doc, { type, record, org, logo }) => {
  // --- Right side: what this document is.
  doc.setFont('times', 'bold');
  doc.setFontSize(21);
  doc.setTextColor(...COLORS.accent);
  doc.text(type.label.toUpperCase(), RIGHT_EDGE, MARGIN + 8, { align: 'right' });

  let rightBaseline = MARGIN + 8;
  const number = record.quotationNumber || record.invoiceNumber;
  if (number) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...COLORS.secondary);
    doc.text(String(number), RIGHT_EDGE, MARGIN + 14.5, { align: 'right' });
    rightBaseline = MARGIN + 14.5;
  }

  // --- Left side: organization logo (if uploaded) then its name.
  let orgBaseline = MARGIN + 8;

  if (logo) {
    const maxWidth = 42;
    const maxHeight = 18;
    const scale = Math.min(maxWidth / logo.width, maxHeight / logo.height);
    const width = logo.width * scale;
    const height = logo.height * scale;
    try {
      doc.addImage(logo.dataUrl, logo.format, MARGIN, MARGIN, width, height);
      orgBaseline = MARGIN + height + 5;
    } catch {
      // A corrupt or unsupported image must never block the export.
      orgBaseline = MARGIN + 8;
    }
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.text);
  doc.text(org.name || 'Your Organization', MARGIN, orgBaseline);

  const ruleY = Math.max(orgBaseline, rightBaseline) + 7;
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, ruleY, RIGHT_EDGE, ruleY);
  return ruleY;
};

/**
 * Client block on the left, document dates and status on the right.
 * Returns the y position where the line-item table should start.
 */
const drawMeta = (doc, { type, record, ruleY }) => {
  const top = ruleY + 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.muted);
  doc.setCharSpace(0.6);
  doc.text('BILLED TO', MARGIN, top);
  doc.setCharSpace(0);

  doc.setFontSize(10.5);
  doc.setTextColor(...COLORS.text);
  doc.text(String(record.clientName || '—'), MARGIN, top + 6);

  let leftBaseline = top + 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.secondary);
  if (record.clientEmail) {
    leftBaseline += 4.8;
    doc.text(String(record.clientEmail), MARGIN, leftBaseline);
  }
  if (record.clientPhone) {
    leftBaseline += 4.8;
    doc.text(String(record.clientPhone), MARGIN, leftBaseline);
  }

  let rightBaseline = top;
  type.meta(record).forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(label, RIGHT_EDGE - 42, rightBaseline, { align: 'right' });

    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.text(String(value || '—'), RIGHT_EDGE, rightBaseline, { align: 'right' });

    rightBaseline += 5.2;
  });

  return Math.max(leftBaseline, rightBaseline) + 10;
};

/** Renders the line-item table and returns the y position below it. */
const drawLineItems = (doc, { type, record, autoTable, startY }) => {
  const { columns } = type;
  const items = record.lineItems || [];

  const body = items.length
    ? items.map((item) => columns.map((column) => column.value(item)))
    : [
        [
          {
            content: 'No line items.',
            colSpan: columns.length,
            styles: { halign: 'center', fontStyle: 'italic', textColor: COLORS.muted },
          },
        ],
      ];

  autoTable(doc, {
    startY,
    margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: PAGE_HEIGHT - CONTENT_BOTTOM },
    // columnStyles.halign does not reach head cells in jspdf-autotable v5, so
    // numeric headings would sit at the column edge while their values are
    // right-aligned. Give each head cell its column's alignment explicitly.
    head: [
      columns.map((column) => ({
        content: column.header.toUpperCase(),
        styles: { halign: column.align },
      })),
    ],
    body,
    theme: 'plain',
    // Never split a row across pages: a wrapped item name must stay with its
    // price, and a half row on the next page reads like a missing item.
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: { top: 2.6, bottom: 2.6, left: 2.5, right: 2.5 },
      textColor: COLORS.text,
      lineColor: COLORS.border,
      lineWidth: { top: 0, right: 0, bottom: 0.15, left: 0 },
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: COLORS.headFill,
      textColor: COLORS.secondary,
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: { top: 2.8, bottom: 2.8, left: 2.5, right: 2.5 },
      lineWidth: { top: 0, right: 0, bottom: 0.3, left: 0 },
    },
    columnStyles: columns.reduce((styles, column, index) => {
      styles[index] = { halign: column.align, cellWidth: column.width };
      if (column.bold) styles[index].fontStyle = 'bold';
      return styles;
    }, {}),
  });

  return doc.lastAutoTable.finalY;
};

/** Totals on the right, notes underneath. Returns the end of the content. */
const drawTotalsAndNotes = (doc, { record, startY }) => {
  const totals = buildTotals(record);
  const notes = record.notes ? String(record.notes).trim() : '';
  const notesLines = notes ? doc.splitTextToSize(notes, CONTENT_WIDTH) : [];

  const rowHeight = 6;
  const totalsHeight = totals.length * rowHeight + 12;
  const notesHeight = notesLines.length ? 9 + notesLines.length * 4.6 : 0;

  // Keep the totals (and short notes) together rather than orphaning them.
  let y = startY + 12;
  if (y + totalsHeight + notesHeight > CONTENT_BOTTOM) {
    doc.addPage();
    y = MARGIN + 10;
  }

  const boxWidth = 78;
  const boxLeft = RIGHT_EDGE - boxWidth;

  totals.forEach((row) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.secondary);
    doc.text(row.label, boxLeft, y);

    doc.setTextColor(...COLORS.text);
    doc.text(row.value, RIGHT_EDGE, y, { align: 'right' });
    y += rowHeight;
  });

  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.4);
  doc.line(boxLeft, y, RIGHT_EDGE, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.text);
  doc.text('Total', boxLeft, y + 6);
  doc.text(formatCurrency(record.totalAmount), RIGHT_EDGE, y + 6, { align: 'right' });

  let notesY = y + 6 + 10;

  if (notesLines.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.muted);
    doc.setCharSpace(0.6);
    doc.text('NOTES', MARGIN, notesY);
    doc.setCharSpace(0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.secondary);
    notesY += 5.5;

    notesLines.forEach((line) => {
      if (notesY > CONTENT_BOTTOM) {
        doc.addPage();
        notesY = MARGIN + 10;
      }
      doc.text(line, MARGIN, notesY);
      notesY += 4.6;
    });
  }

  return notesY;
};

/** Footer with document reference and page numbers on every page. */
const drawFooters = (doc, { type, record, org }) => {
  const pageCount = doc.getNumberOfPages();
  const reference = [record.quotationNumber || record.invoiceNumber, org.name].filter(Boolean).join(' · ');

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);

    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, PAGE_HEIGHT - 16, RIGHT_EDGE, PAGE_HEIGHT - 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(`${reference} · ${type.label}`, MARGIN, PAGE_HEIGHT - 10.5);
    doc.text(`Page ${page} of ${pageCount}`, RIGHT_EDGE, PAGE_HEIGHT - 10.5, { align: 'right' });
  }
};

/**
 * Builds and downloads one document.
 *
 * @param {'quotation'|'invoice'} kind
 * @param {object} record  quotation or invoice as returned by the API
 * @param {object} organization  current organization ({ name, logo })
 */
const generatePdf = async (kind, record, organization) => {
  if (!record) throw new Error('There is no document to export.');

  const type = DOCUMENT_TYPES[kind];
  const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableModule.default || autoTableModule.autoTable;

  const org = organization || {};
  const logo = await readLogo(org.logo);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  doc.setProperties({
    title: `${type.label} ${record.quotationNumber || record.invoiceNumber || ''}`.trim(),
    subject: `${type.label} for ${record.clientName || 'client'}`,
    author: org.name || 'EventFlow',
    creator: 'EventFlow',
  });

  const ruleY = drawHeader(doc, { type, record, org, logo });
  const tableStartY = drawMeta(doc, { type, record, ruleY });
  const tableEndY = drawLineItems(doc, { type, record, autoTable, startY: tableStartY });
  drawTotalsAndNotes(doc, { record, startY: tableEndY });
  drawFooters(doc, { type, record, org });

  doc.save(type.fileName(record));
};

export const downloadQuotationPdf = (quotation, organization) => generatePdf('quotation', quotation, organization);

export const downloadInvoicePdf = (invoice, organization) => generatePdf('invoice', invoice, organization);
