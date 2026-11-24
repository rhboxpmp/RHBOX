import {
  listActivityLogs,
  listAtestados,
  listFuncionarios,
  listMovimentacoes,
  listOcorrencias,
  listSecretarias,
  listUsers,
} from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase";
import type {
  ActivityLog,
  Atestado,
  FeriasAfastamento,
  Funcionario,
  Ocorrencia,
  Secretaria,
  UserAccount,
} from "@/types/rh";

export interface WorkspaceSnapshot {
  user: UserAccount;
  isLocalMode: boolean;
  secretarias: Secretaria[];
  funcionarios: Funcionario[];
  atestados: Atestado[];
  movimentacoes: FeriasAfastamento[];
  ocorrencias: Ocorrencia[];
  users: UserAccount[];
  logs: ActivityLog[];
}

export async function loadWorkspaceSnapshot(
  user: UserAccount
): Promise<WorkspaceSnapshot> {
  const [
    secretarias,
    funcionarios,
    atestados,
    movimentacoes,
    ocorrencias,
    users,
    logs,
  ] = await Promise.all([
    listSecretarias(),
    listFuncionarios(user),
    listAtestados(user),
    listMovimentacoes(user),
    listOcorrencias(user),
    user.role === "admin" ? listUsers(user) : Promise.resolve([]),
    user.role === "admin" ? listActivityLogs(user) : Promise.resolve([]),
  ]);

  return {
    user,
    isLocalMode: !isSupabaseConfigured(),
    secretarias,
    funcionarios,
    atestados,
    movimentacoes,
    ocorrencias,
    users,
    logs,
  };
}
