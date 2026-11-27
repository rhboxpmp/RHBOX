"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createFeriadoMunicipalAction,
  deleteFeriadoMunicipalAction,
  saveFrequenciaMensalAction,
  updateFrequenciaFechamentoAction,
} from "@/app/actions";
import { SuccessToast, useSuccessToast } from "./success-toast";
import {
  countDiasUteis,
  formatCompetenciaLabel,
  getDaysInCompetencia,
  getHolidaysMapForYear,
} from "@/lib/calendario-ba";
import { getCoberturaMensalServidor } from "@/lib/ponto-utils";
import {
  FECHAMENTO_STATUS_LABELS,
  type Atestado,
  type FeriadoMunicipal,
  type FeriasAfastamento,
  type FrequenciaFechamento,
  type FrequenciaMensal,
  type Funcionario,
  type Secretaria,
  type StatusFechamentoFrequencia,
  type TipoFeriadoMunicipal,
  type UserAccount,
} from "@/types/rh";
import {
  Calendar,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Edit3,
  FileSpreadsheet,
  FileText,
  Lock,
  Plus,
  Printer,
  Search,
  Trash2,
  Unlock,
  UserCheck,
  X,
} from "lucide-react";

function getCurrentCompetencia(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function PontoClient({
  user,
  secretarias,
  funcionarios,
  atestados,
  movimentacoes,
  feriadosMunicipais,
  frequencias,
  fechamentos,
  onMutated,
}: {
  user: UserAccount;
  secretarias: Secretaria[];
  funcionarios: Funcionario[];
  atestados: Atestado[];
  movimentacoes: FeriasAfastamento[];
  feriadosMunicipais: FeriadoMunicipal[];
  frequencias: FrequenciaMensal[];
  fechamentos: FrequenciaFechamento[];
  onMutated?: () => Promise<void>;
}) {
  const isRhGeralOrAdmin = user.role === "admin" || user.role === "rh_geral";

  const [competencia, setCompetencia] = useState(getCurrentCompetencia);
  const [secFilter, setSecFilter] = useState(() => {
    if (user.role === "rh_secretaria" && user.secretaria_id) {
      return user.secretaria_id;
    }
    return secretarias[0]?.id || "";
  });
  const [search, setSearch] = useState("");
  const [onlyWithOcorr, setOnlyWithOcorr] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const { toast, showToast, clearToast } = useSuccessToast();
  const [pending, startTransition] = useTransition();

  // Modais
  const [folhaModalOpen, setFolhaModalOpen] = useState(false);
  const [folhaTurnos, setFolhaTurnos] = useState<1 | 2>(2);
  const [folhaFuncId, setFolhaFuncId] = useState<string>("all");
  const [folhaCarga, setFolhaCarga] = useState("");

  const [feriadosModalOpen, setFeriadosModalOpen] = useState(false);
  const [feriadoTipo, setFeriadoTipo] =
    useState<TipoFeriadoMunicipal>("feriado_municipal");

  const [editTarget, setEditTarget] = useState<Funcionario | null>(null);
  const [individualModalFunc, setIndividualModalFunc] =
    useState<Funcionario | null>(null);
  const [individualEscopo, setIndividualEscopo] = useState<"mes" | "ano">("mes");

  const activeSecretariaId =
    user.role === "rh_secretaria" && user.secretaria_id
      ? user.secretaria_id
      : secFilter;

  const year = Number(competencia.slice(0, 4)) || new Date().getFullYear();
  const daysOfMonth = useMemo(
    () => getDaysInCompetencia(competencia, feriadosMunicipais),
    [competencia, feriadosMunicipais]
  );
  const { uteis: diasUteis, feriadosNaSemana } = useMemo(
    () => countDiasUteis(daysOfMonth),
    [daysOfMonth]
  );
  const holidaysOfYear = useMemo(
    () =>
      Array.from(getHolidaysMapForYear(year, feriadosMunicipais).values()).sort(
        (a, b) => a.iso.localeCompare(b.iso)
      ),
    [year, feriadosMunicipais]
  );

  const fechamentoAtual = useMemo(() => {
    if (!activeSecretariaId) return null;
    return (
      fechamentos.find(
        (f) =>
          f.secretaria_id === activeSecretariaId &&
          f.competencia === competencia
      ) || null
    );
  }, [fechamentos, activeSecretariaId, competencia]);

  const statusAtual: StatusFechamentoFrequencia =
    fechamentoAtual?.status || "aberto";
  const lockedForSecretaria =
    user.role === "rh_secretaria" && statusAtual !== "aberto";

  const servidoresDaSec = useMemo(() => {
    return funcionarios.filter(
      (f) =>
        f.situacao !== "desligado" &&
        (!activeSecretariaId || f.secretaria_id === activeSecretariaId)
    );
  }, [funcionarios, activeSecretariaId]);

  const linhasTabela = useMemo(() => {
    const q = search.trim().toLowerCase();
    return servidoresDaSec
      .map((func) => {
        const reg = frequencias.find(
          (r) => r.funcionario_id === func.id && r.competencia === competencia
        );
        const cob = getCoberturaMensalServidor(
          func.id,
          competencia,
          atestados,
          movimentacoes
        );
        const hasLancamento = Boolean(
          reg &&
            (reg.faltas_injustificadas > 0 ||
              reg.faltas_justificadas > 0 ||
              reg.abonos > 0 ||
              reg.horas_extras_50 > 0 ||
              reg.horas_extras_100 > 0 ||
              reg.adicional_noturno > 0 ||
              reg.plantoes > 0 ||
              reg.outros_adicionais ||
              reg.observacoes)
        );
        const hasAny =
          hasLancamento || cob.atestadoDias > 0 || cob.afastamentoDias > 0;
        return { func, reg, cob, hasAny };
      })
      .filter(({ func, hasAny }) => {
        if (onlyWithOcorr && !hasAny) return false;
        if (!q) return true;
        return (
          func.nome.toLowerCase().includes(q) ||
          func.matricula.toLowerCase().includes(q) ||
          func.cargo.toLowerCase().includes(q)
        );
      });
  }, [
    servidoresDaSec,
    frequencias,
    competencia,
    atestados,
    movimentacoes,
    search,
    onlyWithOcorr,
  ]);

  const totais = useMemo(() => {
    return linhasTabela.reduce(
      (acc, { reg, cob }) => ({
        faltas:
          acc.faltas +
          (reg?.faltas_injustificadas || 0) +
          (reg?.faltas_justificadas || 0),
        abonos: acc.abonos + (reg?.abonos || 0),
        atestados: acc.atestados + cob.atestadoDias,
        afastamentos: acc.afastamentos + cob.afastamentoDias,
        extrasHoras:
          acc.extrasHoras +
          (reg?.horas_extras_50 || 0) +
          (reg?.horas_extras_100 || 0) +
          (reg?.adicional_noturno || 0),
        plantoes: acc.plantoes + (reg?.plantoes || 0),
      }),
      {
        faltas: 0,
        abonos: 0,
        atestados: 0,
        afastamentos: 0,
        extrasHoras: 0,
        plantoes: 0,
      }
    );
  }, [linhasTabela]);

  function handleSaveFrequencia(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    const fd = new FormData(e.currentTarget);
    const targetNome = editTarget?.nome || "";
    startTransition(async () => {
      const res = await saveFrequenciaMensalAction(fd);
      if (!res.ok) {
        setFeedback({ type: "err", text: res.error || "Erro ao salvar." });
      } else {
        setEditTarget(null);
        showToast("Frequência salva!", targetNome);
        await onMutated?.();
      }
    });
  }

  function handleChangeFechamento(next: StatusFechamentoFrequencia) {
    if (!activeSecretariaId) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await updateFrequenciaFechamentoAction(
        activeSecretariaId,
        competencia,
        next
      );
      if (!res.ok) {
        setFeedback({ type: "err", text: res.error || "Erro ao atualizar status." });
      } else {
        showToast(
          "Competência atualizada!",
          FECHAMENTO_STATUS_LABELS[next]
        );
        await onMutated?.();
      }
    });
  }

  function handleAddFeriado(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const desc = String(fd.get("descricao") || "").trim();
    startTransition(async () => {
      const res = await createFeriadoMunicipalAction(fd);
      if (!res.ok) {
        setFeedback({ type: "err", text: res.error || "Erro ao cadastrar feriado." });
      } else {
        form.reset();
        showToast("Feriado cadastrado!", desc);
        await onMutated?.();
      }
    });
  }

  function buildFolhaPdfUrl(customFuncId?: string, customTurnos?: 1 | 2) {
    const sp = new URLSearchParams({
      competencia,
      turnos: String(customTurnos ?? folhaTurnos),
    });
    const targetFunc = customFuncId ?? (folhaFuncId !== "all" ? folhaFuncId : "");
    if (targetFunc) sp.set("funcionarioId", targetFunc);
    else if (activeSecretariaId) sp.set("secretariaId", activeSecretariaId);
    if (folhaCarga.trim() && !customFuncId) sp.set("carga", folhaCarga.trim());
    return `/api/ponto/folha-pdf?${sp.toString()}`;
  }

  function buildBoletimUrl(formato: "pdf" | "csv") {
    const sp = new URLSearchParams({
      modo: "boletim",
      formato,
      competencia,
    });
    if (activeSecretariaId) sp.set("secretariaId", activeSecretariaId);
    return `/api/ponto/export?${sp.toString()}`;
  }

  function buildIndividualUrl(funcId: string, escopo: "mes" | "ano") {
    const sp = new URLSearchParams({
      modo: "individual",
      formato: "pdf",
      competencia,
      escopo,
      funcionarioId: funcId,
    });
    return `/api/ponto/export?${sp.toString()}`;
  }

  const editReg = editTarget
    ? frequencias.find(
        (r) =>
          r.funcionario_id === editTarget.id && r.competencia === competencia
      )
    : null;
  const editCob = editTarget
    ? getCoberturaMensalServidor(
        editTarget.id,
        competencia,
        atestados,
        movimentacoes
      )
    : null;

  return (
    <div className="space-y-6">
      <SuccessToast toast={toast} onClose={clearToast} />
      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#041A47] flex items-center gap-2">
            <CalendarCheck2 size={20} className="text-[#0047B3]" />
            Ponto e Frequência Mensal
          </h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Geração de folha mensal para assinatura física (Calendário Bahia/Brasil), lançamento de faltas, abonos e adicionais.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setFolhaFuncId("all");
              setFolhaModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#041A47] hover:bg-[#003A94] text-white text-xs font-semibold cursor-pointer shadow-2xs"
          >
            <Printer size={15} />
            Imprimir Folha de Ponto (PDF)
          </button>

          <button
            type="button"
            onClick={() => setFeriadosModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-[#D0D5DD] hover:border-[#0047B3] text-[#041A47] text-xs font-semibold cursor-pointer"
          >
            <Calendar size={15} className="text-[#0047B3]" />
            Feriados ({year})
          </button>

          <a
            href={buildBoletimUrl("pdf")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0047B3] hover:bg-[#003A94] text-white text-xs font-semibold"
          >
            <FileText size={14} />
            Boletim PDF
          </a>

          <a
            href={buildBoletimUrl("csv")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-[#D0D5DD] hover:border-[#0047B3] text-[#041A47] text-xs font-semibold"
          >
            <FileSpreadsheet size={14} className="text-emerald-700" />
            CSV
          </a>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-lg px-4 py-2.5 text-xs font-medium border flex items-center justify-between ${
            feedback.type === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="cursor-pointer opacity-70 hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Barra de Filtros e Fechamento da Competência */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-[#667085] mb-1">
              Competência (Mês/Ano)
            </label>
            <input
              type="month"
              value={competencia}
              onChange={(e) => e.target.value && setCompetencia(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-[#D0D5DD] font-semibold text-[#041A47] bg-white"
            />
          </div>

          {isRhGeralOrAdmin ? (
            <div>
              <label className="block text-[11px] font-semibold text-[#667085] mb-1">
                Secretaria
              </label>
              <select
                value={secFilter}
                onChange={(e) => setSecFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-[#D0D5DD] font-semibold text-[#041A47] bg-white min-w-[220px]"
              >
                <option value="">Todas as Secretarias</option>
                {secretarias.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sigla} — {s.nome}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <span className="block text-[11px] font-semibold text-[#667085] mb-1">
                Secretaria Vinculada
              </span>
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-blue-50 text-[#041A47] font-bold border border-blue-200">
                {user.secretaria_sigla} — {user.secretaria_nome}
              </span>
            </div>
          )}
        </div>

        {activeSecretariaId && (
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span
              className={`px-3 py-1 rounded-full font-bold inline-flex items-center gap-1.5 ${
                statusAtual === "conferido_rh"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : statusAtual === "fechado_secretaria"
                  ? "bg-blue-50 text-[#0047B3] border border-blue-200"
                  : "bg-amber-50 text-amber-800 border border-amber-200"
              }`}
            >
              {statusAtual === "aberto" ? (
                <Unlock size={13} />
              ) : (
                <Lock size={13} />
              )}
              {FECHAMENTO_STATUS_LABELS[statusAtual]}
            </span>

            {statusAtual === "aberto" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => handleChangeFechamento("fechado_secretaria")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0047B3] hover:bg-[#003A94] text-white font-semibold cursor-pointer disabled:opacity-60"
              >
                <CheckCircle2 size={14} />
                Fechar e Enviar ao RH Geral
              </button>
            )}

            {isRhGeralOrAdmin && statusAtual === "fechado_secretaria" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => handleChangeFechamento("conferido_rh")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold cursor-pointer disabled:opacity-60"
              >
                <UserCheck size={14} />
                Confirmar Conferência
              </button>
            )}

            {isRhGeralOrAdmin && statusAtual !== "aberto" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => handleChangeFechamento("aberto")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D0D5DD] hover:border-[#041A47] text-[#344054] font-semibold cursor-pointer disabled:opacity-60"
              >
                <Unlock size={14} />
                Reabrir
              </button>
            )}
          </div>
        )}
      </div>

      {/* KPIs do Mês */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-2xs">
          <div className="text-xs font-semibold text-[#667085] flex items-center justify-between">
            <span>Calendário do Mês</span>
            <Calendar size={16} className="text-[#0047B3]" />
          </div>
          <div className="text-xl font-bold text-[#041A47] mt-1.5">
            {diasUteis} dias úteis
          </div>
          <div className="text-[11px] text-[#667085] mt-0.5">
            {feriadosNaSemana} feriado(s) em dia útil · {daysOfMonth.length} dias no mês
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-2xs">
          <div className="text-xs font-semibold text-[#667085]">
            Total de Faltas
          </div>
          <div className="text-xl font-bold text-[#041A47] mt-1.5">
            {totais.faltas} dia(s)
          </div>
          <div className="text-[11px] text-[#667085] mt-0.5">
            Somando justificadas e injustificadas
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-2xs">
          <div className="text-xs font-semibold text-[#667085]">
            Abonos + Afastamentos
          </div>
          <div className="text-xl font-bold text-[#041A47] mt-1.5">
            {totais.abonos} abono(s)
          </div>
          <div className="text-[11px] text-[#0047B3] font-medium mt-0.5">
            {totais.atestados}d atestado · {totais.afastamentos}d férias/afast. (auto)
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-2xs">
          <div className="text-xs font-semibold text-[#667085] flex items-center justify-between">
            <span>Horas Extras / Plantões</span>
            <Clock size={16} className="text-[#0047B3]" />
          </div>
          <div className="text-xl font-bold text-[#041A47] mt-1.5">
            {totais.extrasHoras}h · {totais.plantoes} pl.
          </div>
          <div className="text-[11px] text-[#667085] mt-0.5">
            HE 50%, HE 100%, Noturno e Plantões
          </div>
        </div>
      </div>

      {/* Busca e Tabela de Lançamento */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-[#EEF2F6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar servidor por nome, matrícula ou cargo..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-[#D0D5DD]"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#344054] cursor-pointer">
            <input
              type="checkbox"
              checked={onlyWithOcorr}
              onChange={(e) => setOnlyWithOcorr(e.target.checked)}
              className="rounded border-[#D0D5DD]"
            />
            Mostrar apenas com faltas, extras ou afastamentos
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[#667085] uppercase font-semibold border-b border-[#E2E8F0]">
              <tr>
                <th className="px-4 py-3">Servidor</th>
                <th className="px-3 py-3">Atest. / Afast. (Auto)</th>
                <th className="px-3 py-3">Faltas (dias)</th>
                <th className="px-3 py-3">Abonos</th>
                <th className="px-3 py-3">Extras / Adicionais</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {linhasTabela.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-center text-[#667085]"
                  >
                    Nenhum servidor ativo encontrado nesta seleção.
                  </td>
                </tr>
              ) : (
                linhasTabela.map(({ func, reg, cob }) => {
                  const hasExtras =
                    reg &&
                    (reg.horas_extras_50 > 0 ||
                      reg.horas_extras_100 > 0 ||
                      reg.adicional_noturno > 0 ||
                      reg.plantoes > 0 ||
                      Boolean(reg.outros_adicionais));

                  return (
                    <tr key={func.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3">
                        <div className="font-bold text-[#041A47]">
                          {func.nome}
                        </div>
                        <div className="text-[11px] text-[#667085]">
                          Mat. {func.matricula} · {func.cargo} ·{" "}
                          <strong>{func.secretaria_sigla}</strong>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        {cob.atestadoDias === 0 && cob.afastamentoDias === 0 ? (
                          <span className="text-slate-400">0 dia</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {cob.atestadoDias > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-semibold text-[10px]">
                                {cob.atestadoDias}d Atestado
                              </span>
                            )}
                            {cob.afastamentoDias > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#0047B3] font-semibold text-[10px]">
                                {cob.afastamentoDias}d Férias/Afast.
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        {reg &&
                        (reg.faltas_injustificadas > 0 ||
                          reg.faltas_justificadas > 0) ? (
                          <div className="space-y-0.5">
                            {reg.faltas_injustificadas > 0 && (
                              <div className="font-bold text-red-700">
                                {reg.faltas_injustificadas}d Injust.
                              </div>
                            )}
                            {reg.faltas_justificadas > 0 && (
                              <div className="font-semibold text-amber-700">
                                {reg.faltas_justificadas}d Justif.
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        {reg && reg.abonos > 0 ? (
                          <span className="font-semibold text-emerald-700">
                            {reg.abonos}d
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        {!hasExtras ? (
                          <span className="text-[11px] text-slate-400">
                            Normal (sem adicionais)
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {reg!.horas_extras_50 > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-[#041A47] font-semibold text-[10px]">
                                HE50: {reg!.horas_extras_50}h
                              </span>
                            )}
                            {reg!.horas_extras_100 > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 font-semibold text-[10px]">
                                HE100: {reg!.horas_extras_100}h
                              </span>
                            )}
                            {reg!.adicional_noturno > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold text-[10px]">
                                Not.: {reg!.adicional_noturno}h
                              </span>
                            )}
                            {reg!.plantoes > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold text-[10px]">
                                {reg!.plantoes} plantão(ões)
                              </span>
                            )}
                            {reg!.outros_adicionais && (
                              <span className="text-[10px] text-[#667085] w-full">
                                {reg!.outros_adicionais}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={lockedForSecretaria}
                            onClick={() => setEditTarget(func)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#041A47] hover:bg-[#003A94] text-white text-[11px] font-semibold cursor-pointer disabled:opacity-40"
                          >
                            <Edit3 size={12} />
                            Lançar
                          </button>

                          <button
                            type="button"
                            title="Gerar Folha de Ponto PDF deste servidor"
                            onClick={() => {
                              setFolhaFuncId(func.id);
                              setFolhaModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-[#D0D5DD] hover:border-[#0047B3] text-[#041A47] cursor-pointer"
                          >
                            <Printer size={13} />
                          </button>

                          <button
                            type="button"
                            title="Relatório Individual de Frequência (PDF)"
                            onClick={() => setIndividualModalFunc(func)}
                            className="p-1.5 rounded-lg border border-[#D0D5DD] hover:border-[#0047B3] text-[#0047B3] cursor-pointer"
                          >
                            <FileText size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: GERAR FOLHA DE PONTO MENSAL (PDF PARA ASSINATURA FÍSICA) */}
      {folhaModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xl w-full max-w-lg overflow-hidden">
            <div className="bg-[#041A47] text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Printer size={16} />
                Gerar Folha de Ponto Mensal (PDF)
              </h3>
              <button
                type="button"
                onClick={() => setFolhaModalOpen(false)}
                className="cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-[#041A47]">
                Competência: <strong>{formatCompetenciaLabel(competencia)}</strong> ·{" "}
                <strong>{feriadosNaSemana}</strong> feriado(s) em dia útil já marcados (Brasil + Bahia + Municipais). Férias e atestados registrados também saem preenchidos.
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Quem vai na impressão?
                </label>
                <select
                  value={folhaFuncId}
                  onChange={(e) => setFolhaFuncId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD] bg-white"
                >
                  <option value="all">
                    Todos os servidores ativos ({servidoresDaSec.length} folha(s) em 1 PDF)
                  </option>
                  {servidoresDaSec.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome} (Mat. {s.matricula})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1.5">
                  Modelo de Turnos na Folha
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFolhaTurnos(2)}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-colors ${
                      folhaTurnos === 2
                        ? "border-[#0047B3] bg-blue-50 text-[#041A47]"
                        : "border-[#D0D5DD] hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-bold">2 Turnos (Manhã e Tarde)</div>
                    <div className="text-[11px] text-[#667085] mt-0.5">
                      4 marcações: 1º Ent / 1º Saí / 2º Ent / 2º Saí
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFolhaTurnos(1)}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-colors ${
                      folhaTurnos === 1
                        ? "border-[#0047B3] bg-blue-50 text-[#041A47]"
                        : "border-[#D0D5DD] hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-bold">1 Turno / Plantão</div>
                    <div className="text-[11px] text-[#667085] mt-0.5">
                      2 marcações: Entrada / Saída
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Carga Horária / Horário (opcional)
                </label>
                <input
                  type="text"
                  value={folhaCarga}
                  onChange={(e) => setFolhaCarga(e.target.value)}
                  placeholder="Ex.: 40h semanais (08h-12h / 14h-18h)"
                  className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFolhaModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#D0D5DD] font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <a
                  href={buildFolhaPdfUrl()}
                  onClick={() => setFolhaModalOpen(false)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#041A47] hover:bg-[#003A94] text-white font-semibold"
                >
                  <Printer size={14} />
                  Baixar PDF para Imprimir
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: LANÇAR / EDITAR FREQUÊNCIA DO SERVIDOR NO MÊS */}
      {editTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xl w-full max-w-lg overflow-hidden">
            <div className="bg-[#041A47] text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">{editTarget.nome}</h3>
                <p className="text-[11px] text-blue-200">
                  {formatCompetenciaLabel(competencia)} · Mat.{" "}
                  {editTarget.matricula}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleSaveFrequencia}
              className="p-5 space-y-4 text-xs"
            >
              <input type="hidden" name="funcionario_id" value={editTarget.id} />
              <input type="hidden" name="competencia" value={competencia} />

              <div className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] p-3 flex flex-wrap gap-3 text-[11px]">
                <span>
                  Atestados no mês:{" "}
                  <strong className="text-amber-800">
                    {editCob?.atestadoDias || 0} dia(s)
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Férias/Afastamentos no mês:{" "}
                  <strong className="text-[#0047B3]">
                    {editCob?.afastamentoDias || 0} dia(s)
                  </strong>
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">
                    Faltas Injust. (dias)
                  </label>
                  <input
                    name="faltas_injustificadas"
                    type="number"
                    min={0}
                    defaultValue={editReg?.faltas_injustificadas ?? 0}
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">
                    Faltas Justif. (dias)
                  </label>
                  <input
                    name="faltas_justificadas"
                    type="number"
                    min={0}
                    defaultValue={editReg?.faltas_justificadas ?? 0}
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">
                    Abonos (dias)
                  </label>
                  <input
                    name="abonos"
                    type="number"
                    min={0}
                    defaultValue={editReg?.abonos ?? 0}
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold mb-1">HE 50% (h)</label>
                  <input
                    name="horas_extras_50"
                    type="number"
                    step="0.5"
                    min={0}
                    defaultValue={editReg?.horas_extras_50 ?? 0}
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">HE 100% (h)</label>
                  <input
                    name="horas_extras_100"
                    type="number"
                    step="0.5"
                    min={0}
                    defaultValue={editReg?.horas_extras_100 ?? 0}
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Noturno (h)</label>
                  <input
                    name="adicional_noturno"
                    type="number"
                    step="0.5"
                    min={0}
                    defaultValue={editReg?.adicional_noturno ?? 0}
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Plantões (qtd)</label>
                  <input
                    name="plantoes"
                    type="number"
                    min={0}
                    defaultValue={editReg?.plantoes ?? 0}
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Outros Adicionais (opcional)
                </label>
                <input
                  name="outros_adicionais"
                  defaultValue={editReg?.outros_adicionais ?? ""}
                  placeholder="Ex.: Sobreaviso 10h, Substituição 5 dias..."
                  className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Observações / Motivo dos Abonos
                </label>
                <textarea
                  name="observacoes"
                  rows={2}
                  defaultValue={editReg?.observacoes ?? ""}
                  placeholder="Ex.: Abono por doação de sangue em 12/11; folha assinada conferida."
                  className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="px-4 py-2 rounded-lg border border-[#D0D5DD] font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-4 py-2 rounded-lg bg-[#041A47] hover:bg-[#003A94] text-white font-semibold cursor-pointer disabled:opacity-60"
                >
                  {pending ? "Salvando..." : "Salvar Frequência"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CALENDÁRIO BAHIA/BRASIL + FERIADOS MUNICIPAIS */}
      {feriadosModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-[#041A47] text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Calendar size={16} />
                Calendário Bahia / Brasil e Feriados Municipais ({year})
              </h3>
              <button
                type="button"
                onClick={() => setFeriadosModalOpen(false)}
                className="cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs overflow-y-auto">
              {isRhGeralOrAdmin ? (
                <form
                  onSubmit={handleAddFeriado}
                  className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 space-y-3"
                >
                  <div className="font-bold text-[#041A47] flex items-center gap-1.5">
                    <Plus size={14} className="text-[#0047B3]" />
                    Adicionar Feriado Municipal ou Ponto Facultativo
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block font-semibold mb-1">Data *</label>
                      <input
                        name="data"
                        type="date"
                        required
                        className="w-full px-3 py-1.5 rounded-lg border border-[#D0D5DD] bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold mb-1">
                        Descrição *
                      </label>
                      <input
                        name="descricao"
                        required
                        placeholder="Ex.: São João / Emancipação Política / Padroeiro"
                        className="w-full px-3 py-1.5 rounded-lg border border-[#D0D5DD] bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-4">
                      <select
                        name="tipo"
                        value={feriadoTipo}
                        onChange={(e) =>
                          setFeriadoTipo(e.target.value as TipoFeriadoMunicipal)
                        }
                        className="px-3 py-1.5 rounded-lg border border-[#D0D5DD] bg-white font-semibold"
                      >
                        <option value="feriado_municipal">
                          Feriado Municipal
                        </option>
                        <option value="ponto_facultativo">
                          Ponto Facultativo
                        </option>
                      </select>

                      <label className="inline-flex items-center gap-1.5 font-semibold text-[#344054] cursor-pointer">
                        <input
                          type="checkbox"
                          name="recorrente_anual"
                          defaultChecked
                        />
                        Repetir todo ano
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#041A47] hover:bg-[#003A94] text-white font-semibold cursor-pointer disabled:opacity-60"
                    >
                      <Plus size={14} />
                      Adicionar
                    </button>
                  </div>
                </form>
              ) : (
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-[#041A47]">
                  O cadastro e a edição de feriados municipais são gerenciados pelo perfil <strong>RH Geral</strong>.
                </div>
              )}

              <div className="divide-y divide-[#EEF2F6] border border-[#E2E8F0] rounded-xl overflow-hidden">
                {holidaysOfYear.map((h) => (
                  <div
                    key={`${h.iso}-${h.nome}`}
                    className="px-4 py-2.5 flex items-center justify-between gap-3 bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-[#041A47]">
                        {h.iso.split("-").reverse().join("/")}
                      </span>
                      <span className="font-medium text-[#1E293B]">
                        {h.nome}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          h.esfera === "estadual_ba"
                            ? "bg-purple-50 text-purple-800"
                            : h.esfera === "municipal"
                            ? "bg-emerald-50 text-emerald-800"
                            : h.esfera === "facultativo"
                            ? "bg-amber-50 text-amber-800"
                            : "bg-blue-50 text-[#0047B3]"
                        }`}
                      >
                        {h.esfera === "estadual_ba"
                          ? "Estadual (BA)"
                          : h.esfera === "municipal"
                          ? h.recorrenteAnual
                            ? "Municipal (Anual)"
                            : "Municipal"
                          : h.esfera === "facultativo"
                          ? "Ponto Facultativo"
                          : "Nacional"}
                      </span>

                      {isRhGeralOrAdmin && h.customId && (
                        <button
                          type="button"
                          disabled={pending}
                          title="Remover feriado municipal"
                          onClick={() =>
                            startTransition(async () => {
                              await deleteFeriadoMunicipalAction(h.customId!);
                              await onMutated?.();
                            })
                          }
                          className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: RELATÓRIO INDIVIDUAL DO SERVIDOR */}
      {individualModalFunc && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-[#041A47] text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <FileText size={16} />
                Relatório Individual de Frequência
              </h3>
              <button
                type="button"
                onClick={() => setIndividualModalFunc(null)}
                className="cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <div className="font-bold text-[#041A47]">
                  {individualModalFunc.nome}
                </div>
                <div className="text-[#667085]">
                  Mat. {individualModalFunc.matricula} ·{" "}
                  {individualModalFunc.cargo}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block font-semibold">
                  Período do Relatório
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIndividualEscopo("mes")}
                    className={`p-3 rounded-lg border text-left cursor-pointer ${
                      individualEscopo === "mes"
                        ? "border-[#0047B3] bg-blue-50 text-[#041A47]"
                        : "border-[#D0D5DD]"
                    }`}
                  >
                    <div className="font-bold">Mês Atual</div>
                    <div className="text-[11px] text-[#667085]">
                      {formatCompetenciaLabel(competencia)}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIndividualEscopo("ano")}
                    className={`p-3 rounded-lg border text-left cursor-pointer ${
                      individualEscopo === "ano"
                        ? "border-[#0047B3] bg-blue-50 text-[#041A47]"
                        : "border-[#D0D5DD]"
                    }`}
                  >
                    <div className="font-bold">Ano Completo</div>
                    <div className="text-[11px] text-[#667085]">
                      Jan a Dez / {year}
                    </div>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIndividualModalFunc(null)}
                  className="px-4 py-2 rounded-lg border border-[#D0D5DD] font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <a
                  href={buildIndividualUrl(
                    individualModalFunc.id,
                    individualEscopo
                  )}
                  onClick={() => setIndividualModalFunc(null)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#041A47] hover:bg-[#003A94] text-white font-semibold"
                >
                  <FileText size={14} />
                  Baixar Relatório PDF
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
