import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  listAtestados,
  listFrequenciaFechamentos,
  listFrequenciaMensal,
  listFuncionarios,
  listMovimentacoes,
  listSecretarias,
  recordActivityLog,
} from "@/lib/db";
import { formatCompetenciaLabel, MESES_PT } from "@/lib/calendario-ba";
import { getCoberturaMensalServidor } from "@/lib/ponto-utils";
import {
  generateBoletimFrequenciaPdf,
  generateCsv,
  generateRelatorioIndividualPdf,
  type BoletimRowInput,
  type IndividualCompetenciaLinha,
} from "@/lib/pdf";
import {
  FECHAMENTO_STATUS_LABELS,
  SITUACAO_LABELS,
  VINCULO_LABELS,
} from "@/types/rh";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const modo = sp.get("modo") || "boletim"; // boletim | individual
  const formato = sp.get("formato") === "csv" ? "csv" : "pdf";
  const competencia = sp.get("competencia") || new Date().toISOString().slice(0, 7);
  const escopo = sp.get("escopo") === "ano" ? "ano" : "mes";
  const funcionarioId = sp.get("funcionarioId") || "";
  const secretariaId =
    user.role === "rh_secretaria" && user.secretaria_id
      ? user.secretaria_id
      : sp.get("secretariaId") || "";

  const [funcionarios, secretarias, atestados, movimentacoes, frequencias, fechamentos] =
    await Promise.all([
      listFuncionarios(user),
      listSecretarias(),
      listAtestados(user),
      listMovimentacoes(user),
      listFrequenciaMensal(user),
      listFrequenciaFechamentos(user),
    ]);

  const secMap = new Map(secretarias.map((s) => [s.id, s]));

  // --------------------------------------------------------------------------
  // RELATÓRIO INDIVIDUAL DO SERVIDOR
  // --------------------------------------------------------------------------
  if (modo === "individual") {
    const func = funcionarios.find((f) => f.id === funcionarioId);
    if (!func) {
      return NextResponse.json(
        { error: "Servidor não encontrado no seu escopo." },
        { status: 404 }
      );
    }

    const year = competencia.slice(0, 4);
    const competenciasAlvo =
      escopo === "ano"
        ? Array.from(
            { length: 12 },
            (_, idx) => `${year}-${String(idx + 1).padStart(2, "0")}`
          )
        : [competencia];

    const linhas: IndividualCompetenciaLinha[] = competenciasAlvo.map((comp) => {
      const reg = frequencias.find(
        (r) => r.funcionario_id === func.id && r.competencia === comp
      );
      const cob = getCoberturaMensalServidor(
        func.id,
        comp,
        atestados,
        movimentacoes
      );
      const obsParts = [reg?.outros_adicionais, reg?.observacoes].filter(Boolean);
      return {
        competenciaLabel:
          escopo === "ano"
            ? `${MESES_PT[Number(comp.slice(5, 7)) - 1]}/${year}`
            : formatCompetenciaLabel(comp),
        atestadoDias: cob.atestadoDias,
        afastamentoDias: cob.afastamentoDias,
        faltasInjust: reg?.faltas_injustificadas ?? 0,
        faltasJust: reg?.faltas_justificadas ?? 0,
        abonos: reg?.abonos ?? 0,
        he50: reg?.horas_extras_50 ?? 0,
        he100: reg?.horas_extras_100 ?? 0,
        noturno: reg?.adicional_noturno ?? 0,
        plantoes: reg?.plantoes ?? 0,
        adicionaisObs: obsParts.join(" · "),
      };
    });

    const lastDayOfMonth = new Date(
      Date.UTC(Number(year), Number(competencia.slice(5, 7)), 0)
    ).getUTCDate();
    const periodStart = escopo === "ano" ? `${year}-01-01` : `${competencia}-01`;
    const periodEnd =
      escopo === "ano"
        ? `${year}-12-31`
        : `${competencia}-${String(lastDayOfMonth).padStart(2, "0")}`;

    const ocorrenciasResumo: string[] = [];
    for (const a of atestados) {
      if (a.funcionario_id !== func.id || a.status === "rejeitado") continue;
      if (a.data_inicio <= periodEnd && a.data_fim >= periodStart) {
        ocorrenciasResumo.push(
          `${a.tipo}: ${a.data_inicio} a ${a.data_fim} (${a.dias}d) [${a.status}]`
        );
      }
    }
    for (const m of movimentacoes) {
      if (m.funcionario_id !== func.id || m.status === "cancelado") continue;
      if (m.data_inicio <= periodEnd && m.data_fim >= periodStart) {
        ocorrenciasResumo.push(
          `${m.subtipo}: ${m.data_inicio} a ${m.data_fim} (${m.dias}d) [${m.status}]`
        );
      }
    }

    const sec = secMap.get(func.secretaria_id);
    const pdfBuffer = generateRelatorioIndividualPdf({
      servidorNome: func.nome,
      matricula: func.matricula,
      cargo: func.cargo,
      vinculo: VINCULO_LABELS[func.vinculo],
      secretariaLabel: sec ? `${sec.sigla} - ${sec.nome}` : func.secretaria_sigla || "",
      situacao: SITUACAO_LABELS[func.situacao],
      periodoLabel:
        escopo === "ano"
          ? `Ano ${year}`
          : formatCompetenciaLabel(competencia),
      emitidoPor: user.nome,
      linhas,
      ocorrenciasResumo,
    });

    await recordActivityLog({
      user,
      modulo: "ponto",
      acao: `Relatório Individual PDF (${escopo === "ano" ? year : competencia})`,
      detalhes: `${func.nome} (${func.matricula})`,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="rhbox-frequencia-${func.matricula}-${escopo === "ano" ? year : competencia}.pdf"`,
      },
    });
  }

  // --------------------------------------------------------------------------
  // BOLETIM MENSAL DA SECRETARIA (PDF ou CSV)
  // --------------------------------------------------------------------------
  const servidoresAlvo = funcionarios.filter(
    (f) =>
      f.situacao !== "desligado" &&
      (!secretariaId || f.secretaria_id === secretariaId)
  );

  const rows: BoletimRowInput[] = servidoresAlvo.map((f) => {
    const reg = frequencias.find(
      (r) => r.funcionario_id === f.id && r.competencia === competencia
    );
    const cob = getCoberturaMensalServidor(
      f.id,
      competencia,
      atestados,
      movimentacoes
    );
    const obs = [reg?.outros_adicionais, reg?.observacoes]
      .filter(Boolean)
      .join(" · ");
    return {
      servidor: f.nome,
      matricula: f.matricula,
      secretaria: f.secretaria_sigla || secMap.get(f.secretaria_id)?.sigla || "",
      atestadoDias: cob.atestadoDias,
      afastamentoDias: cob.afastamentoDias,
      faltasInjust: reg?.faltas_injustificadas ?? 0,
      faltasJust: reg?.faltas_justificadas ?? 0,
      abonos: reg?.abonos ?? 0,
      he50: reg?.horas_extras_50 ?? 0,
      he100: reg?.horas_extras_100 ?? 0,
      noturno: reg?.adicional_noturno ?? 0,
      plantoes: reg?.plantoes ?? 0,
      observacao: obs,
    };
  });

  await recordActivityLog({
    user,
    modulo: "ponto",
    acao: `Boletim Mensal ${formato.toUpperCase()} (${competencia})`,
    detalhes: `${rows.length} servidor(es)`,
  });

  if (formato === "csv") {
    const headers = [
      "Servidor",
      "Matrícula",
      "Secretaria",
      "Competência",
      "Atestados (dias)",
      "Férias/Afast. (dias)",
      "Faltas Injustificadas (dias)",
      "Faltas Justificadas (dias)",
      "Abonos (dias)",
      "Hora Extra 50% (h)",
      "Hora Extra 100% (h)",
      "Adicional Noturno (h)",
      "Plantões (qtd)",
      "Adicionais / Observações",
    ];
    const csvRows = rows.map((r) => [
      r.servidor,
      r.matricula,
      r.secretaria,
      competencia,
      String(r.atestadoDias),
      String(r.afastamentoDias),
      String(r.faltasInjust),
      String(r.faltasJust),
      String(r.abonos),
      String(r.he50),
      String(r.he100),
      String(r.noturno),
      String(r.plantoes),
      r.observacao || "",
    ]);
    const csv = generateCsv(headers, csvRows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="rhbox-boletim-frequencia-${competencia}.csv"`,
      },
    });
  }

  const secObj = secretariaId ? secMap.get(secretariaId) : null;
  const fech = secretariaId
    ? fechamentos.find(
        (x) => x.secretaria_id === secretariaId && x.competencia === competencia
      )
    : null;

  const pdfBuffer = generateBoletimFrequenciaPdf({
    competenciaLabel: formatCompetenciaLabel(competencia),
    secretariaLabel: secObj
      ? `${secObj.sigla} - ${secObj.nome}`
      : "Todas as Secretarias",
    statusLabel: fech ? FECHAMENTO_STATUS_LABELS[fech.status] : "Em preenchimento",
    emitidoPor: user.nome,
    rows,
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rhbox-boletim-frequencia-${competencia}.pdf"`,
    },
  });
}
