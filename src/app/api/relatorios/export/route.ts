import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  listAtestados,
  listFuncionarios,
  listMovimentacoes,
  listOcorrencias,
  recordActivityLog,
} from "@/lib/db";
import { generateCsv, generateSimplePdf } from "@/lib/pdf";
import { OCORRENCIA_LABELS, SITUACAO_LABELS, VINCULO_LABELS } from "@/types/rh";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const tipo = sp.get("tipo") || "funcionarios";
  const formato = sp.get("formato") === "pdf" ? "pdf" : "csv";
  const secretariaId = sp.get("secretariaId") || "";

  let title = "Relatório de Servidores";
  let headers: string[] = [];
  let rows: string[][] = [];

  if (tipo === "atestados") {
    title = "Relatório de Atestados Médicos";
    headers = ["Servidor", "Matrícula", "Secretaria", "Início", "Fim", "Dias", "Tipo", "Status"];
    const data = (await listAtestados(user)).filter(
      (a) => !secretariaId || a.secretaria_id === secretariaId
    );
    rows = data.map((a) => [
      a.funcionario_nome || "",
      a.funcionario_matricula || "",
      a.secretaria_sigla || "",
      a.data_inicio,
      a.data_fim,
      String(a.dias),
      a.tipo,
      a.status,
    ]);
  } else if (tipo === "ferias_afastamentos") {
    title = "Relatório de Férias, Licenças e Afastamentos";
    headers = ["Servidor", "Secretaria", "Categoria", "Tipo", "Início", "Fim", "Dias", "Status"];
    const data = (await listMovimentacoes(user)).filter(
      (m) => !secretariaId || m.secretaria_id === secretariaId
    );
    rows = data.map((m) => [
      m.funcionario_nome || "",
      m.secretaria_sigla || "",
      m.categoria,
      m.subtipo,
      m.data_inicio,
      m.data_fim,
      String(m.dias),
      m.status,
    ]);
  } else if (tipo === "ocorrencias") {
    title = "Relatório de Ocorrências Funcionais";
    headers = ["Data", "Servidor", "Secretaria", "Tipo", "Título", "Ato"];
    const data = (await listOcorrencias(user)).filter(
      (o) => !secretariaId || o.secretaria_id === secretariaId
    );
    rows = data.map((o) => [
      o.data_fato,
      o.funcionario_nome || "",
      o.secretaria_sigla || "",
      OCORRENCIA_LABELS[o.tipo],
      o.titulo,
      o.numero_ato || "-",
    ]);
  } else {
    title = "Quadro de Servidores";
    headers = ["Nome", "Matrícula", "Cargo", "Vínculo", "Secretaria", "Admissão", "Situação"];
    const data = (await listFuncionarios(user)).filter(
      (f) => !secretariaId || f.secretaria_id === secretariaId
    );
    rows = data.map((f) => [
      f.nome,
      f.matricula,
      f.cargo,
      VINCULO_LABELS[f.vinculo],
      f.secretaria_sigla || "",
      f.data_admissao,
      SITUACAO_LABELS[f.situacao],
    ]);
  }

  await recordActivityLog({
    user,
    modulo: "relatorios",
    acao: `Exportação ${formato.toUpperCase()} — ${title}`,
    detalhes: `${rows.length} registro(s) exportado(s)`,
  });

  if (formato === "pdf") {
    const pdfBuffer = generateSimplePdf(
      title,
      `Emitido por: ${user.nome} (${user.role})`,
      headers,
      rows
    );
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="rhbox-${tipo}.pdf"`,
      },
    });
  }

  const csv = generateCsv(headers, rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rhbox-${tipo}.csv"`,
    },
  });
}
