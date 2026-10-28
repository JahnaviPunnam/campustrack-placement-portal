import PDFDocument from "pdfkit";

export type PdfReportInput = {
  title: string;
  subtitle?: string[];
  summary?: string[];
  headers: string[];
  widths: number[];
  rows: string[][];
};

export function renderPdfReport(input: PdfReportInput): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.font("Helvetica-Bold").fontSize(18).fillColor("#111111").text(input.title);
    doc.font("Helvetica").fontSize(9).fillColor("#555555");
    doc.text(`Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`);
    for (const line of input.subtitle ?? []) doc.text(line);
    doc.moveDown();

    if (input.summary && input.summary.length > 0) {
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111").text("Summary");
      doc.font("Helvetica").fontSize(9).fillColor("#333333");
      for (const line of input.summary) doc.text(line);
      doc.moveDown();
    }

    const drawHeader = () => {
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#111111");
      let x = 40;
      input.headers.forEach((header, index) => {
        doc.text(header, x, y, { width: input.widths[index], lineBreak: false, ellipsis: true });
        x += input.widths[index];
      });
      doc.y = y + 13;
      doc.font("Helvetica").fontSize(8).fillColor("#333333");
    };

    drawHeader();
    if (input.rows.length === 0) {
      doc.text("No records match this export.", 40, doc.y);
    }
    for (const row of input.rows) {
      if (doc.y > 770) {
        doc.addPage();
        drawHeader();
      }
      const y = doc.y;
      let x = 40;
      row.forEach((value, index) => {
        doc.text(value, x, y, {
          width: input.widths[index],
          lineBreak: false,
          ellipsis: true,
        });
        x += input.widths[index];
      });
      doc.y = y + 13;
    }

    doc.end();
  });
}
