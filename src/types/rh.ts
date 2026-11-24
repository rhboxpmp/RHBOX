export type UserRole = "admin" | "rh_geral" | "rh_secretaria";

export type VinculoTipo =
  | "efetivo"
  | "contratado"
  | "comissionado"
  | "temporario"
  | "estagiario";

export type SituacaoFuncionario =
  | "ativo"
  | "ferias"
  | "afastado"
  | "licenca"
  | "desligado";

export type StatusAtestado = "recebido" | "aprovado" | "rejeitado";

export type CategoriaMovimentacao = "ferias" | "licenca" | "afastamento";
export type StatusMovimentacao =
  | "programado"
  | "em_andamento"
  | "concluido"
  | "cancelado";

export type TipoOcorrencia =
  | "elogio"
  | "advertencia"
  | "transferencia"
  | "capacitacao"
  | "portaria"
  | "outro";

export interface Secretaria {
  id: string;
  nome: string;
  sigla: string;
  responsavel: string | null;
  ativa: boolean;
  created_at: string;
}

export interface UserAccount {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  secretaria_id: string | null;
  secretaria_sigla?: string | null;
  secretaria_nome?: string | null;
  ativo: boolean;
  created_at: string;
}

export interface Funcionario {
  id: string;
  nome: string;
  cpf: string;
  matricula: string;
  cargo: string;
  vinculo: VinculoTipo;
  secretaria_id: string;
  secretaria_nome?: string;
  secretaria_sigla?: string;
  data_admissao: string;
  telefone: string | null;
  email: string | null;
  situacao: SituacaoFuncionario;
  observacoes: string | null;
  created_at: string;
}

export interface Atestado {
  id: string;
  funcionario_id: string;
  funcionario_nome?: string;
  funcionario_matricula?: string;
  secretaria_id: string;
  secretaria_sigla?: string;
  data_emissao: string;
  data_inicio: string;
  data_fim: string;
  dias: number;
  tipo: string;
  status: StatusAtestado;
  observacoes: string | null;
  anexo_nome: string | null;
  anexo_path?: string | null;
  registrado_por: string;
  created_at: string;
}

export interface FeriasAfastamento {
  id: string;
  funcionario_id: string;
  funcionario_nome?: string;
  funcionario_matricula?: string;
  secretaria_id: string;
  secretaria_sigla?: string;
  categoria: CategoriaMovimentacao;
  subtipo: string;
  data_inicio: string;
  data_fim: string;
  dias: number;
  status: StatusMovimentacao;
  observacoes: string | null;
  registrado_por: string;
  created_at: string;
}

export interface Ocorrencia {
  id: string;
  funcionario_id: string;
  funcionario_nome?: string;
  funcionario_matricula?: string;
  secretaria_id: string;
  secretaria_sigla?: string;
  tipo: TipoOcorrencia;
  titulo: string;
  descricao: string;
  data_fato: string;
  numero_ato: string | null;
  registrado_por: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  usuario_nome: string;
  usuario_role: string;
  modulo: string;
  acao: string;
  detalhes: string | null;
  nivel: "info" | "alerta" | "erro";
  created_at: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  rh_geral: "RH Geral",
  rh_secretaria: "RH Secretaria",
};

export const VINCULO_LABELS: Record<VinculoTipo, string> = {
  efetivo: "Efetivo",
  contratado: "Contratado",
  comissionado: "Comissionado",
  temporario: "Temporário",
  estagiario: "Estagiário",
};

export const SITUACAO_LABELS: Record<SituacaoFuncionario, string> = {
  ativo: "Ativo",
  ferias: "Em Férias",
  afastado: "Afastado",
  licenca: "Em Licença",
  desligado: "Desligado",
};

export const OCORRENCIA_LABELS: Record<TipoOcorrencia, string> = {
  elogio: "Elogio / Reconhecimento",
  advertencia: "Advertência",
  transferencia: "Transferência de Lotação",
  capacitacao: "Capacitação / Curso",
  portaria: "Portaria / Ato",
  outro: "Outro Registro",
};
