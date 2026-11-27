"use client";

import { useState, useTransition } from "react";
import {
  createMovimentacaoAction,
  updateMovimentacaoStatusAction,
} from "@/app/actions";
import { SuccessToast, useSuccessToast } from "./success-toast";
import type {
  CategoriaMovimentacao,
  FeriasAfastamento,
  Funcionario,
} from "@/types/rh";
import { CalendarDays, Plus, X } from "lucide-react";

const CAT_LABELS: Record<CategoriaMovimentacao, string> = {
  ferias: "Férias",
  licenca: "Licença",
  afastamento: "Afastamento",
};

export function MovimentacoesClient({
  itens,
  funcionarios,
  openInitially,
  onMutated,
}: {
  itens: FeriasAfastamento[];
  funcionarios: Funcionario[];
  openInitially: boolean;
  onMutated?: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"todos" | CategoriaMovimentacao>("todos");
  const [open, setOpen] = useState(openInitially);
  const [inicio, setInicio] = useState(new Date().toISOString().slice(0, 10));
  const [fim, setFim] = useState(new Date().toISOString().slice(0, 10));
  const [dias, setDias] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const { toast, showToast, clearToast } = useSuccessToast();
  const [pending, startTransition] = useTransition();

  function recalc(s: string, e: string) {
    if (s && e) {
      const diff =
        Math.round(
          (new Date(e).getTime() - new Date(s).getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;
      if (diff > 0) setDias(diff);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const subtipo = String(fd.get("subtipo") || "Lançamento");
    const funcId = String(fd.get("funcionario_id") || "");
    const funcNome = funcionarios.find((f) => f.id === funcId)?.nome || "";
    startTransition(async () => {
      const res = await createMovimentacaoAction(fd);
      if (!res.ok) setError(res.error || "Erro ao salvar.");
      else {
        setOpen(false);
        showToast(
          "Registro salvo!",
          funcNome ? `${funcNome} · ${subtipo}` : subtipo
        );
        await onMutated?.();
      }
    });
  }

  const filtered = itens.filter((i) => tab === "todos" || i.categoria === tab);

  return (
    <div className="space-y-5">
      <SuccessToast toast={toast} onClose={clearToast} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#041A47] flex items-center gap-2">
            <CalendarDays size={20} className="text-[#0047B3]" />
            Férias, Licenças e Afastamentos
          </h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Controle unificado e direto sem bloqueios burocráticos.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#041A47] hover:bg-[#003A94] text-white text-xs font-semibold cursor-pointer"
        >
          <Plus size={15} />
          Novo Lançamento
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["todos", "ferias", "licenca", "afastamento"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
              tab === t
                ? "bg-[#041A47] text-white border-[#041A47]"
                : "bg-white text-[#344054] border-[#E2E8F0] hover:bg-slate-50"
            }`}
          >
            {t === "todos" ? `Todos (${itens.length})` : CAT_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F8FAFC] text-[#667085] uppercase font-semibold border-b border-[#E2E8F0]">
            <tr>
              <th className="px-5 py-3">Servidor</th>
              <th className="px-5 py-3">Categoria / Tipo</th>
              <th className="px-5 py-3">Período</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF2F6]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-[#667085]">
                  Nenhum lançamento registrado.
                </td>
              </tr>
            ) : (
              filtered.map((m) => (
                <tr key={m.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-[#041A47]">
                      {m.funcionario_nome}
                    </div>
                    <div className="text-[11px] text-[#667085]">
                      {m.secretaria_sigla} · Mat. {m.funcionario_matricula}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="px-2 py-0.5 rounded bg-teal-50 text-[#0047B3] font-bold text-[10px] uppercase">
                      {CAT_LABELS[m.categoria]}
                    </span>
                    <div className="mt-1 font-medium text-[#344054]">
                      {m.subtipo}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div>
                      {m.data_inicio} a {m.data_fim}
                    </div>
                    <div className="text-[11px] text-[#0047B3] font-bold">
                      {m.dias} dias
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[#041A47] font-bold text-[10px] uppercase">
                      {m.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right space-x-2">
                    {m.status !== "concluido" && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            await updateMovimentacaoStatusAction(m.id, "concluido");
                            await onMutated?.();
                          })
                        }
                        className="text-emerald-700 hover:underline font-semibold cursor-pointer"
                      >
                        Concluir
                      </button>
                    )}
                    {m.status !== "cancelado" && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            await updateMovimentacaoStatusAction(m.id, "cancelado");
                            await onMutated?.();
                          })
                        }
                        className="text-red-600 hover:underline font-semibold cursor-pointer"
                      >
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xl w-full max-w-lg overflow-hidden">
            <div className="bg-[#041A47] text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-bold">
                Novo Lançamento — Férias, Licença ou Afastamento
              </h3>
              <button onClick={() => setOpen(false)} className="cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
              {error && (
                <div className="p-2.5 rounded bg-red-50 text-red-700 border border-red-200">
                  {error}
                </div>
              )}

              <div>
                <label className="block font-semibold mb-1">Servidor *</label>
                <select
                  name="funcionario_id"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD] bg-white"
                >
                  <option value="">Selecione...</option>
                  {funcionarios.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome} ({f.secretaria_sigla})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Categoria *</label>
                  <select
                    name="categoria"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD] bg-white"
                  >
                    <option value="ferias">Férias</option>
                    <option value="licenca">Licença</option>
                    <option value="afastamento">Afastamento</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Status *</label>
                  <select
                    name="status"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD] bg-white"
                  >
                    <option value="programado">Programado</option>
                    <option value="em_andamento">Em andamento</option>
                    <option value="concluido">Concluído</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Descrição / Tipo *</label>
                <input
                  name="subtipo"
                  required
                  placeholder="Ex.: Férias 30 dias, Licença Maternidade, Afastamento Saúde"
                  className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Início *</label>
                  <input
                    name="data_inicio"
                    type="date"
                    required
                    value={inicio}
                    onChange={(e) => {
                      setInicio(e.target.value);
                      recalc(e.target.value, fim);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Fim *</label>
                  <input
                    name="data_fim"
                    type="date"
                    required
                    value={fim}
                    onChange={(e) => {
                      setFim(e.target.value);
                      recalc(inicio, e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Dias *</label>
                  <input
                    name="dias"
                    type="number"
                    min={1}
                    required
                    value={dias}
                    onChange={(e) => setDias(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Observações</label>
                <textarea
                  name="observacoes"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#D0D5DD] font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-4 py-2 rounded-lg bg-[#041A47] text-white font-semibold cursor-pointer"
                >
                  {pending ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
