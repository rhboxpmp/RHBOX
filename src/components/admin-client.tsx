"use client";

import { useState, useTransition } from "react";
import { createUserAction, toggleUserActiveAction } from "@/app/actions";
import { SuccessToast, useSuccessToast } from "./success-toast";
import {
  ROLE_LABELS,
  type ActivityLog,
  type Secretaria,
  type UserAccount,
  type UserRole,
} from "@/types/rh";
import {
  ShieldCheck,
  Users,
  Activity,
  Plus,
  X,
  Database,
  Eye,
  EyeOff,
} from "lucide-react";

export function AdminClient({
  users,
  logs,
  secretarias,
  currentUserId,
  isSupabase,
  onMutated,
}: {
  users: UserAccount[];
  logs: ActivityLog[];
  secretarias: Secretaria[];
  currentUserId: string;
  isSupabase: boolean;
  onMutated?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<UserRole>("rh_secretaria");
  const [showPassword, setShowPassword] = useState(false);
  const [logSearch, setLogSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast, showToast, clearToast } = useSuccessToast();
  const [pending, startTransition] = useTransition();

  const filteredLogs = logs.filter((l) => {
    const q = logSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      l.usuario_nome.toLowerCase().includes(q) ||
      l.modulo.toLowerCase().includes(q) ||
      l.acao.toLowerCase().includes(q) ||
      (l.detalhes || "").toLowerCase().includes(q)
    );
  });

  function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const nome = String(fd.get("nome") || "").trim();
    const email = String(fd.get("email") || "").trim().toLowerCase();
    startTransition(async () => {
      const res = await createUserAction(fd);
      if (!res.ok) setError(res.error || "Erro ao criar usuário.");
      else {
        setOpen(false);
        showToast("Usuário cadastrado!", `${nome} (${email})`);
        await onMutated?.();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#041A47] flex items-center gap-2">
            <ShieldCheck size={20} className="text-[#0047B3]" />
            Administração, Suporte e Logs
          </h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Controle central exclusivo do perfil Administrador (usuários, perfis, diagnóstico e logs).
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setShowPassword(false);
            setOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#041A47] hover:bg-[#003A94] text-white text-xs font-semibold cursor-pointer"
        >
          <Plus size={15} />
          Novo Usuário
        </button>
      </div>

      <SuccessToast toast={toast} onClose={clearToast} />

      {/* Status do Sistema */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-[#0047B3]" />
          <span className="font-bold text-[#041A47]">Modo de Armazenamento:</span>
          {isSupabase ? (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
              Supabase Conectado
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold">
              Local Interativo (.data/rhbox-local.json)
            </span>
          )}
        </div>
        <span className="text-[#667085]">
          Perfis suportados: <strong>Admin</strong> · <strong>RH Geral</strong> ·{" "}
          <strong>RH Secretaria</strong>
        </span>
      </div>

      {/* Gestão de Usuários */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#EEF2F6] flex items-center gap-2 text-sm font-bold text-[#041A47]">
          <Users size={16} className="text-[#0047B3]" />
          Usuários do Sistema ({users.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[#667085] uppercase font-semibold border-b border-[#E2E8F0]">
              <tr>
                <th className="px-5 py-3">Nome</th>
                <th className="px-5 py-3">E-mail</th>
                <th className="px-5 py-3">Perfil</th>
                <th className="px-5 py-3">Secretaria</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-5 py-3 font-semibold text-[#041A47]">
                    {u.nome}
                  </td>
                  <td className="px-5 py-3 text-[#667085]">{u.email}</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-[#041A47] font-bold text-[10px]">
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[#667085]">
                    {u.secretaria_sigla || "Todas (Global)"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.ativo
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {u.ativo ? "Ativo" : "Desativado"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {u.id !== currentUserId ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            await toggleUserActiveAction(u.id, !u.ativo);
                            await onMutated?.();
                          })
                        }
                        className="text-[#0047B3] hover:underline font-semibold cursor-pointer"
                      >
                        {u.ativo ? "Desativar" : "Reativar"}
                      </button>
                    ) : (
                      <span className="text-slate-400">Conta atual</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Logs de Suporte e Atividade */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#EEF2F6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[#041A47]">
            <Activity size={16} className="text-[#0047B3]" />
            Logs de Atividade e Suporte ({filteredLogs.length})
          </div>
          <input
            type="text"
            value={logSearch}
            onChange={(e) => setLogSearch(e.target.value)}
            placeholder="Filtrar por usuário, módulo ou ação..."
            className="px-3 py-1.5 text-xs rounded-lg border border-[#D0D5DD] sm:w-72"
          />
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[#667085] uppercase font-semibold border-b border-[#E2E8F0] sticky top-0">
              <tr>
                <th className="px-5 py-2.5">Data / Hora</th>
                <th className="px-5 py-2.5">Usuário</th>
                <th className="px-5 py-2.5">Módulo</th>
                <th className="px-5 py-2.5">Ação / Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {filteredLogs.map((l) => (
                <tr key={l.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-5 py-2.5 font-mono text-[11px] text-[#667085] whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="font-semibold text-[#041A47]">
                      {l.usuario_nome}
                    </div>
                    <div className="text-[10px] text-[#667085]">
                      {l.usuario_role}
                    </div>
                  </td>
                  <td className="px-5 py-2.5">
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px]">
                      {l.modulo}
                    </span>
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="font-semibold text-[#344054]">{l.acao}</div>
                    {l.detalhes && (
                      <div className="text-[11px] text-[#667085]">
                        {l.detalhes}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Novo Usuário */}
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-[#041A47] text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-bold">Novo Usuário</h3>
              <button onClick={() => setOpen(false)} className="cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-5 space-y-3.5 text-xs">
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
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">E-mail *</label>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD]"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Senha Inicial *</label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    defaultValue="123456"
                    className="w-full pl-3 pr-9 py-2 rounded-lg border border-[#D0D5DD]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-[#041A47] transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Perfil *</label>
                <select
                  name="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD] bg-white"
                >
                  <option value="rh_secretaria">RH Secretaria</option>
                  <option value="rh_geral">RH Geral</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              {role === "rh_secretaria" && (
                <div>
                  <label className="block font-semibold mb-1">
                    Secretaria Vinculada *
                  </label>
                  <select
                    name="secretaria_id"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-[#D0D5DD] bg-white"
                  >
                    <option value="">Selecione...</option>
                    {secretarias.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.sigla} — {s.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
                  {pending ? "Salvando..." : "Criar Usuário"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
