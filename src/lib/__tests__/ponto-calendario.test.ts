import { describe, expect, it } from "vitest";
import {
  countDiasUteis,
  getDaysInCompetencia,
  getHolidaysMapForYear,
} from "../calendario-ba";
import {
  generateBoletimFrequenciaPdf,
  generateFolhaPontoPdf,
  generateRelatorioIndividualPdf,
} from "../pdf";

describe("Calendário Bahia / Brasil e Geradores PDF de Ponto", () => {
  it("inclui feriados nacionais, Independência da Bahia (02/07) e municipais recorrentes", () => {
    const municipais = [
      {
        id: "m1",
        data: "2026-06-24",
        descricao: "São João",
        tipo: "feriado_municipal" as const,
        recorrente_anual: true,
        registrado_por: "RH Geral",
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    const map2026 = getHolidaysMapForYear(2026, municipais);
    expect(map2026.get("2026-07-02")?.esfera).toBe("estadual_ba");
    expect(map2026.get("2026-07-02")?.nome).toContain("Bahia");
    expect(map2026.get("2026-11-20")?.esfera).toBe("nacional");
    expect(map2026.get("2026-04-03")?.nome).toBe("Sexta-feira Santa");
    expect(map2026.get("2026-06-24")?.esfera).toBe("municipal");

    // Em 2027, feriado recorrente anual continua marcado
    const map2027 = getHolidaysMapForYear(2027, municipais);
    expect(map2027.get("2027-06-24")?.nome).toBe("São João");

    const nov2026 = getDaysInCompetencia("2026-11", municipais);
    expect(nov2026.length).toBe(30);
    const resumo = countDiasUteis(nov2026);
    expect(resumo.uteis).toBeGreaterThan(15);
    expect(resumo.feriadosNaSemana).toBe(2); // 02/11 (Seg) e 20/11 (Sex)
  });

  it("gera PDFs válidos da Folha de Ponto (1 e 2 turnos), Boletim e Relatório Individual", () => {
    const dias = getDaysInCompetencia("2026-11", []);
    const cobertura = new Map<string, string>([["2026-11-10", "Atestado Médico"]]);

    const folha2 = generateFolhaPontoPdf(
      [
        {
          servidorNome: "João José da Conceição",
          matricula: "2026-0001",
          cargo: "Professor Nível II",
          vinculo: "Efetivo",
          secretariaLabel: "SMEC - Educação",
          competenciaLabel: "Novembro / 2026",
          dias,
          coberturaDias: cobertura,
          turnos: 2,
          cargaHoraria: "40h",
        },
      ],
      "Administrador"
    );
    const txtFolha2 = folha2.toString("latin1");
    expect(txtFolha2.startsWith("%PDF-1.4")).toBe(true);
    expect(txtFolha2.trim().endsWith("%%EOF")).toBe(true);
    expect(txtFolha2).toContain("2 Turnos");

    const folha1 = generateFolhaPontoPdf(
      [
        {
          servidorNome: "Maria Clara Santos",
          matricula: "2026-0002",
          cargo: "Enfermeira",
          vinculo: "Efetivo",
          secretariaLabel: "SMS - Saúde",
          competenciaLabel: "Novembro / 2026",
          dias,
          coberturaDias: new Map(),
          turnos: 1,
        },
      ],
      "Administrador"
    );
    expect(folha1.toString("latin1")).toContain("1 Turno");

    const boletim = generateBoletimFrequenciaPdf({
      competenciaLabel: "Novembro / 2026",
      secretariaLabel: "SMEC - Educação",
      statusLabel: "Fechado pela Secretaria",
      emitidoPor: "RH Secretaria",
      rows: [
        {
          servidor: "João José",
          matricula: "2026-0001",
          secretaria: "SMEC",
          atestadoDias: 1,
          afastamentoDias: 0,
          faltasInjust: 0,
          faltasJust: 1,
          abonos: 1,
          he50: 4,
          he100: 0,
          noturno: 0,
          plantoes: 0,
          observacao: "Folha assinada ok",
        },
      ],
    });
    expect(boletim.toString("latin1").startsWith("%PDF-1.4")).toBe(true);

    const individual = generateRelatorioIndividualPdf({
      servidorNome: "João José",
      matricula: "2026-0001",
      cargo: "Professor",
      vinculo: "Efetivo",
      secretariaLabel: "SMEC - Educação",
      situacao: "Ativo",
      periodoLabel: "Novembro / 2026",
      emitidoPor: "RH Secretaria",
      linhas: [
        {
          competenciaLabel: "Novembro / 2026",
          atestadoDias: 1,
          afastamentoDias: 0,
          faltasInjust: 0,
          faltasJust: 1,
          abonos: 1,
          he50: 4,
          he100: 0,
          noturno: 0,
          plantoes: 0,
          adicionaisObs: "Substituição",
        },
      ],
      ocorrenciasResumo: ["Atestado Médico: 2026-11-10 a 2026-11-10 (1d)"],
    });
    expect(individual.toString("latin1").startsWith("%PDF-1.4")).toBe(true);
  });
});
