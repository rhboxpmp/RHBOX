"use client";

import { useState, useTransition } from "react";
import { createAtestadoAction, updateAtestadoStatusAction } from "@/app/actions";
import type { Atestado, Funcionario } from "@/types/rh";
import { Plus, Stethoscope, X, Check, Ban, Paperclip } from "lucide-react";

export function AtestadosClient({
  atestados,
  funcionarios,
  openInitially,
  onMutated,
}: {
  atestados: Atestado[];
  funcionarios: Funcionario[];
  openInitially: boolean;
  onMutated?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(openInitially);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [inicio, setInicio] = useState(new Date().toISOString().slice(0, 10));
  const [fim, setFim] = useState(new Date().toISOString().slice(0, 10));
  const [dias, setDias] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function recalcDays(s: string, e: string) {
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
    startTransition(async () => {
      const res = await createAtestadoAction(fd);
      if (!res.ok) setError(res.error || "Erro ao lançar atestado.");
      else {
        setOpen(false);
        await onMutated?.();
      }
    });
  }

  const filtered = atestados.filter(
    (a) => statusFilter === "todos" || a.status === statusFilter
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#041A47] flex items-center gap-2">
            <Stethoscope size={20} className="text-[#0047B3]" />
            Controle de Atestados Médicos
          </h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Lançamento rápido, controle de dias e aprovação direta sem burocracia.
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
          Lançar Atestado
        </button>
      </div>

      {/* Filtros rápidos */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: "todos", label: `Todos (${atestados.length})` },
          {
            id: "recebido",
            label: `Recebidos (${atestados.filter((a) => a.status === "recebido").length})`,
          },
          {
            id: "aprovado",
            label: `Aprovados (${atestados.filter((a) => a.status === "aprovado").length})`,
          },
          {
            id: "rejeitado",
            label: `Rejeitados (${atestados.filter((a) => a.status === "rejeitado").length})`,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              statusFilter === tab.id
                ? "bg-[#041A47] text-white border-[#041A47]"
                : "bg-white text-[#344054] border-[#E2E8F0] hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F8FAFC] text-[#667085] uppercase font-semibold border-b border-[#E2E8F0]">
            <tr>
              <th className="px-5 py-3">Servidor</th>
              <th className="px-5 py-3">Secretaria</th>
              <th className="px-5 py-3">Período / Dias</th>
              <th className="px-5 py-3">Tipo / Anexo</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF2F6]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-[#667085]">
                  Nenhum atestado nesta categoria.
                </td>
              </tr>
            ) : (
              filtered.map((a) => (
                <tr key={a.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-[#041A47]">
                      {a.funcionario_nome}
                    </div>
                    <div className="text-[11px] text-[#667085]">
                      Matrícula {a.funcionario_matricula}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-[#344054]">
                    {a.secretaria_sigla}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium">
                      {a.data_inicio} a {a.data_fim}
                    </div>
                    <div className="text-[11px] text-[#0047B3] font-bold">
                      {a.dias} dia{a.dias > 1 ? "s" : ""}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div>{a.tipo}</div>
                    {a.anexo_nome && (
                      <a
                        href={`/api/atestados/${a.id}/anexo`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-[#0047B3] hover:underline font-medium mt-0.5"
                      >
                        <Paperclip size={11} />
                        {a.anexo_nome}
                      </a>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        a.status === "aprovado"
                          ? "bg-emerald-50 text-emerald-700"
                          : a.status === "rejeitado"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {a.status === "recebido" ? (
                      <div className="inline-flex gap-1.5">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            startTransition(async () => {
                              await updateAtestadoStatusAction(a.id, "aprovado");
                              await onMutated?.();
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer"
                        >
                          <Check size={12} /> Aprovar
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            startTransition(async () => {
                              await updateAtestadoStatusAction(a.id, "rejeitado");
                              await onMutated?.();
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold cursor-pointer"
                        >
                          <Ban size={12} /> Rejeitar
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#667085]">
                        Por {a.registrado_por}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Lançar Atestado */}
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xl w-full max-w-lg overflow-hidden">
            <div className="bg-[#041A47] text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-bold">Lançar Atestado Médico</h3>
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
                  <option value="">Selecione o servidor...</option>
                  {funcionarios.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome} — Matrícula {f.matricula} ({f.secretaria_sigla})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Emissão *</label>
                  <input
                    name="data_emissao"
                    type="date"
                    required
                    defaultValue={inicio}
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Início *</label>
                  <input
                    name="data_inicio"
                    type="date"
                    required
                    value={inicio}
                    onChange={(e) => {
                      setInicio(e.target.value);
                      recalcDays(e.target.value, fim);
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
                      recalcDays(inicio, e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <label className="block font-semibold mb-1">Tipo</label>
                  <select
                    name="tipo"
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD] bg-white"
                  >
                    <option value="Atestado Médico">Atestado Médico</option>
                    <option value="Atestado Odontológico">Atestado Odontológico</option>
                    <option value="Declaração de Comparecimento">Declaração de Comparecimento</option>
                    <option value="Acompanhamento Familiar">Acompanhamento Familiar</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Anexo (PDF ou imagem — opcional)
                </label>
                <input
                  name="anexo"
                  type="file"
                  accept=".pdf,image/png,image/jpeg"
                  className="w-full text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-slate-100 file:font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Observações</label>
                <textarea
                  name="observacoes"
                  rows={2}
                  placeholder="Protocolo ou observação administrativa..."
                  className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                />
              </div>

              <label className="flex items-center gap-2 font-medium text-[#041A47]">
                <input type="checkbox" name="gerar_afastamento" />
                Registrar também em Férias/Afastamentos automaticamente
              </label>

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
                  {pending ? "Salvando..." : "Salvar Atestado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
