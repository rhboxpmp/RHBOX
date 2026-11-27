"use client";

import { useState, useTransition } from "react";
import { createOcorrenciaAction } from "@/app/actions";
import { SuccessToast, useSuccessToast } from "./success-toast";
import {
  OCORRENCIA_LABELS,
  type Funcionario,
  type Ocorrencia,
  type TipoOcorrencia,
} from "@/types/rh";
import { ClipboardList, Plus, X } from "lucide-react";

export function OcorrenciasClient({
  ocorrencias,
  funcionarios,
  onMutated,
}: {
  ocorrencias: Ocorrencia[];
  funcionarios: Funcionario[];
  onMutated?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [error, setError] = useState<string | null>(null);
  const { toast, showToast, clearToast } = useSuccessToast();
  const [pending, startTransition] = useTransition();

  const filtered = ocorrencias.filter(
    (o) => tipoFilter === "todos" || o.tipo === tipoFilter
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const titulo = String(fd.get("titulo") || "").trim();
    const funcId = String(fd.get("funcionario_id") || "");
    const funcNome = funcionarios.find((f) => f.id === funcId)?.nome || "";
    startTransition(async () => {
      const res = await createOcorrenciaAction(fd);
      if (!res.ok) setError(res.error || "Erro ao registrar ocorrência.");
      else {
        setOpen(false);
        showToast(
          "Ocorrência registrada!",
          funcNome ? `${funcNome} · ${titulo}` : titulo
        );
        await onMutated?.();
      }
    });
  }

  return (
    <div className="space-y-5">
      <SuccessToast toast={toast} onClose={clearToast} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#041A47] flex items-center gap-2">
            <ClipboardList size={20} className="text-[#0047B3]" />
            Ocorrências Funcionais
          </h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Histórico simples de elogios, advertências, portarias, capacitações e transferências.
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
          Registrar Ocorrência
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTipoFilter("todos")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
            tipoFilter === "todos"
              ? "bg-[#041A47] text-white border-[#041A47]"
              : "bg-white text-[#344054] border-[#E2E8F0]"
          }`}
        >
          Todas ({ocorrencias.length})
        </button>
        {(Object.keys(OCORRENCIA_LABELS) as TipoOcorrencia[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTipoFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
              tipoFilter === t
                ? "bg-[#041A47] text-white border-[#041A47]"
                : "bg-white text-[#344054] border-[#E2E8F0]"
            }`}
          >
            {OCORRENCIA_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-8 text-center text-xs text-[#667085]">
            Nenhuma ocorrência registrada para este filtro.
          </div>
        ) : (
          filtered.map((o) => (
            <div
              key={o.id}
              className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-2xs flex flex-col sm:flex-row sm:items-start justify-between gap-3"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-[#041A47] font-bold text-[10px]">
                    {OCORRENCIA_LABELS[o.tipo]}
                  </span>
                  <span className="text-xs font-bold text-[#041A47]">
                    {o.titulo}
                  </span>
                  {o.numero_ato && (
                    <span className="text-[11px] font-mono text-[#667085]">
                      Ato: {o.numero_ato}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#344054] mt-1.5">{o.descricao}</p>
                <div className="text-[11px] text-[#667085] mt-2">
                  Servidor: <strong>{o.funcionario_nome}</strong> (
                  {o.secretaria_sigla}) · Registrado por {o.registrado_por}
                </div>
              </div>
              <div className="text-xs font-mono text-[#667085] shrink-0">
                {o.data_fato}
              </div>
            </div>
          ))
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xl w-full max-w-lg overflow-hidden">
            <div className="bg-[#041A47] text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-bold">Registrar Ocorrência Funcional</h3>
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
                  <label className="block font-semibold mb-1">Tipo *</label>
                  <select
                    name="tipo"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD] bg-white"
                  >
                    {(Object.keys(OCORRENCIA_LABELS) as TipoOcorrencia[]).map((t) => (
                      <option key={t} value={t}>
                        {OCORRENCIA_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Data do Fato *</label>
                  <input
                    name="data_fato"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold mb-1">Título *</label>
                  <input
                    name="titulo"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                    placeholder="Resumo da ocorrência"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Nº Ato / Portaria</label>
                  <input
                    name="numero_ato"
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Descrição *</label>
                <textarea
                  name="descricao"
                  required
                  rows={3}
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
                  {pending ? "Salvando..." : "Salvar Ocorrência"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
