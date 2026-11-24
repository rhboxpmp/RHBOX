function toAscii(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function generateCsv(headers: string[], rows: string[][]): string {
  const esc = (v: string) => {
    const clean = (v ?? "").replace(/\r?\n/g, " ");
    const safe = /^[=+\-@]/.test(clean) ? `'${clean}` : clean;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const lines = [
    headers.map(esc).join(";"),
    ...rows.map((r) => r.map(esc).join(";")),
  ];
  return "\uFEFF" + lines.join("\r\n");
}

/**
 * Gera um PDF 1.4 binário válido sem dependências externas pesadas.
 */
export function generateSimplePdf(
  title: string,
  subtitle: string,
  headers: string[],
  rows: string[][]
): Buffer {
  const pageLines: string[][] = [];
  let current: string[] = [];

  const pushLine = (line: string) => {
    if (current.length >= 44) {
      pageLines.push(current);
      current = [];
    }
    current.push(line);
  };

  pushLine(`RHBOX - GESTAO DE SERVIDORES`);
  pushLine(title.toUpperCase());
  pushLine(subtitle);
  pushLine(`Gerado em: ${new Date().toLocaleString("pt-BR")} | Total de registros: ${rows.length}`);
  pushLine("-".repeat(95));
  pushLine(headers.join(" | "));
  pushLine("-".repeat(95));

  if (rows.length === 0) {
    pushLine("Nenhum registro encontrado para os filtros aplicados.");
  } else {
    for (const row of rows) {
      const joined = row.map((c) => (c ?? "").slice(0, 28)).join(" | ");
      pushLine(joined.slice(0, 102));
    }
  }

  if (current.length > 0) pageLines.push(current);

  const objects: string[] = [];
  const addObj = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const fontId = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");
  const pagesPlaceholderIdx = objects.length;
  objects.push(""); // reserved for Pages
  const pagesId = pagesPlaceholderIdx + 1;

  const pageIds: number[] = [];
  for (const lines of pageLines) {
    const streamParts = ["BT", "/F1 9 Tf", "36 800 Td", "14 TL"];
    for (const ln of lines) {
      streamParts.push(`(${toAscii(ln)}) Tj T*`);
    }
    streamParts.push("ET");
    const stream = streamParts.join("\n");
    const contentId = addObj(
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`
    );
    const pageId = addObj(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  }

  objects[pagesPlaceholderIdx] = `<< /Type /Pages /Kids [${pageIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${pageIds.length} >>`;

  const catalogId = addObj(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefPos = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}
