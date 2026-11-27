import {
  listActivityLogs,
  listAtestados,
  listFeriadosMunicipais,
  listFrequenciaFechamentos,
  listFrequenciaMensal,
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
  FeriadoMunicipal,
  FeriasAfastamento,
  FrequenciaFechamento,
  FrequenciaMensal,
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
  feriadosMunicipais: FeriadoMunicipal[];
  frequencias: FrequenciaMensal[];
  frequenciaFechamentos: FrequenciaFechamento[];
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
    feriadosMunicipais,
    frequencias,
    frequenciaFechamentos,
    users,
    logs,
  ] = await Promise.all([
    listSecretarias(),
    listSecretariaResponsaveis(user),
    listFuncionarios(user),
    listAtestados(user),
    listMovimentacoes(user),
    listOcorrencias(user),
    listFeriadosMunicipais(),
    listFrequenciaMensal(user),
    listFrequenciaFechamentos(user),
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
    feriadosMunicipais,
    frequencias,
    frequenciaFechamentos,
    users,
    logs,
  };
}
