import {
  listActivityLogs,
  listAtestados,
  listFuncionarios,
  listMovimentacoes,
  listOcorrencias,
  listSecretariaResponsaveis,
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
  SecretariaResponsavel,
  UserAccount,
} from "@/types/rh";

export interface WorkspaceSnapshot {
  user: UserAccount;
  isLocalMode: boolean;
  secretarias: Secretaria[];
  secretariaResponsaveis: SecretariaResponsavel[];
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
    secretariaResponsaveis,
    funcionarios,
    atestados,
    movimentacoes,
    ocorrencias,
    users,
    logs,
  ] = await Promise.all([
    listSecretarias(),
    listSecretariaResponsaveis(user),
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
    secretariaResponsaveis,
    funcionarios,
    atestados,
    movimentacoes,
    ocorrencias,
    users,
    logs,
  };
}
