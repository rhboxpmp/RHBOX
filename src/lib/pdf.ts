import type { DiaCalendarioInfo } from "./calendario-ba";

function toWinAnsi(text: string): string {
  const normalized = (text ?? "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/→/g, "->");

  let out = "";
  for (const ch of normalized) {
    const code = ch.charCodeAt(0);
    if (code >= 0x20 && code <= 0xff) {
      out += ch;
    } else {
      out += " ";
    }
  }
  return out
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function toAscii(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function truncateText(text: string, maxChars: number): string {
  const s = (text ?? "").trim();
  if (s.length <= maxChars) return s;
  return s.slice(0, Math.max(1, maxChars - 1)) + ".";
}

function compilePdfDocument(
  pages: Array<{ width: number; height: number; stream: string }>
): Buffer {
  const objects: string[] = [];
  const addObj = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const fontRegularId = addObj(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
  );
  const fontBoldId = addObj(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
  );

  const pagesPlaceholderIdx = objects.length;
  objects.push("");
  const pagesId = pagesPlaceholderIdx + 1;

  const pageIds: number[] = [];
  for (const page of pages) {
    const len = Buffer.byteLength(page.stream, "latin1");
    const contentId = addObj(
      `<< /Length ${len} >>\nstream\n${page.stream}\nendstream`
    );
    const pageId = addObj(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`
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

function drawRect(
  cmds: string[],
  x: number,
  y: number,
  w: number,
  h: number,
  fillRgb?: string,
  strokeRgb?: string,
  lineWidth = 0.5
) {
  cmds.push("q");
  if (lineWidth !== 0.5) cmds.push(`${lineWidth} w`);
  if (fillRgb) cmds.push(`${fillRgb} rg`);
  if (strokeRgb) cmds.push(`${strokeRgb} RG`);
  cmds.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`);
  if (fillRgb && strokeRgb) cmds.push("B");
  else if (fillRgb) cmds.push("f");
  else cmds.push("S");
  cmds.push("Q");
}

function drawText(
  cmds: string[],
  text: string,
  x: number,
  y: number,
  font: "F1" | "F2",
  size: number,
  rgb = "0.118 0.161 0.231"
) {
  cmds.push("BT");
  cmds.push(`/${font} ${size} Tf`);
  cmds.push(`${rgb} rg`);
  cmds.push(`${x.toFixed(2)} ${y.toFixed(2)} Td`);
  cmds.push(`(${toWinAnsi(text)}) Tj`);
  cmds.push("ET");
}

function drawLine(
  cmds: string[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rgb = "0.75 0.80 0.86",
  lineWidth = 0.5
) {
  cmds.push("q");
  cmds.push(`${lineWidth} w`);
  cmds.push(`${rgb} RG`);
  cmds.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  cmds.push("Q");
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
  pushLine(
    `Gerado em: ${new Date().toLocaleString("pt-BR")} | Total de registros: ${rows.length}`
  );
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
  objects.push("");
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

// ============================================================================
// FOLHA DE PONTO MENSAL (PDF A4 RETRATO PARA IMPRIMIR E ASSINAR)
// ============================================================================
export interface FolhaPontoSheetInput {
  servidorNome: string;
  matricula: string;
  cargo: string;
  vinculo: string;
  secretariaLabel: string;
  competenciaLabel: string;
  dias: DiaCalendarioInfo[];
  coberturaDias: Map<string, string>;
  turnos: 1 | 2;
  cargaHoraria?: string;
}

export function generateFolhaPontoPdf(
  sheets: FolhaPontoSheetInput[],
  emitidoPor: string
): Buffer {
  const NAVY = "0.016 0.102 0.278";
  const BLUE = "0.000 0.278 0.702";
  const BORDER = "0.78 0.83 0.89";
  const WHITE = "1 1 1";
  const DARK = "0.08 0.12 0.20";
  const MUTED = "0.35 0.40 0.48";
  const WEEKEND_BG = "0.945 0.957 0.973";
  const HOLIDAY_BG = "0.996 0.953 0.780";
  const LEAVE_BG = "0.918 0.949 0.996";
  const HEADER_SUB_BG = "0.953 0.969 0.988";

  const pages = sheets.map((sheet) => {
    const cmds: string[] = [];
    const marginX = 28;
    const width = 539;

    // 1. Cabeçalho institucional azul marinho
    drawRect(cmds, marginX, 782, width, 34, NAVY);
    drawText(cmds, "RHBOX - FOLHA INDIVIDUAL DE PONTO MENSAL", marginX + 12, 796, "F2", 11.5, WHITE);
    drawText(
      cmds,
      `Competência: ${sheet.competenciaLabel}`,
      marginX + width - 158,
      796,
      "F2",
      10,
      "0.965 0.827 0.396"
    );

    // 2. Bloco de identificação do servidor
    drawRect(cmds, marginX, 738, width, 40, HEADER_SUB_BG, BORDER, 0.6);
    drawLine(cmds, marginX, 758, marginX + width, 758, BORDER, 0.5);
    drawLine(cmds, marginX + 275, 738, marginX + 275, 778, BORDER, 0.5);
    drawLine(cmds, marginX + 415, 738, marginX + 415, 778, BORDER, 0.5);

    drawText(cmds, "Servidor:", marginX + 6, 765, "F2", 7.5, MUTED);
    drawText(cmds, truncateText(sheet.servidorNome, 40), marginX + 48, 765, "F2", 8.5, DARK);
    drawText(cmds, "Matrícula:", marginX + 281, 765, "F2", 7.5, MUTED);
    drawText(cmds, truncateText(sheet.matricula, 18), marginX + 325, 765, "F2", 8.5, DARK);
    drawText(cmds, "Secretaria:", marginX + 421, 765, "F2", 7.5, MUTED);
    drawText(cmds, truncateText(sheet.secretariaLabel, 14), marginX + 468, 765, "F2", 8, DARK);

    const turnoDesc =
      sheet.turnos === 2
        ? "2 Turnos (Manhã e Tarde)"
        : "1 Turno / Plantão";
    const jornadaLabel = sheet.cargaHoraria
      ? `${turnoDesc} · ${sheet.cargaHoraria}`
      : turnoDesc;

    drawText(cmds, "Cargo:", marginX + 6, 745, "F2", 7.5, MUTED);
    drawText(cmds, truncateText(sheet.cargo, 42), marginX + 38, 745, "F1", 8, DARK);
    drawText(cmds, "Vínculo:", marginX + 281, 745, "F2", 7.5, MUTED);
    drawText(cmds, truncateText(sheet.vinculo, 18), marginX + 318, 745, "F1", 8, DARK);
    drawText(cmds, "Jornada:", marginX + 421, 745, "F2", 7.5, MUTED);
    drawText(cmds, truncateText(jornadaLabel, 22), marginX + 459, 745, "F1", 7, DARK);

    // 3. Tabela dos dias do mês
    const cols =
      sheet.turnos === 2
        ? [
            { label: "Dia", w: 26 },
            { label: "Sem", w: 28 },
            { label: "1º Ent.", w: 50 },
            { label: "1º Saí.", w: 50 },
            { label: "2º Ent.", w: 50 },
            { label: "2º Saí.", w: 50 },
            { label: "Assinatura do Servidor", w: 160 },
            { label: "Ocorrência / Rubrica", w: 125 },
          ]
        : [
            { label: "Dia", w: 28 },
            { label: "Sem", w: 30 },
            { label: "Entrada", w: 68 },
            { label: "Saída", w: 68 },
            { label: "Assinatura do Servidor", w: 195 },
            { label: "Ocorrência / Rubrica", w: 150 },
          ];

    const tableTop = 732;
    const headerH = 19;
    const rowH = 17;

    drawRect(cmds, marginX, tableTop - headerH, width, headerH, BLUE, NAVY, 0.6);
    let cx = marginX;
    for (const col of cols) {
      drawText(cmds, col.label, cx + 4, tableTop - 13, "F2", 7.5, WHITE);
      cx += col.w;
    }

    let yTop = tableTop - headerH;
    for (const d of sheet.dias) {
      const yBot = yTop - rowH;
      const afastLabel = sheet.coberturaDias.get(d.iso);

      let rowFill: string | undefined;
      let statusNota = "";
      let notaColor = MUTED;

      if (afastLabel) {
        rowFill = LEAVE_BG;
        statusNota = afastLabel.toUpperCase();
        notaColor = BLUE;
      } else if (d.feriadoNome) {
        rowFill = HOLIDAY_BG;
        const prefix =
          d.feriadoEsfera === "estadual_ba"
            ? "[BA] "
            : d.feriadoEsfera === "municipal"
            ? "[Mun.] "
            : d.feriadoEsfera === "facultativo"
            ? "[Fac.] "
            : "";
        statusNota = `${prefix}${d.feriadoNome}`;
        notaColor = "0.55 0.30 0.02";
      } else if (d.isWeekend) {
        rowFill = WEEKEND_BG;
        statusNota = d.diaSemanaIndex === 0 ? "DOMINGO" : "SÁBADO";
      }

      drawRect(cmds, marginX, yBot, width, rowH, rowFill || WHITE, BORDER, 0.45);

      // Linhas verticais das colunas
      let vx = marginX;
      for (let i = 0; i < cols.length - 1; i++) {
        vx += cols[i].w;
        drawLine(cmds, vx, yBot, vx, yTop, BORDER, 0.45);
      }

      drawText(
        cmds,
        String(d.dia).padStart(2, "0"),
        marginX + 6,
        yBot + 5.5,
        "F2",
        7.5,
        DARK
      );
      drawText(
        cmds,
        d.diaSemanaCurto,
        marginX + cols[0].w + 4,
        yBot + 5.5,
        "F1",
        7.2,
        d.isWeekend ? MUTED : DARK
      );

      if (statusNota) {
        const sigX =
          marginX +
          cols.slice(0, cols.length - 2).reduce((acc, c) => acc + c.w, 0);
        const obsX =
          marginX +
          cols.slice(0, cols.length - 1).reduce((acc, c) => acc + c.w, 0);
        drawText(
          cmds,
          truncateText(statusNota, 34),
          sigX + 6,
          yBot + 5.5,
          "F2",
          7,
          notaColor
        );
        if (afastLabel) {
          drawText(cmds, "Registrado no RHBOX", obsX + 5, yBot + 5.5, "F1", 6.5, MUTED);
        } else if (d.feriadoNome) {
          drawText(cmds, "Sem expediente", obsX + 5, yBot + 5.5, "F1", 6.5, MUTED);
        }
      }

      yTop = yBot;
    }

    // 4. Quadro resumo de conferência manual no papel + Assinaturas
    drawRect(cmds, marginX, 118, width, 46, HEADER_SUB_BG, BORDER, 0.6);
    drawText(
      cmds,
      "FECHAMENTO MENSAL DA FOLHA ASSINADA (PREENCHIMENTO DO RH DA SECRETARIA):",
      marginX + 8,
      152,
      "F2",
      7.2,
      NAVY
    );
    drawText(
      cmds,
      "Faltas Injust.: _____ d   |   Faltas Just.: _____ d   |   Abonos: _____ d   |   HE 50%: _____ h   |   HE 100%: _____ h   |   Noturno: _____ h   |   Plantões: _____",
      marginX + 8,
      137,
      "F1",
      7.2,
      DARK
    );
    drawText(
      cmds,
      "Outros Adicionais / Observações: ____________________________________________________________________________________________________________",
      marginX + 8,
      124,
      "F1",
      7,
      MUTED
    );

    // Linhas de assinatura
    drawLine(cmds, 48, 66, 260, 66, DARK, 0.7);
    drawText(cmds, "Assinatura do(a) Servidor(a)", 102, 54, "F2", 7.5, DARK);
    drawText(cmds, truncateText(sheet.servidorNome, 36), 88, 43, "F1", 6.8, MUTED);

    drawLine(cmds, 335, 66, 547, 66, DARK, 0.7);
    drawText(cmds, "Chefia Imediata / RH da Secretaria", 374, 54, "F2", 7.5, DARK);
    drawText(cmds, "Data de entrega: ____/____/______", 385, 43, "F1", 6.8, MUTED);

    drawText(
      cmds,
      `RHBOX — Gestão de Servidores | Calendário Bahia/Brasil | Emitido por ${truncateText(emitidoPor, 26)} em ${new Date().toLocaleDateString("pt-BR")} | Arquivamento físico no RH`,
      marginX,
      20,
      "F1",
      6.6,
      MUTED
    );

    return { width: 595, height: 842, stream: cmds.join("\n") };
  });

  return compilePdfDocument(pages);
}

// ============================================================================
// BOLETIM MENSAL DE FREQUÊNCIA DA SECRETARIA (PDF A4 PAISAGEM)
// ============================================================================
export interface BoletimRowInput {
  servidor: string;
  matricula: string;
  secretaria: string;
  atestadoDias: number;
  afastamentoDias: number;
  faltasInjust: number;
  faltasJust: number;
  abonos: number;
  he50: number;
  he100: number;
  noturno: number;
  plantoes: number;
  observacao: string;
}

export function generateBoletimFrequenciaPdf(params: {
  competenciaLabel: string;
  secretariaLabel: string;
  statusLabel: string;
  emitidoPor: string;
  rows: BoletimRowInput[];
}): Buffer {
  const NAVY = "0.016 0.102 0.278";
  const BLUE = "0.000 0.278 0.702";
  const BORDER = "0.78 0.83 0.89";
  const WHITE = "1 1 1";
  const DARK = "0.08 0.12 0.20";
  const MUTED = "0.35 0.40 0.48";
  const ALT_BG = "0.973 0.980 0.992";
  const TOTAL_BG = "0.922 0.949 0.996";

  const marginX = 26;
  const pageW = 842;
  const pageH = 595;
  const contentW = pageW - marginX * 2; // 790 pt

  const cols = [
    { label: "Servidor", w: 165 },
    { label: "Matríc.", w: 58 },
    { label: "Sec.", w: 46 },
    { label: "Atest.", w: 38 },
    { label: "Afast.", w: 38 },
    { label: "F.Inj.", w: 38 },
    { label: "F.Just", w: 38 },
    { label: "Abono", w: 38 },
    { label: "HE 50%", w: 46 },
    { label: "HE 100%", w: 48 },
    { label: "Noturno", w: 48 },
    { label: "Plant.", w: 39 },
    { label: "Adicionais / Observação", w: 150 },
  ];

  const rowsPerPage = 21;
  const chunks: BoletimRowInput[][] = [];
  for (let i = 0; i < params.rows.length; i += rowsPerPage) {
    chunks.push(params.rows.slice(i, i + rowsPerPage));
  }
  if (chunks.length === 0) chunks.push([]);

  const totals = params.rows.reduce(
    (acc, r) => ({
      atestadoDias: acc.atestadoDias + r.atestadoDias,
      afastamentoDias: acc.afastamentoDias + r.afastamentoDias,
      faltasInjust: acc.faltasInjust + r.faltasInjust,
      faltasJust: acc.faltasJust + r.faltasJust,
      abonos: acc.abonos + r.abonos,
      he50: acc.he50 + r.he50,
      he100: acc.he100 + r.he100,
      noturno: acc.noturno + r.noturno,
      plantoes: acc.plantoes + r.plantoes,
    }),
    {
      atestadoDias: 0,
      afastamentoDias: 0,
      faltasInjust: 0,
      faltasJust: 0,
      abonos: 0,
      he50: 0,
      he100: 0,
      noturno: 0,
      plantoes: 0,
    }
  );

  const pages = chunks.map((chunk, pageIdx) => {
    const cmds: string[] = [];

    drawRect(cmds, marginX, 535, contentW, 34, NAVY);
    drawText(
      cmds,
      "RHBOX - BOLETIM MENSAL DE FREQUÊNCIA",
      marginX + 12,
      549,
      "F2",
      12,
      WHITE
    );
    drawText(
      cmds,
      `${params.competenciaLabel} | ${params.secretariaLabel}`,
      marginX + contentW - 290,
      549,
      "F2",
      9.5,
      "0.965 0.827 0.396"
    );

    drawText(
      cmds,
      `Status: ${params.statusLabel}  |  Servidores listados: ${params.rows.length}  |  Emitido por: ${params.emitidoPor} em ${new Date().toLocaleString("pt-BR")}`,
      marginX + 2,
      519,
      "F1",
      8,
      MUTED
    );

    const tableTop = 510;
    const headerH = 20;
    const rowH = 18;

    drawRect(cmds, marginX, tableTop - headerH, contentW, headerH, BLUE, NAVY, 0.6);
    let cx = marginX;
    for (const col of cols) {
      drawText(cmds, col.label, cx + 4, tableTop - 13, "F2", 7.5, WHITE);
      cx += col.w;
    }

    let yTop = tableTop - headerH;
    if (chunk.length === 0) {
      drawRect(cmds, marginX, yTop - 24, contentW, 24, WHITE, BORDER, 0.5);
      drawText(cmds, "Nenhum servidor encontrado para esta competência/secretaria.", marginX + 10, yTop - 15, "F1", 8.5, MUTED);
    } else {
      chunk.forEach((r, idx) => {
        const yBot = yTop - rowH;
        drawRect(
          cmds,
          marginX,
          yBot,
          contentW,
          rowH,
          idx % 2 === 1 ? ALT_BG : WHITE,
          BORDER,
          0.45
        );
        let vx = marginX;
        for (let i = 0; i < cols.length - 1; i++) {
          vx += cols[i].w;
          drawLine(cmds, vx, yBot, vx, yTop, BORDER, 0.45);
        }

        const vals = [
          truncateText(r.servidor, 30),
          truncateText(r.matricula, 11),
          truncateText(r.secretaria, 8),
          String(r.atestadoDias),
          String(r.afastamentoDias),
          String(r.faltasInjust),
          String(r.faltasJust),
          String(r.abonos),
          `${r.he50}h`,
          `${r.he100}h`,
          `${r.noturno}h`,
          String(r.plantoes),
          truncateText(r.observacao || "-", 28),
        ];

        let tx = marginX;
        vals.forEach((val, ci) => {
          drawText(
            cmds,
            val,
            tx + 4,
            yBot + 6,
            ci === 0 ? "F2" : "F1",
            7.2,
            DARK
          );
          tx += cols[ci].w;
        });

        yTop = yBot;
      });
    }

    // Linha de totais na última página
    if (pageIdx === chunks.length - 1) {
      const yBot = yTop - 20;
      drawRect(cmds, marginX, yBot, contentW, 20, TOTAL_BG, NAVY, 0.6);
      let vx = marginX;
      for (let i = 0; i < cols.length - 1; i++) {
        vx += cols[i].w;
        drawLine(cmds, vx, yBot, vx, yTop, BORDER, 0.5);
      }

      const totVals = [
        "TOTAIS GERAIS",
        `${params.rows.length} serv.`,
        "",
        String(totals.atestadoDias),
        String(totals.afastamentoDias),
        String(totals.faltasInjust),
        String(totals.faltasJust),
        String(totals.abonos),
        `${totals.he50}h`,
        `${totals.he100}h`,
        `${totals.noturno}h`,
        String(totals.plantoes),
        "Consolidado",
      ];
      let tx = marginX;
      totVals.forEach((val, ci) => {
        drawText(cmds, val, tx + 4, yBot + 6.5, "F2", 7.4, NAVY);
        tx += cols[ci].w;
      });

      drawLine(cmds, 100, 48, 340, 48, DARK, 0.65);
      drawText(cmds, "Responsável RH da Secretaria", 158, 36, "F2", 7.5, DARK);
      drawLine(cmds, 490, 48, 730, 48, DARK, 0.65);
      drawText(cmds, "Conferência RH Geral", 566, 36, "F2", 7.5, DARK);
    }

    drawText(
      cmds,
      `RHBOX — Gestão de Servidores | Página ${pageIdx + 1} de ${chunks.length}`,
      marginX,
      16,
      "F1",
      7,
      MUTED
    );

    return { width: pageW, height: pageH, stream: cmds.join("\n") };
  });

  return compilePdfDocument(pages);
}

// ============================================================================
// RELATÓRIO INDIVIDUAL DE FREQUÊNCIA DO SERVIDOR (PDF A4 RETRATO)
// ============================================================================
export interface IndividualCompetenciaLinha {
  competenciaLabel: string;
  atestadoDias: number;
  afastamentoDias: number;
  faltasInjust: number;
  faltasJust: number;
  abonos: number;
  he50: number;
  he100: number;
  noturno: number;
  plantoes: number;
  adicionaisObs: string;
}

export function generateRelatorioIndividualPdf(params: {
  servidorNome: string;
  matricula: string;
  cargo: string;
  vinculo: string;
  secretariaLabel: string;
  situacao: string;
  periodoLabel: string;
  emitidoPor: string;
  linhas: IndividualCompetenciaLinha[];
  ocorrenciasResumo: string[];
}): Buffer {
  const NAVY = "0.016 0.102 0.278";
  const BLUE = "0.000 0.278 0.702";
  const BORDER = "0.78 0.83 0.89";
  const WHITE = "1 1 1";
  const DARK = "0.08 0.12 0.20";
  const MUTED = "0.35 0.40 0.48";
  const SUB_BG = "0.953 0.969 0.988";
  const ALT_BG = "0.973 0.980 0.992";

  const cmds: string[] = [];
  const marginX = 28;
  const width = 539;

  drawRect(cmds, marginX, 782, width, 34, NAVY);
  drawText(
    cmds,
    "RHBOX - RELATÓRIO INDIVIDUAL DE FREQUÊNCIA",
    marginX + 12,
    796,
    "F2",
    11.5,
    WHITE
  );
  drawText(
    cmds,
    params.periodoLabel,
    marginX + width - 150,
    796,
    "F2",
    9.5,
    "0.965 0.827 0.396"
  );

  // Dados cadastrais
  drawRect(cmds, marginX, 720, width, 54, SUB_BG, BORDER, 0.6);
  drawText(cmds, "Servidor:", marginX + 8, 760, "F2", 8, MUTED);
  drawText(cmds, truncateText(params.servidorNome, 48), marginX + 52, 760, "F2", 9, DARK);
  drawText(cmds, "Matrícula:", marginX + 365, 760, "F2", 8, MUTED);
  drawText(cmds, params.matricula, marginX + 412, 760, "F2", 8.5, DARK);

  drawText(cmds, "Cargo:", marginX + 8, 744, "F2", 8, MUTED);
  drawText(cmds, truncateText(params.cargo, 42), marginX + 42, 744, "F1", 8.5, DARK);
  drawText(cmds, "Secretaria:", marginX + 365, 744, "F2", 8, MUTED);
  drawText(cmds, truncateText(params.secretariaLabel, 22), marginX + 416, 744, "F1", 8.5, DARK);

  drawText(cmds, "Vínculo:", marginX + 8, 728, "F2", 8, MUTED);
  drawText(cmds, params.vinculo, marginX + 48, 728, "F1", 8.5, DARK);
  drawText(cmds, "Situação atual:", marginX + 200, 728, "F2", 8, MUTED);
  drawText(cmds, params.situacao, marginX + 266, 728, "F2", 8.5, BLUE);

  // Tabela por competência
  const cols = [
    { label: "Competência", w: 86 },
    { label: "Atest.", w: 36 },
    { label: "Afast.", w: 36 },
    { label: "F.Inj.", w: 36 },
    { label: "F.Just", w: 36 },
    { label: "Abono", w: 38 },
    { label: "HE 50%", w: 42 },
    { label: "HE 100%", w: 45 },
    { label: "Not.", w: 34 },
    { label: "Plant.", w: 34 },
    { label: "Adicionais / Obs.", w: 116 },
  ];

  const tableTop = 708;
  drawRect(cmds, marginX, tableTop - 20, width, 20, BLUE, NAVY, 0.6);
  let cx = marginX;
  for (const col of cols) {
    drawText(cmds, col.label, cx + 3, tableTop - 13, "F2", 7, WHITE);
    cx += col.w;
  }

  let yTop = tableTop - 20;
  const rowH = 20;
  const tot = {
    at: 0,
    af: 0,
    fi: 0,
    fj: 0,
    ab: 0,
    h50: 0,
    h100: 0,
    not: 0,
    pl: 0,
  };

  params.linhas.forEach((ln, idx) => {
    tot.at += ln.atestadoDias;
    tot.af += ln.afastamentoDias;
    tot.fi += ln.faltasInjust;
    tot.fj += ln.faltasJust;
    tot.ab += ln.abonos;
    tot.h50 += ln.he50;
    tot.h100 += ln.he100;
    tot.not += ln.noturno;
    tot.pl += ln.plantoes;

    const yBot = yTop - rowH;
    drawRect(
      cmds,
      marginX,
      yBot,
      width,
      rowH,
      idx % 2 === 1 ? ALT_BG : WHITE,
      BORDER,
      0.45
    );
    let vx = marginX;
    for (let i = 0; i < cols.length - 1; i++) {
      vx += cols[i].w;
      drawLine(cmds, vx, yBot, vx, yTop, BORDER, 0.45);
    }

    const cells = [
      truncateText(ln.competenciaLabel, 15),
      String(ln.atestadoDias),
      String(ln.afastamentoDias),
      String(ln.faltasInjust),
      String(ln.faltasJust),
      String(ln.abonos),
      `${ln.he50}h`,
      `${ln.he100}h`,
      `${ln.noturno}h`,
      String(ln.plantoes),
      truncateText(ln.adicionaisObs || "-", 22),
    ];

    let tx = marginX;
    cells.forEach((v, ci) => {
      drawText(cmds, v, tx + 3, yBot + 6.5, ci === 0 ? "F2" : "F1", 7, DARK);
      tx += cols[ci].w;
    });

    yTop = yBot;
  });

  // Totais do período
  const yTotBot = yTop - 22;
  drawRect(cmds, marginX, yTotBot, width, 22, "0.922 0.949 0.996", NAVY, 0.6);
  let vx = marginX;
  for (let i = 0; i < cols.length - 1; i++) {
    vx += cols[i].w;
    drawLine(cmds, vx, yTotBot, vx, yTop, BORDER, 0.45);
  }
  const totCells = [
    "TOTAIS",
    String(tot.at),
    String(tot.af),
    String(tot.fi),
    String(tot.fj),
    String(tot.ab),
    `${tot.h50}h`,
    `${tot.h100}h`,
    `${tot.not}h`,
    String(tot.pl),
    "Consolidado",
  ];
  let tx = marginX;
  totCells.forEach((v, ci) => {
    drawText(cmds, v, tx + 3, yTotBot + 7.5, "F2", 7.2, NAVY);
    tx += cols[ci].w;
  });

  // Atestados / Afastamentos detalhados no período
  let detailY = yTotBot - 22;
  drawText(
    cmds,
    "Atestados e Afastamentos Registrados no Período:",
    marginX,
    detailY,
    "F2",
    8.5,
    NAVY
  );
  detailY -= 14;
  if (params.ocorrenciasResumo.length === 0) {
    drawText(
      cmds,
      "Nenhum atestado médico ou afastamento registrado para este período.",
      marginX + 6,
      detailY,
      "F1",
      7.8,
      MUTED
    );
  } else {
    for (const item of params.ocorrenciasResumo.slice(0, 12)) {
      if (detailY < 115) break;
      drawText(cmds, `- ${truncateText(item, 95)}`, marginX + 6, detailY, "F1", 7.8, DARK);
      detailY -= 12;
    }
  }

  // Assinaturas
  drawLine(cmds, 48, 66, 260, 66, DARK, 0.7);
  drawText(cmds, "Assinatura do(a) Servidor(a)", 100, 54, "F2", 7.5, DARK);
  drawLine(cmds, 335, 66, 547, 66, DARK, 0.7);
  drawText(cmds, "RH da Secretaria / RH Geral", 386, 54, "F2", 7.5, DARK);

  drawText(
    cmds,
    `RHBOX — Gestão de Servidores | Emitido por ${params.emitidoPor} em ${new Date().toLocaleString("pt-BR")}`,
    marginX,
    20,
    "F1",
    7,
    MUTED
  );

  return compilePdfDocument([{ width: 595, height: 842, stream: cmds.join("\n") }]);
}
