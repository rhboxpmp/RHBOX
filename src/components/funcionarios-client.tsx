"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createFuncionarioAction } from "@/app/actions";
import { SuccessToast, useSuccessToast } from "./success-toast";
import {
  SITUACAO_LABELS,
  VINCULO_LABELS,
  type Funcionario,
  type Secretaria,
  type UserAccount,
} from "@/types/rh";
import { Plus, Search, X, Eye } from "lucide-react";

export function FuncionariosClient({
  funcionarios,
  secretarias,
  user,
  openInitially,
  onOpenFicha,
  onMutated,
}: {
  funcionarios: Funcionario[];
  secretarias: Secretaria[];
  user: UserAccount;
  openInitially: boolean;
  onOpenFicha?: (id: string) => void;
  onMutated?: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [secFilter, setSecFilter] = useState("todos");
  const [open, setOpen] = useState(openInitially);
  const [error, setError] = useState<string | null>(null);
  const { toast, showToast, clearToast } = useSuccessToast();
  const [pending, startTransition] = useTransition();

  const filtered = funcionarios.filter((f) => {
    const q = search.trim().toLowerCase();
    const matchText =
      !q ||
      f.nome.toLowerCase().includes(q) ||
      f.matricula.toLowerCase().includes(q) ||
      f.cargo.toLowerCase().includes(q);
    const matchSec = secFilter === "todos" || f.secretaria_id === secFilter;
    return matchText && matchSec;
  });

  const allowedSecretarias = secretarias.filter(
    (s) =>
      s.ativa &&
      (user.role !== "rh_secretaria" || s.id === user.secretaria_id)
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const nome = String(fd.get("nome") || "").trim();
    const matricula = String(fd.get("matricula") || "").trim();
    startTransition(async () => {
      const res = await createFuncionarioAction(fd);
      if (!res.ok) setError(res.error || "Erro ao cadastrar servidor.");
      else {
        setOpen(false);
        showToast("Servidor cadastrado!", `${nome} (Mat. ${matricula})`);
        await onMutated?.();
      }
    });
  }

  return (
    <div className="space-y-5">
      <SuccessToast toast={toast} onClose={clearToast} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#041A47]">Funcionários</h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Cadastro direto de servidores, vínculos e lotações ({filtered.length} exibidos).
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
          Novo Servidor
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, matrícula ou cargo..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#D0D5DD]"
          />
        </div>
        {user.role !== "rh_secretaria" && (
          <select
            value={secFilter}
            onChange={(e) => setSecFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-[#D0D5DD] bg-white"
          >
            <option value="todos">Todas as Secretarias</option>
            {secretarias.map((s) => (
              <option key={s.id} value={s.id}>
                {s.sigla} — {s.nome}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F8FAFC] text-[#667085] uppercase font-semibold border-b border-[#E2E8F0]">
            <tr>
              <th className="px-5 py-3">Servidor</th>
              <th className="px-5 py-3">Matrícula</th>
              <th className="px-5 py-3">Cargo / Vínculo</th>
              <th className="px-5 py-3">Secretaria</th>
              <th className="px-5 py-3">Situação</th>
              <th className="px-5 py-3 text-right">Ficha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF2F6]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-[#667085]">
                  Nenhum servidor encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((f) => (
                <tr key={f.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-5 py-3.5 font-semibold text-[#041A47]">
                    {f.nome}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[#667085]">
                    {f.matricula}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-[#344054]">{f.cargo}</div>
                    <div className="text-[11px] text-[#667085]">
                      {VINCULO_LABELS[f.vinculo]}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-[#041A47] font-semibold text-[11px]">
                      {f.secretaria_sigla || "-"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        f.situacao === "ativo"
                          ? "bg-emerald-50 text-emerald-700"
                          : f.situacao === "desligado"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {SITUACAO_LABELS[f.situacao]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {onOpenFicha ? (
                      <button
                        type="button"
                        onClick={() => onOpenFicha(f.id)}
                        className="inline-flex items-center gap-1 text-[#0047B3] font-semibold hover:underline cursor-pointer"
                      >
                        <Eye size={14} />
                        Abrir Ficha
                      </button>
                    ) : (
                      <Link
                        href={`/funcionarios/${f.id}`}
                        className="inline-flex items-center gap-1 text-[#0047B3] font-semibold hover:underline"
                      >
                        <Eye size={14} />
                        Abrir Ficha
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Novo Servidor */}
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xl w-full max-w-xl overflow-hidden">
            <div className="bg-[#041A47] text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-bold">Cadastrar Novo Servidor</h3>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">Nome Completo *</label>
                  <input
                    name="nome"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">CPF *</label>
                  <input
                    name="cpf"
                    required
                    placeholder="000.000.000-00"
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Matrícula *</label>
                  <input
                    name="matricula"
                    required
                    placeholder="Ex.: 2026-0100"
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Cargo *</label>
                  <input
                    name="cargo"
                    required
                    placeholder="Ex.: Professor, Técnico, Motorista"
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Vínculo *</label>
                  <select
                    name="vinculo"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD] bg-white"
                  >
                    <option value="efetivo">Efetivo</option>
                    <option value="contratado">Contratado</option>
                    <option value="comissionado">Comissionado</option>
                    <option value="temporario">Temporário</option>
                    <option value="estagiario">Estagiário</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Secretaria *</label>
                  <select
                    name="secretaria_id"
                    required
                    defaultValue={
                      user.role === "rh_secretaria" && user.secretaria_id
                        ? user.secretaria_id
                        : allowedSecretarias[0]?.id || ""
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD] bg-white"
                  >
                    {allowedSecretarias.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.sigla} — {s.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Data de Admissão *</label>
                  <input
                    name="data_admissao"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Telefone</label>
                  <input
                    name="telefone"
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                    placeholder="(77) 99999-0000"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">E-mail</label>
                  <input
                    name="email"
                    type="email"
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                  />
                </div>
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
                  {pending ? "Salvando..." : "Salvar Servidor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
