import fs from "node:fs";
import path from "node:path";
import type {
  ActivityLog,
  Atestado,
  FeriasAfastamento,
  Funcionario,
  Ocorrencia,
  Secretaria,
  UserAccount,
} from "@/types/rh";

export interface LocalDatabase {
  secretarias: Secretaria[];
  users: Array<UserAccount & { password: string }>;
  funcionarios: Funcionario[];
  atestados: Atestado[];
  ferias_afastamentos: FeriasAfastamento[];
  ocorrencias: Ocorrencia[];
  activity_logs: ActivityLog[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "rhbox-local.json");

function createInitialSeed(): LocalDatabase {
  const now = new Date().toISOString();
  const secSemad = "10000000-0000-4000-8000-000000000001";
  const secSms = "10000000-0000-4000-8000-000000000002";
  const secSmec = "10000000-0000-4000-8000-000000000003";
  const secSeinfra = "10000000-0000-4000-8000-000000000004";

  const f1 = "20000000-0000-4000-8000-000000000001";
  const f2 = "20000000-0000-4000-8000-000000000002";
  const f3 = "20000000-0000-4000-8000-000000000003";
  const f4 = "20000000-0000-4000-8000-000000000004";
  const f5 = "20000000-0000-4000-8000-000000000005";
  const f6 = "20000000-0000-4000-8000-000000000006";

  return {
    secretarias: [
      {
        id: secSemad,
        nome: "Secretaria Municipal de Administração",
        sigla: "SEMAD",
        responsavel: "Coordenação Administrativa",
        ativa: true,
        created_at: now,
      },
      {
        id: secSms,
        nome: "Secretaria Municipal de Saúde",
        sigla: "SMS",
        responsavel: "Diretoria de Saúde",
        ativa: true,
        created_at: now,
      },
      {
        id: secSmec,
        nome: "Secretaria Municipal de Educação",
        sigla: "SMEC",
        responsavel: "Coordenação Pedagógica",
        ativa: true,
        created_at: now,
      },
      {
        id: secSeinfra,
        nome: "Secretaria Municipal de Infraestrutura",
        sigla: "SEINFRA",
        responsavel: "Diretoria de Obras",
        ativa: true,
        created_at: now,
      },
    ],
    users: [
      {
        id: "30000000-0000-4000-8000-000000000001",
        nome: "Administrador do Sistema",
        email: "admin@planalto.local",
        password: "123456",
        role: "admin",
        secretaria_id: null,
        ativo: true,
        created_at: now,
      },
      {
        id: "30000000-0000-4000-8000-000000000002",
        nome: "Gestão RH Geral",
        email: "rh@planalto.local",
        password: "123456",
        role: "rh_geral",
        secretaria_id: null,
        ativo: true,
        created_at: now,
      },
      {
        id: "30000000-0000-4000-8000-000000000003",
        nome: "RH Secretaria de Saúde",
        email: "secretaria@planalto.local",
        password: "123456",
        role: "rh_secretaria",
        secretaria_id: secSms,
        ativo: true,
        created_at: now,
      },
    ],
    funcionarios: [
      {
        id: f1,
        nome: "Ana Clara Souza (Exemplo)",
        cpf: "SIM-CPF-0001",
        matricula: "2026-0001",
        cargo: "Enfermeira Municipal",
        vinculo: "efetivo",
        secretaria_id: secSms,
        data_admissao: "2021-03-15",
        telefone: "(77) 99900-0001",
        email: "ana.exemplo@planalto.local",
        situacao: "ativo",
        observacoes: "Registro fictício para demonstração local.",
        created_at: now,
      },
      {
        id: f2,
        nome: "Carlos Eduardo Lima (Exemplo)",
        cpf: "SIM-CPF-0002",
        matricula: "2026-0002",
        cargo: "Técnico em Enfermagem",
        vinculo: "contratado",
        secretaria_id: secSms,
        data_admissao: "2023-06-01",
        telefone: "(77) 99900-0002",
        email: "carlos.exemplo@planalto.local",
        situacao: "afastado",
        observacoes: null,
        created_at: now,
      },
      {
        id: f3,
        nome: "Mariana Oliveira (Exemplo)",
        cpf: "SIM-CPF-0003",
        matricula: "2026-0003",
        cargo: "Professora Nível II",
        vinculo: "efetivo",
        secretaria_id: secSmec,
        data_admissao: "2019-02-10",
        telefone: "(77) 99900-0003",
        email: "mariana.exemplo@planalto.local",
        situacao: "ferias",
        observacoes: null,
        created_at: now,
      },
      {
        id: f4,
        nome: "João Pedro Santos (Exemplo)",
        cpf: "SIM-CPF-0004",
        matricula: "2026-0004",
        cargo: "Auxiliar Administrativo",
        vinculo: "comissionado",
        secretaria_id: secSemad,
        data_admissao: "2025-01-05",
        telefone: "(77) 99900-0004",
        email: "joao.exemplo@planalto.local",
        situacao: "ativo",
        observacoes: null,
        created_at: now,
      },
      {
        id: f5,
        nome: "Fernanda Costa (Exemplo)",
        cpf: "SIM-CPF-0005",
        matricula: "2026-0005",
        cargo: "Motorista Categoria D",
        vinculo: "temporario",
        secretaria_id: secSeinfra,
        data_admissao: "2025-08-01",
        telefone: "(77) 99900-0005",
        email: "fernanda.exemplo@planalto.local",
        situacao: "ativo",
        observacoes: null,
        created_at: now,
      },
      {
        id: f6,
        nome: "Lucas Ribeiro (Exemplo)",
        cpf: "SIM-CPF-0006",
        matricula: "2026-0006",
        cargo: "Estagiário de Pedagogia",
        vinculo: "estagiario",
        secretaria_id: secSmec,
        data_admissao: "2026-02-01",
        telefone: "(77) 99900-0006",
        email: "lucas.exemplo@planalto.local",
        situacao: "ativo",
        observacoes: null,
        created_at: now,
      },
    ],
    atestados: [
      {
        id: "40000000-0000-4000-8000-000000000001",
        funcionario_id: f2,
        secretaria_id: secSms,
        data_emissao: "2026-11-18",
        data_inicio: "2026-11-18",
        data_fim: "2026-11-24",
        dias: 7,
        tipo: "Atestado Médico",
        status: "aprovado",
        observacoes: "Protocolo local de demonstração #001",
        anexo_nome: "atestado-exemplo-001.pdf",
        registrado_por: "RH Secretaria de Saúde",
        created_at: now,
      },
      {
        id: "40000000-0000-4000-8000-000000000002",
        funcionario_id: f1,
        secretaria_id: secSms,
        data_emissao: "2026-11-22",
        data_inicio: "2026-11-22",
        data_fim: "2026-11-23",
        dias: 2,
        tipo: "Declaração de Comparecimento",
        status: "recebido",
        observacoes: "Aguardando conferência do RH",
        anexo_nome: null,
        registrado_por: "RH Secretaria de Saúde",
        created_at: now,
      },
    ],
    ferias_afastamentos: [
      {
        id: "50000000-0000-4000-8000-000000000001",
        funcionario_id: f3,
        secretaria_id: secSmec,
        categoria: "ferias",
        subtipo: "Férias Regulamentares (30 dias)",
        data_inicio: "2026-11-05",
        data_fim: "2026-12-04",
        dias: 30,
        status: "em_andamento",
        observacoes: "Período aquisitivo 2025/2026",
        registrado_por: "Gestão RH Geral",
        created_at: now,
      },
      {
        id: "50000000-0000-4000-8000-000000000002",
        funcionario_id: f2,
        secretaria_id: secSms,
        categoria: "afastamento",
        subtipo: "Afastamento para Tratamento de Saúde",
        data_inicio: "2026-11-18",
        data_fim: "2026-11-24",
        dias: 7,
        status: "em_andamento",
        observacoes: "Originado do atestado #001",
        registrado_por: "Gestão RH Geral",
        created_at: now,
      },
    ],
    ocorrencias: [
      {
        id: "60000000-0000-4000-8000-000000000001",
        funcionario_id: f1,
        secretaria_id: secSms,
        tipo: "elogio",
        titulo: "Destaque na Campanha de Vacinação",
        descricao: "Reconhecimento pela organização da equipe de imunização na sede.",
        data_fato: "2026-10-20",
        numero_ato: "PORT-088/2026",
        registrado_por: "Gestão RH Geral",
        created_at: now,
      },
      {
        id: "60000000-0000-4000-8000-000000000002",
        funcionario_id: f4,
        secretaria_id: secSemad,
        tipo: "capacitacao",
        titulo: "Curso de Gestão de Pessoas no Setor Público",
        descricao: "Conclusão de capacitação com carga horária de 40h.",
        data_fato: "2026-11-10",
        numero_ato: null,
        registrado_por: "Administrador do Sistema",
        created_at: now,
      },
    ],
    activity_logs: [
      {
        id: "70000000-0000-4000-8000-000000000001",
        usuario_nome: "Sistema RHBOX Simples",
        usuario_role: "admin",
        modulo: "sistema",
        acao: "Inicialização da base local interativa",
        detalhes: "Base de demonstração criada com 4 secretarias e 6 servidores fictícios.",
        nivel: "info",
        created_at: now,
      },
    ],
  };
}

export function readLocalDb(): LocalDatabase {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const seed = createInitialSeed();
      fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2), "utf8");
      return seed;
    }
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw) as LocalDatabase;
  } catch {
    return createInitialSeed();
  }
}

export function writeLocalDb(db: LocalDatabase): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}
