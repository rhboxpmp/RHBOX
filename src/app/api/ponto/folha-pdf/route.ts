import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  listAtestados,
  listFeriadosMunicipais,
  listFuncionarios,
  listMovimentacoes,
  listSecretarias,
  recordActivityLog,
} from "@/lib/db";
import {
  formatCompetenciaLabel,
  getDaysInCompetencia,
} from "@/lib/calendario-ba";
import { getCoberturaMensalServidor } from "@/lib/ponto-utils";
import { generateFolhaPontoPdf, type FolhaPontoSheetInput } from "@/lib/pdf";
import { VINCULO_LABELS } from "@/types/rh";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const competencia = sp.get("competencia") || new Date().toISOString().slice(0, 7);
  const turnos = sp.get("turnos") === "1" ? 1 : 2;
  const cargaHoraria = (sp.get("carga") || "").trim();
  const funcionarioId = sp.get("funcionarioId") || "";
  const secretariaId =
    user.role === "rh_secretaria" && user.secretaria_id
      ? user.secretaria_id
      : sp.get("secretariaId") || "";

  if (!/^\d{4}-\d{2}$/.test(competencia)) {
    return NextResponse.json({ error: "Competência inválida." }, { status: 400 });
  }

  const [funcionarios, secretarias, atestados, movimentacoes, feriadosMunicipais] =
    await Promise.all([
      listFuncionarios(user),
      listSecretarias(),
      listAtestados(user),
      listMovimentacoes(user),
      listFeriadosMunicipais(),
    ]);

  const secMap = new Map(secretarias.map((s) => [s.id, s]));
  let alvos = funcionarios.filter((f) => f.situacao !== "desligado");
  if (funcionarioId) {
    alvos = alvos.filter((f) => f.id === funcionarioId);
  } else if (secretariaId) {
    alvos = alvos.filter((f) => f.secretaria_id === secretariaId);
  }

  if (alvos.length === 0) {
    return NextResponse.json(
      { error: "Nenhum servidor ativo encontrado para gerar a folha." },
      { status: 404 }
    );
  }

  const dias = getDaysInCompetencia(competencia, feriadosMunicipais);
  const competenciaLabel = formatCompetenciaLabel(competencia);

  const sheets: FolhaPontoSheetInput[] = alvos.map((func) => {
    const sec = secMap.get(func.secretaria_id);
    const cobertura = getCoberturaMensalServidor(
      func.id,
      competencia,
      atestados,
      movimentacoes
    );
    return {
      servidorNome: func.nome,
      matricula: func.matricula,
      cargo: func.cargo,
      vinculo: VINCULO_LABELS[func.vinculo],
      secretariaLabel: sec ? `${sec.sigla} - ${sec.nome}` : func.secretaria_sigla || "",
      competenciaLabel,
      dias,
      coberturaDias: cobertura.diasMap,
      turnos,
      cargaHoraria: cargaHoraria || undefined,
    };
  });

  const pdfBuffer = generateFolhaPontoPdf(sheets, user.nome);

  await recordActivityLog({
    user,
    modulo: "ponto",
    acao: `Folha de Ponto PDF gerada (${competencia})`,
    detalhes: `${sheets.length} folha(s) · ${turnos} turno(s)`,
  });

  const slug = funcionarioId
    ? `folha-${alvos[0].matricula}-${competencia}`
    : `folhas-${competencia}`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rhbox-${slug}.pdf"`,
    },
  });
}
