"use client";

import { useState, useTransition } from "react";
import { createSecretariaAction, toggleSecretariaAction } from "@/app/actions";
import type { Secretaria, UserRole } from "@/types/rh";
import { Building2, Plus, X, Users } from "lucide-react";

export function SecretariasClient({
  secretarias,
  countsBySec,
  userRole,
  onMutated,
}: {
  secretarias: Secretaria[];
  countsBySec: Record<string, number>;
  userRole: UserRole;
  onMutated?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const canManage = userRole === "admin" || userRole === "rh_geral";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createSecretariaAction(fd);
      if (!res.ok) setError(res.error || "Erro ao cadastrar.");
      else {
        setOpen(false);
        await onMutated?.();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#041A47]">
            Secretarias e Lotações
          </h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Estrutura simples de secretarias municipais vinculadas aos servidores.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#041A47] hover:bg-[#003A94] text-white text-xs font-semibold cursor-pointer"
          >
            <Plus size={15} />
            Nova Secretaria
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {secretarias.map((sec) => (
          <div
            key={sec.id}
            className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-2xs flex flex-col justify-between gap-4"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded bg-blue-50 text-[#041A47] font-bold text-xs border border-blue-200">
                  {sec.sigla}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    sec.ativa
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {sec.ativa ? "Ativa" : "Inativa"}
                </span>
              </div>
              <h2 className="text-sm font-bold text-[#041A47] mt-3 flex items-center gap-2">
                <Building2 size={15} className="text-[#0047B3] shrink-0" />
                <span>{sec.nome}</span>
              </h2>
              <p className="text-xs text-[#667085] mt-1">
                Responsável: {sec.responsavel || "Não informado"}
              </p>
            </div>

            <div className="pt-3 border-t border-[#EEF2F6] flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#344054]">
                <Users size={14} className="text-[#0047B3]" />
                {countsBySec[sec.id] || 0} servidor(es)
              </span>
              {canManage && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await toggleSecretariaAction(sec.id, !sec.ativa);
                      await onMutated?.();
                    })
                  }
                  className="text-[#0047B3] hover:underline font-semibold cursor-pointer"
                >
                  {sec.ativa ? "Inativar" : "Reativar"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-[#041A47] text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-bold">Nova Secretaria</h3>
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
                <label className="block font-semibold mb-1">Nome *</label>
                <input
                  name="nome"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                  placeholder="Ex.: Secretaria Municipal de Finanças"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Sigla *</label>
                <input
                  name="sigla"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD] uppercase"
                  placeholder="Ex.: SEFIN"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Responsável</label>
                <input
                  name="responsavel"
                  className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                  placeholder="Nome do secretário(a) ou coordenador(a)"
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
