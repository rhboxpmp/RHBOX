"use client";

import { useState } from "react";
import type { Secretaria, UserAccount } from "@/types/rh";
import { Download, FileBarChart2, FileSpreadsheet, FileText } from "lucide-react";

const REPORTS = [
  {
    id: "funcionarios",
    title: "Quadro de Servidores",
    desc: "Listagem completa com matrícula, cargo, vínculo, secretaria, admissão e situação.",
  },
  {
    id: "atestados",
    title: "Atestados Médicos",
    desc: "Todos os atestados lançados com período, quantidade de dias, tipo e status.",
  },
  {
    id: "ferias_afastamentos",
    title: "Férias, Licenças e Afastamentos",
    desc: "Programações e afastamentos ativos, concluídos ou cancelados.",
  },
  {
    id: "ocorrencias",
    title: "Ocorrências Funcionais",
    desc: "Histórico de elogios, advertências, capacitações, transferências e portarias.",
  },
];

export function RelatoriosClient({
  secretarias,
  user,
}: {
  secretarias: Secretaria[];
  user: UserAccount;
}) {
  const [secId, setSecId] = useState(
    user.role === "rh_secretaria" && user.secretaria_id ? user.secretaria_id : ""
  );

  function buildUrl(tipo: string, formato: "csv" | "pdf") {
    const sp = new URLSearchParams({ tipo, formato });
    if (secId) sp.set("secretariaId", secId);
    return `/api/relatorios/export?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#041A47] flex items-center gap-2">
          <FileBarChart2 size={20} className="text-[#0047B3]" />
          Relatórios (PDF e CSV)
        </h1>
        <p className="text-xs text-[#667085] mt-0.5">
          Gere planilhas para Excel (CSV) ou documentos prontos para impressão (PDF) com 1 clique.
        </p>
      </div>

      {user.role !== "rh_secretaria" && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-xs font-bold text-[#041A47]">
            Filtrar por Secretaria:
          </label>
          <select
            value={secId}
            onChange={(e) => setSecId(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-[#D0D5DD] bg-white max-w-sm"
          >
            <option value="">Todas as Secretarias</option>
            {secretarias.map((s) => (
              <option key={s.id} value={s.id}>
                {s.sigla} — {s.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORTS.map((rep) => (
          <div
            key={rep.id}
            className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-2xs flex flex-col justify-between gap-4"
          >
            <div>
              <h2 className="text-sm font-bold text-[#041A47]">{rep.title}</h2>
              <p className="text-xs text-[#667085] mt-1">{rep.desc}</p>
            </div>
            <div className="flex gap-2">
              <a
                href={buildUrl(rep.id, "pdf")}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#041A47] hover:bg-[#003A94] text-white text-xs font-semibold transition-colors"
              >
                <FileText size={14} />
                Baixar PDF
              </a>
              <a
                href={buildUrl(rep.id, "csv")}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#0047B3] hover:bg-[#003A94] text-white text-xs font-semibold transition-colors"
              >
                <FileSpreadsheet size={14} />
                Baixar CSV
                <Download size={12} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
