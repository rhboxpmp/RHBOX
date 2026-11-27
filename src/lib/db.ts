import crypto from "node:crypto";
import {
  createSupabaseAdmin,
  createSupabaseServer,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "./supabase";
import { readLocalDb, writeLocalDb } from "./local-store";
import type {
  ActivityLog,
  Atestado,
  CategoriaMovimentacao,
  FeriadoMunicipal,
  FeriasAfastamento,
  FrequenciaFechamento,
  FrequenciaMensal,
  Funcionario,
  Ocorrencia,
  Secretaria,
  SecretariaResponsavel,
  SituacaoFuncionario,
  StatusAtestado,
  StatusFechamentoFrequencia,
  StatusMovimentacao,
  TipoFeriadoMunicipal,
  TipoOcorrencia,
  UserAccount,
  UserRole,
  VinculoTipo,
} from "@/types/rh";

function canSeeSecretaria(user: UserAccount, secId: string): boolean {
  if (user.role === "admin" || user.role === "rh_geral") return true;
  return user.secretaria_id === secId;
}

export async function recordActivityLog(params: {
  user: Pick<UserAccount, "nome" | "role">;
  modulo: string;
  acao: string;
  detalhes?: string | null;
  nivel?: "info" | "alerta" | "erro";
}) {
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    await sb.from("activity_logs").insert({
      usuario_nome: params.user.nome,
      usuario_role: params.user.role,
      modulo: params.modulo,
      acao: params.acao,
      detalhes: params.detalhes ?? null,
      nivel: params.nivel ?? "info",
    });
    return;
  }

  const db = readLocalDb();
  db.activity_logs.unshift({
    id: crypto.randomUUID(),
    usuario_nome: params.user.nome,
    usuario_role: params.user.role,
    modulo: params.modulo,
    acao: params.acao,
    detalhes: params.detalhes ?? null,
    nivel: params.nivel ?? "info",
    created_at: new Date().toISOString(),
  });
  db.activity_logs = db.activity_logs.slice(0, 500);
  writeLocalDb(db);
}

// ============================================================================
// SECRETARIAS
// ============================================================================
export async function listSecretarias(): Promise<Secretaria[]> {
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    const { data } = await sb.from("secretarias").select("*").order("nome");
    return (data || []) as Secretaria[];
  }
  return [...readLocalDb().secretarias].sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function listSecretariaResponsaveis(
  user: UserAccount
): Promise<SecretariaResponsavel[]> {
  if (isSupabaseConfigured()) {
    const sb = isSupabaseAdminConfigured()
      ? createSupabaseAdmin()
      : await createSupabaseServer();
    let q = sb
      .from("profiles")
      .select("id, nome, email, role, secretaria_id, ativo")
      .not("secretaria_id", "is", null)
      .order("nome");
    if (user.role === "rh_secretaria" && user.secretaria_id) {
      q = q.eq("secretaria_id", user.secretaria_id);
    }
    const { data } = await q;
    return ((data || []) as Array<{
      id: string;
      nome: string;
      email: string;
      role: UserRole;
      secretaria_id: string | null;
      ativo: boolean;
    }>)
      .filter((p): p is SecretariaResponsavel => Boolean(p.secretaria_id));
  }

  return readLocalDb()
    .users.filter(
      (u) =>
        Boolean(u.secretaria_id) &&
        (user.role !== "rh_secretaria" || u.secretaria_id === user.secretaria_id)
    )
    .map((u) => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      role: u.role,
      secretaria_id: u.secretaria_id as string,
      ativo: u.ativo,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function createSecretaria(
  user: UserAccount,
  input: { nome: string; sigla: string; responsavel?: string }
): Promise<{ ok: boolean; error?: string }> {
  if (user.role === "rh_secretaria") {
    return { ok: false, error: "Apenas Admin ou RH Geral podem cadastrar secretarias." };
  }
  const sigla = input.sigla.trim().toUpperCase();
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    const { error } = await sb.from("secretarias").insert({
      nome: input.nome.trim(),
      sigla,
      responsavel: input.responsavel?.trim() || null,
      ativa: true,
    });
    if (error) return { ok: false, error: error.message };
  } else {
    const db = readLocalDb();
    if (db.secretarias.some((s) => s.sigla.toUpperCase() === sigla)) {
      return { ok: false, error: `A sigla ${sigla} já está cadastrada.` };
    }
    db.secretarias.push({
      id: crypto.randomUUID(),
      nome: input.nome.trim(),
      sigla,
      responsavel: input.responsavel?.trim() || null,
      ativa: true,
      created_at: new Date().toISOString(),
    });
    writeLocalDb(db);
  }
  await recordActivityLog({
    user,
    modulo: "secretarias",
    acao: "Secretaria cadastrada",
    detalhes: `${sigla} — ${input.nome.trim()}`,
  });
  return { ok: true };
}

export async function toggleSecretaria(
  user: UserAccount,
  id: string,
  ativa: boolean
): Promise<{ ok: boolean; error?: string }> {
  if (user.role === "rh_secretaria") {
    return { ok: false, error: "Sem permissão para alterar secretarias." };
  }
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    const { error } = await sb.from("secretarias").update({ ativa }).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const db = readLocalDb();
    const sec = db.secretarias.find((s) => s.id === id);
    if (!sec) return { ok: false, error: "Secretaria não encontrada." };
    sec.ativa = ativa;
    writeLocalDb(db);
  }
  await recordActivityLog({
    user,
    modulo: "secretarias",
    acao: ativa ? "Secretaria reativada" : "Secretaria inativada",
    detalhes: `ID: ${id}`,
  });
  return { ok: true };
}

// ============================================================================
// FUNCIONÁRIOS
// ============================================================================
export async function listFuncionarios(user: UserAccount): Promise<Funcionario[]> {
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    let q = sb
      .from("funcionarios")
      .select("*, secretarias(nome, sigla)")
      .order("nome");
    if (user.role === "rh_secretaria" && user.secretaria_id) {
      q = q.eq("secretaria_id", user.secretaria_id);
    }
    const { data } = await q;
    return (data || []).map((row: Record<string, unknown>) => {
      const sec = Array.isArray(row.secretarias)
        ? (row.secretarias[0] as { nome?: string; sigla?: string } | undefined)
        : (row.secretarias as { nome?: string; sigla?: string } | null);
      return {
        ...(row as unknown as Funcionario),
        secretaria_nome: sec?.nome,
        secretaria_sigla: sec?.sigla,
      };
    });
  }

  const db = readLocalDb();
  const secMap = new Map(db.secretarias.map((s) => [s.id, s]));
  return db.funcionarios
    .filter((f) => canSeeSecretaria(user, f.secretaria_id))
    .map((f) => ({
      ...f,
      secretaria_nome: secMap.get(f.secretaria_id)?.nome,
      secretaria_sigla: secMap.get(f.secretaria_id)?.sigla,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function getFuncionarioById(
  user: UserAccount,
  id: string
): Promise<Funcionario | null> {
  const all = await listFuncionarios(user);
  return all.find((f) => f.id === id) || null;
}

export async function createFuncionario(
  user: UserAccount,
  input: {
    nome: string;
    cpf: string;
    matricula: string;
    cargo: string;
    vinculo: VinculoTipo;
    secretaria_id: string;
    data_admissao: string;
    telefone?: string;
    email?: string;
    observacoes?: string;
  }
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const targetSec =
    user.role === "rh_secretaria" && user.secretaria_id
      ? user.secretaria_id
      : input.secretaria_id;

  if (!canSeeSecretaria(user, targetSec)) {
    return { ok: false, error: "Você só pode cadastrar servidores na sua secretaria." };
  }

  const id = crypto.randomUUID();
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    const { error } = await sb.from("funcionarios").insert({
      id,
      nome: input.nome.trim(),
      cpf: input.cpf.trim(),
      matricula: input.matricula.trim(),
      cargo: input.cargo.trim(),
      vinculo: input.vinculo,
      secretaria_id: targetSec,
      data_admissao: input.data_admissao,
      telefone: input.telefone?.trim() || null,
      email: input.email?.trim() || null,
      situacao: "ativo",
      observacoes: input.observacoes?.trim() || null,
    });
    if (error) return { ok: false, error: error.message };
  } else {
    const db = readLocalDb();
    if (db.funcionarios.some((f) => f.cpf === input.cpf.trim())) {
      return { ok: false, error: "CPF já cadastrado para outro servidor." };
    }
    if (db.funcionarios.some((f) => f.matricula === input.matricula.trim())) {
      return { ok: false, error: "Matrícula já cadastrada." };
    }
    db.funcionarios.push({
      id,
      nome: input.nome.trim(),
      cpf: input.cpf.trim(),
      matricula: input.matricula.trim(),
      cargo: input.cargo.trim(),
      vinculo: input.vinculo,
      secretaria_id: targetSec,
      data_admissao: input.data_admissao,
      telefone: input.telefone?.trim() || null,
      email: input.email?.trim() || null,
      situacao: "ativo",
      observacoes: input.observacoes?.trim() || null,
      created_at: new Date().toISOString(),
    });
    writeLocalDb(db);
  }

  await recordActivityLog({
    user,
    modulo: "funcionarios",
    acao: "Servidor cadastrado",
    detalhes: `${input.nome.trim()} (Matrícula ${input.matricula.trim()})`,
  });
  return { ok: true, id };
}

export async function updateFuncionarioSituacao(
  user: UserAccount,
  id: string,
  situacao: SituacaoFuncionario
): Promise<{ ok: boolean; error?: string }> {
  const func = await getFuncionarioById(user, id);
  if (!func) return { ok: false, error: "Servidor não encontrado no seu escopo." };

  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    const { error } = await sb
      .from("funcionarios")
      .update({ situacao, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const db = readLocalDb();
    const target = db.funcionarios.find((f) => f.id === id);
    if (target) target.situacao = situacao;
    writeLocalDb(db);
  }

  await recordActivityLog({
    user,
    modulo: "funcionarios",
    acao: "Situação atualizada",
    detalhes: `${func.nome} → ${situacao}`,
  });
  return { ok: true };
}

// ============================================================================
// ATESTADOS
// ============================================================================
export async function listAtestados(user: UserAccount): Promise<Atestado[]> {
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    let q = sb
      .from("atestados")
      .select("*, funcionarios(nome, matricula), secretarias(sigla)")
      .order("data_inicio", { ascending: false });
    if (user.role === "rh_secretaria" && user.secretaria_id) {
      q = q.eq("secretaria_id", user.secretaria_id);
    }
    const { data } = await q;
    return (data || []).map((row: Record<string, unknown>) => {
      const f = Array.isArray(row.funcionarios)
        ? (row.funcionarios[0] as { nome?: string; matricula?: string } | undefined)
        : (row.funcionarios as { nome?: string; matricula?: string } | null);
      const s = Array.isArray(row.secretarias)
        ? (row.secretarias[0] as { sigla?: string } | undefined)
        : (row.secretarias as { sigla?: string } | null);
      return {
        ...(row as unknown as Atestado),
        funcionario_nome: f?.nome,
        funcionario_matricula: f?.matricula,
        secretaria_sigla: s?.sigla,
      };
    });
  }

  const db = readLocalDb();
  const fMap = new Map(db.funcionarios.map((f) => [f.id, f]));
  const sMap = new Map(db.secretarias.map((s) => [s.id, s]));
  return db.atestados
    .filter((a) => canSeeSecretaria(user, a.secretaria_id))
    .map((a) => ({
      ...a,
      funcionario_nome: fMap.get(a.funcionario_id)?.nome,
      funcionario_matricula: fMap.get(a.funcionario_id)?.matricula,
      secretaria_sigla: sMap.get(a.secretaria_id)?.sigla,
    }))
    .sort((a, b) => b.data_inicio.localeCompare(a.data_inicio));
}

export async function createAtestado(
  user: UserAccount,
  input: {
    funcionario_id: string;
    data_emissao: string;
    data_inicio: string;
    data_fim: string;
    dias: number;
    tipo: string;
    observacoes?: string;
    anexo_nome?: string | null;
    anexo_file?: File | null;
    gerar_afastamento?: boolean;
  }
): Promise<{ ok: boolean; error?: string }> {
  const func = await getFuncionarioById(user, input.funcionario_id);
  if (!func) {
    return { ok: false, error: "Servidor não localizado no seu escopo." };
  }

  const id = crypto.randomUUID();
  let anexoPath: string | null = null;
  const anexoNome = input.anexo_file && input.anexo_file.size > 0
    ? input.anexo_file.name
    : input.anexo_nome || null;

  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();

    if (input.anexo_file && input.anexo_file.size > 0) {
      if (input.anexo_file.size > 10 * 1024 * 1024) {
        return { ok: false, error: "Arquivo excede o limite de 10 MB." };
      }
      const ext = (input.anexo_file.name.split(".").pop() || "pdf")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      if (!["pdf", "png", "jpg", "jpeg"].includes(ext)) {
        return {
          ok: false,
          error: "Formato não permitido. Envie PDF, PNG ou JPEG.",
        };
      }
      const buffer = Buffer.from(await input.anexo_file.arrayBuffer());
      anexoPath = `${func.secretaria_id}/${id}.${ext}`;
      const { error: upErr } = await sb.storage
        .from("atestados")
        .upload(anexoPath, buffer, {
          contentType: input.anexo_file.type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) {
        return {
          ok: false,
          error: `Erro ao enviar anexo para o Storage: ${upErr.message}`,
        };
      }
    }

    const { error } = await sb.from("atestados").insert({
      id,
      funcionario_id: func.id,
      secretaria_id: func.secretaria_id,
      data_emissao: input.data_emissao,
      data_inicio: input.data_inicio,
      data_fim: input.data_fim,
      dias: input.dias,
      tipo: input.tipo.trim() || "Atestado Médico",
      status: "recebido",
      observacoes: input.observacoes?.trim() || null,
      anexo_nome: anexoNome,
      anexo_path: anexoPath,
      registrado_por: user.nome,
    });
    if (error) return { ok: false, error: error.message };
  } else {
    const db = readLocalDb();
    db.atestados.unshift({
      id,
      funcionario_id: func.id,
      secretaria_id: func.secretaria_id,
      data_emissao: input.data_emissao,
      data_inicio: input.data_inicio,
      data_fim: input.data_fim,
      dias: input.dias,
      tipo: input.tipo.trim() || "Atestado Médico",
      status: "recebido",
      observacoes: input.observacoes?.trim() || null,
      anexo_nome: anexoNome,
      anexo_path: null,
      registrado_por: user.nome,
      created_at: new Date().toISOString(),
    });
    writeLocalDb(db);
  }

  if (input.gerar_afastamento) {
    await createMovimentacao(user, {
      funcionario_id: func.id,
      categoria: "afastamento",
      subtipo: `Afastamento por ${input.tipo || "Atestado Médico"}`,
      data_inicio: input.data_inicio,
      data_fim: input.data_fim,
      dias: input.dias,
      status: "em_andamento",
      observacoes: input.observacoes || "Gerado automaticamente no lançamento do atestado.",
    });
  }

  await recordActivityLog({
    user,
    modulo: "atestados",
    acao: "Atestado lançado",
    detalhes: `${func.nome} — ${input.dias} dia(s) (${input.data_inicio} a ${input.data_fim})`,
  });
  return { ok: true };
}

export async function updateAtestadoStatus(
  user: UserAccount,
  id: string,
  status: StatusAtestado
): Promise<{ ok: boolean; error?: string }> {
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    const { error } = await sb.from("atestados").update({ status }).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const db = readLocalDb();
    const target = db.atestados.find((a) => a.id === id);
    if (!target || !canSeeSecretaria(user, target.secretaria_id)) {
      return { ok: false, error: "Atestado não encontrado." };
    }
    target.status = status;
    writeLocalDb(db);
  }

  await recordActivityLog({
    user,
    modulo: "atestados",
    acao: `Status do atestado alterado para ${status.toUpperCase()}`,
    detalhes: `Atestado ID: ${id}`,
  });
  return { ok: true };
}

// ============================================================================
// FÉRIAS, LICENÇAS E AFASTAMENTOS
// ============================================================================
export async function listMovimentacoes(
  user: UserAccount
): Promise<FeriasAfastamento[]> {
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    let q = sb
      .from("ferias_afastamentos")
      .select("*, funcionarios(nome, matricula), secretarias(sigla)")
      .order("data_inicio", { ascending: false });
    if (user.role === "rh_secretaria" && user.secretaria_id) {
      q = q.eq("secretaria_id", user.secretaria_id);
    }
    const { data } = await q;
    return (data || []).map((row: Record<string, unknown>) => {
      const f = Array.isArray(row.funcionarios)
        ? (row.funcionarios[0] as { nome?: string; matricula?: string } | undefined)
        : (row.funcionarios as { nome?: string; matricula?: string } | null);
      const s = Array.isArray(row.secretarias)
        ? (row.secretarias[0] as { sigla?: string } | undefined)
        : (row.secretarias as { sigla?: string } | null);
      return {
        ...(row as unknown as FeriasAfastamento),
        funcionario_nome: f?.nome,
        funcionario_matricula: f?.matricula,
        secretaria_sigla: s?.sigla,
      };
    });
  }

  const db = readLocalDb();
  const fMap = new Map(db.funcionarios.map((f) => [f.id, f]));
  const sMap = new Map(db.secretarias.map((s) => [s.id, s]));
  return db.ferias_afastamentos
    .filter((m) => canSeeSecretaria(user, m.secretaria_id))
    .map((m) => ({
      ...m,
      funcionario_nome: fMap.get(m.funcionario_id)?.nome,
      funcionario_matricula: fMap.get(m.funcionario_id)?.matricula,
      secretaria_sigla: sMap.get(m.secretaria_id)?.sigla,
    }))
    .sort((a, b) => b.data_inicio.localeCompare(a.data_inicio));
}

export async function createMovimentacao(
  user: UserAccount,
  input: {
    funcionario_id: string;
    categoria: CategoriaMovimentacao;
    subtipo: string;
    data_inicio: string;
    data_fim: string;
    dias: number;
    status: StatusMovimentacao;
    observacoes?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const func = await getFuncionarioById(user, input.funcionario_id);
  if (!func) return { ok: false, error: "Servidor não localizado no seu escopo." };

  const id = crypto.randomUUID();
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    const { error } = await sb.from("ferias_afastamentos").insert({
      id,
      funcionario_id: func.id,
      secretaria_id: func.secretaria_id,
      categoria: input.categoria,
      subtipo: input.subtipo.trim(),
      data_inicio: input.data_inicio,
      data_fim: input.data_fim,
      dias: input.dias,
      status: input.status,
      observacoes: input.observacoes?.trim() || null,
      registrado_por: user.nome,
    });
    if (error) return { ok: false, error: error.message };
  } else {
    const db = readLocalDb();
    db.ferias_afastamentos.unshift({
      id,
      funcionario_id: func.id,
      secretaria_id: func.secretaria_id,
      categoria: input.categoria,
      subtipo: input.subtipo.trim(),
      data_inicio: input.data_inicio,
      data_fim: input.data_fim,
      dias: input.dias,
      status: input.status,
      observacoes: input.observacoes?.trim() || null,
      registrado_por: user.nome,
      created_at: new Date().toISOString(),
    });
    writeLocalDb(db);
  }

  // Atualiza automaticamente a situação do servidor se em andamento
  if (input.status === "em_andamento") {
    const nextSit: SituacaoFuncionario =
      input.categoria === "ferias"
        ? "ferias"
        : input.categoria === "licenca"
        ? "licenca"
        : "afastado";
    await updateFuncionarioSituacao(user, func.id, nextSit);
  }

  await recordActivityLog({
    user,
    modulo: "ferias_afastamentos",
    acao: `${input.categoria.toUpperCase()} registrado(a)`,
    detalhes: `${func.nome} — ${input.subtipo} (${input.dias} dias)`,
  });
  return { ok: true };
}

export async function updateMovimentacaoStatus(
  user: UserAccount,
  id: string,
  status: StatusMovimentacao
): Promise<{ ok: boolean; error?: string }> {
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    const { error } = await sb
      .from("ferias_afastamentos")
      .update({ status })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const db = readLocalDb();
    const target = db.ferias_afastamentos.find((m) => m.id === id);
    if (!target || !canSeeSecretaria(user, target.secretaria_id)) {
      return { ok: false, error: "Registro não encontrado." };
    }
    target.status = status;
    writeLocalDb(db);
  }

  await recordActivityLog({
    user,
    modulo: "ferias_afastamentos",
    acao: `Status alterado para ${status}`,
    detalhes: `Registro ID: ${id}`,
  });
  return { ok: true };
}

// ============================================================================
// OCORRÊNCIAS FUNCIONAIS
// ============================================================================
export async function listOcorrencias(user: UserAccount): Promise<Ocorrencia[]> {
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    let q = sb
      .from("ocorrencias")
      .select("*, funcionarios(nome, matricula), secretarias(sigla)")
      .order("data_fato", { ascending: false });
    if (user.role === "rh_secretaria" && user.secretaria_id) {
      q = q.eq("secretaria_id", user.secretaria_id);
    }
    const { data } = await q;
    return (data || []).map((row: Record<string, unknown>) => {
      const f = Array.isArray(row.funcionarios)
        ? (row.funcionarios[0] as { nome?: string; matricula?: string } | undefined)
        : (row.funcionarios as { nome?: string; matricula?: string } | null);
      const s = Array.isArray(row.secretarias)
        ? (row.secretarias[0] as { sigla?: string } | undefined)
        : (row.secretarias as { sigla?: string } | null);
      return {
        ...(row as unknown as Ocorrencia),
        funcionario_nome: f?.nome,
        funcionario_matricula: f?.matricula,
        secretaria_sigla: s?.sigla,
      };
    });
  }

  const db = readLocalDb();
  const fMap = new Map(db.funcionarios.map((f) => [f.id, f]));
  const sMap = new Map(db.secretarias.map((s) => [s.id, s]));
  return db.ocorrencias
    .filter((o) => canSeeSecretaria(user, o.secretaria_id))
    .map((o) => ({
      ...o,
      funcionario_nome: fMap.get(o.funcionario_id)?.nome,
      funcionario_matricula: fMap.get(o.funcionario_id)?.matricula,
      secretaria_sigla: sMap.get(o.secretaria_id)?.sigla,
    }))
    .sort((a, b) => b.data_fato.localeCompare(a.data_fato));
}

export async function createOcorrencia(
  user: UserAccount,
  input: {
    funcionario_id: string;
    tipo: TipoOcorrencia;
    titulo: string;
    descricao: string;
    data_fato: string;
    numero_ato?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const func = await getFuncionarioById(user, input.funcionario_id);
  if (!func) return { ok: false, error: "Servidor não localizado no seu escopo." };

  const id = crypto.randomUUID();
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    const { error } = await sb.from("ocorrencias").insert({
      id,
      funcionario_id: func.id,
      secretaria_id: func.secretaria_id,
      tipo: input.tipo,
      titulo: input.titulo.trim(),
      descricao: input.descricao.trim(),
      data_fato: input.data_fato,
      numero_ato: input.numero_ato?.trim() || null,
      registrado_por: user.nome,
    });
    if (error) return { ok: false, error: error.message };
  } else {
    const db = readLocalDb();
    db.ocorrencias.unshift({
      id,
      funcionario_id: func.id,
      secretaria_id: func.secretaria_id,
      tipo: input.tipo,
      titulo: input.titulo.trim(),
      descricao: input.descricao.trim(),
      data_fato: input.data_fato,
      numero_ato: input.numero_ato?.trim() || null,
      registrado_por: user.nome,
      created_at: new Date().toISOString(),
    });
    writeLocalDb(db);
  }

  await recordActivityLog({
    user,
    modulo: "ocorrencias",
    acao: `Ocorrência registrada (${input.tipo})`,
    detalhes: `${func.nome} — ${input.titulo.trim()}`,
  });
  return { ok: true };
}

// ============================================================================
// ADMINISTRAÇÃO DE USUÁRIOS & LOGS DE SUPORTE (EXCLUSIVO ADMIN)
// ============================================================================
export async function listUsers(user: UserAccount): Promise<UserAccount[]> {
  if (user.role !== "admin") return [];
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    const { data } = await sb
      .from("profiles")
      .select("id, nome, email, role, secretaria_id, ativo, created_at, secretarias(sigla, nome)")
      .order("nome");
    return (data || []).map((row: Record<string, unknown>) => {
      const s = Array.isArray(row.secretarias)
        ? (row.secretarias[0] as { sigla?: string; nome?: string } | undefined)
        : (row.secretarias as { sigla?: string; nome?: string } | null);
      return {
        ...(row as unknown as UserAccount),
        secretaria_sigla: s?.sigla ?? null,
        secretaria_nome: s?.nome ?? null,
      };
    });
  }

  const db = readLocalDb();
  const sMap = new Map(db.secretarias.map((s) => [s.id, s]));
  return db.users.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    role: u.role,
    secretaria_id: u.secretaria_id,
    secretaria_sigla: u.secretaria_id ? sMap.get(u.secretaria_id)?.sigla ?? null : null,
    secretaria_nome: u.secretaria_id ? sMap.get(u.secretaria_id)?.nome ?? null : null,
    ativo: u.ativo,
    created_at: u.created_at,
  }));
}

export async function createLocalOrSupabaseUser(
  actor: UserAccount,
  input: {
    nome: string;
    email: string;
    password: string;
    role: UserRole;
    secretaria_id: string | null;
  }
): Promise<{ ok: boolean; error?: string }> {
  if (actor.role !== "admin") {
    return { ok: false, error: "Apenas o perfil Administrador pode gerenciar usuários." };
  }
  const email = input.email.trim().toLowerCase();
  const secId = input.role === "rh_secretaria" ? input.secretaria_id : null;

  if (input.role === "rh_secretaria" && !secId) {
    return { ok: false, error: "Selecione a secretaria para o perfil RH Secretaria." };
  }

  if (isSupabaseConfigured()) {
    if (!isSupabaseAdminConfigured()) {
      return {
        ok: false,
        error:
          "Configure a variável SUPABASE_SERVICE_ROLE_KEY na Vercel para criar usuários diretamente pelo painel Admin (ou crie o usuário em Authentication -> Users no Supabase).",
      };
    }

    if (!input.password || input.password.length < 6) {
      return {
        ok: false,
        error: "A senha inicial deve conter no mínimo 6 caracteres.",
      };
    }

    const admin = createSupabaseAdmin();
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        nome: input.nome.trim(),
        role: input.role,
        secretaria_id: secId,
      },
    });

    if (createErr || !created.user) {
      return {
        ok: false,
        error: `Falha ao criar conta no Supabase Auth: ${createErr?.message || "erro desconhecido"}`,
      };
    }

    const { error: profErr } = await admin.from("profiles").upsert({
      id: created.user.id,
      nome: input.nome.trim(),
      email,
      role: input.role,
      secretaria_id: secId,
      ativo: true,
    });

    if (profErr) {
      return {
        ok: false,
        error: `Usuário criado no Auth, mas houve erro ao salvar perfil: ${profErr.message}`,
      };
    }

    await recordActivityLog({
      user: actor,
      modulo: "admin",
      acao: "Usuário criado no Supabase",
      detalhes: `${input.nome.trim()} (${email}) — Perfil: ${input.role}`,
    });
    return { ok: true };
  }

  const db = readLocalDb();
  if (db.users.some((u) => u.email === email)) {
    return { ok: false, error: "Já existe um usuário cadastrado com este e-mail." };
  }

  db.users.push({
    id: crypto.randomUUID(),
    nome: input.nome.trim(),
    email,
    password: input.password || "123456",
    role: input.role,
    secretaria_id: secId,
    ativo: true,
    created_at: new Date().toISOString(),
  });
  writeLocalDb(db);

  await recordActivityLog({
    user: actor,
    modulo: "admin",
    acao: "Usuário criado",
    detalhes: `${input.nome.trim()} (${email}) — Perfil: ${input.role}`,
  });
  return { ok: true };
}

export async function toggleUserActive(
  actor: UserAccount,
  targetId: string,
  ativo: boolean
): Promise<{ ok: boolean; error?: string }> {
  if (actor.role !== "admin") {
    return { ok: false, error: "Apenas o Administrador pode alterar contas." };
  }
  if (actor.id === targetId) {
    return { ok: false, error: "Você não pode desativar sua própria conta." };
  }
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    const { error } = await sb.from("profiles").update({ ativo }).eq("id", targetId);
    if (error) return { ok: false, error: error.message };
  } else {
    const db = readLocalDb();
    const u = db.users.find((x) => x.id === targetId);
    if (!u) return { ok: false, error: "Usuário não encontrado." };
    u.ativo = ativo;
    writeLocalDb(db);
  }
  await recordActivityLog({
    user: actor,
    modulo: "admin",
    acao: ativo ? "Usuário reativado" : "Usuário desativado",
    detalhes: `ID: ${targetId}`,
    nivel: ativo ? "info" : "alerta",
  });
  return { ok: true };
}

export async function listActivityLogs(user: UserAccount): Promise<ActivityLog[]> {
  if (user.role !== "admin") return [];
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    const { data } = await sb
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    return (data || []) as ActivityLog[];
  }
  return readLocalDb().activity_logs;
}

// ============================================================================
// PONTO / FREQUÊNCIA MENSAL & FERIADOS MUNICIPAIS
// ============================================================================
export async function listFeriadosMunicipais(): Promise<FeriadoMunicipal[]> {
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    const { data } = await sb
      .from("feriados_municipais")
      .select("*")
      .order("data");
    return (data || []) as FeriadoMunicipal[];
  }
  return [...readLocalDb().feriados_municipais].sort((a, b) =>
    a.data.localeCompare(b.data)
  );
}

export async function createFeriadoMunicipal(
  user: UserAccount,
  input: {
    data: string;
    descricao: string;
    tipo: TipoFeriadoMunicipal;
    recorrente_anual: boolean;
  }
): Promise<{ ok: boolean; error?: string }> {
  if (user.role !== "admin" && user.role !== "rh_geral") {
    return {
      ok: false,
      error: "Apenas RH Geral ou Administrador pode cadastrar feriados municipais.",
    };
  }
  const desc = input.descricao.trim();
  if (!input.data || !desc) {
    return { ok: false, error: "Informe a data e a descrição do feriado." };
  }

  const id = crypto.randomUUID();
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    const { error } = await sb.from("feriados_municipais").insert({
      id,
      data: input.data,
      descricao: desc,
      tipo: input.tipo,
      recorrente_anual: input.recorrente_anual,
      registrado_por: user.nome,
    });
    if (error) return { ok: false, error: error.message };
  } else {
    const db = readLocalDb();
    db.feriados_municipais.push({
      id,
      data: input.data,
      descricao: desc,
      tipo: input.tipo,
      recorrente_anual: input.recorrente_anual,
      registrado_por: user.nome,
      created_at: new Date().toISOString(),
    });
    writeLocalDb(db);
  }

  await recordActivityLog({
    user,
    modulo: "ponto",
    acao: "Feriado municipal cadastrado",
    detalhes: `${input.data} — ${desc} (${input.tipo})`,
  });
  return { ok: true };
}

export async function deleteFeriadoMunicipal(
  user: UserAccount,
  id: string
): Promise<{ ok: boolean; error?: string }> {
  if (user.role !== "admin" && user.role !== "rh_geral") {
    return {
      ok: false,
      error: "Apenas RH Geral ou Administrador pode remover feriados municipais.",
    };
  }
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    const { error } = await sb.from("feriados_municipais").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const db = readLocalDb();
    db.feriados_municipais = db.feriados_municipais.filter((f) => f.id !== id);
    writeLocalDb(db);
  }

  await recordActivityLog({
    user,
    modulo: "ponto",
    acao: "Feriado municipal removido",
    detalhes: `ID: ${id}`,
  });
  return { ok: true };
}

export async function listFrequenciaMensal(
  user: UserAccount,
  competencia?: string
): Promise<FrequenciaMensal[]> {
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    let q = sb
      .from("frequencia_mensal")
      .select("*, funcionarios(nome, matricula, cargo), secretarias(sigla)")
      .order("competencia", { ascending: false });
    if (user.role === "rh_secretaria" && user.secretaria_id) {
      q = q.eq("secretaria_id", user.secretaria_id);
    }
    if (competencia) {
      q = q.eq("competencia", competencia);
    }
    const { data } = await q;
    return (data || []).map((row: Record<string, unknown>) => {
      const f = Array.isArray(row.funcionarios)
        ? (row.funcionarios[0] as { nome?: string; matricula?: string; cargo?: string } | undefined)
        : (row.funcionarios as { nome?: string; matricula?: string; cargo?: string } | null);
      const s = Array.isArray(row.secretarias)
        ? (row.secretarias[0] as { sigla?: string } | undefined)
        : (row.secretarias as { sigla?: string } | null);
      return {
        ...(row as unknown as FrequenciaMensal),
        faltas_injustificadas: Number(row.faltas_injustificadas || 0),
        faltas_justificadas: Number(row.faltas_justificadas || 0),
        abonos: Number(row.abonos || 0),
        horas_extras_50: Number(row.horas_extras_50 || 0),
        horas_extras_100: Number(row.horas_extras_100 || 0),
        adicional_noturno: Number(row.adicional_noturno || 0),
        plantoes: Number(row.plantoes || 0),
        funcionario_nome: f?.nome,
        funcionario_matricula: f?.matricula,
        funcionario_cargo: f?.cargo,
        secretaria_sigla: s?.sigla,
      };
    });
  }

  const db = readLocalDb();
  const fMap = new Map(db.funcionarios.map((f) => [f.id, f]));
  const sMap = new Map(db.secretarias.map((s) => [s.id, s]));
  return db.frequencia_mensal
    .filter(
      (r) =>
        canSeeSecretaria(user, r.secretaria_id) &&
        (!competencia || r.competencia === competencia)
    )
    .map((r) => ({
      ...r,
      funcionario_nome: fMap.get(r.funcionario_id)?.nome,
      funcionario_matricula: fMap.get(r.funcionario_id)?.matricula,
      funcionario_cargo: fMap.get(r.funcionario_id)?.cargo,
      secretaria_sigla: sMap.get(r.secretaria_id)?.sigla,
    }));
}

export async function listFrequenciaFechamentos(
  user: UserAccount
): Promise<FrequenciaFechamento[]> {
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    let q = sb
      .from("frequencia_fechamentos")
      .select("*, secretarias(sigla)")
      .order("competencia", { ascending: false });
    if (user.role === "rh_secretaria" && user.secretaria_id) {
      q = q.eq("secretaria_id", user.secretaria_id);
    }
    const { data } = await q;
    return (data || []).map((row: Record<string, unknown>) => {
      const s = Array.isArray(row.secretarias)
        ? (row.secretarias[0] as { sigla?: string } | undefined)
        : (row.secretarias as { sigla?: string } | null);
      return {
        ...(row as unknown as FrequenciaFechamento),
        secretaria_sigla: s?.sigla,
      };
    });
  }

  const db = readLocalDb();
  const sMap = new Map(db.secretarias.map((s) => [s.id, s]));
  return db.frequencia_fechamentos
    .filter((f) => canSeeSecretaria(user, f.secretaria_id))
    .map((f) => ({
      ...f,
      secretaria_sigla: sMap.get(f.secretaria_id)?.sigla,
    }));
}

export async function upsertFrequenciaMensal(
  user: UserAccount,
  input: {
    funcionario_id: string;
    competencia: string;
    faltas_injustificadas: number;
    faltas_justificadas: number;
    abonos: number;
    horas_extras_50: number;
    horas_extras_100: number;
    adicional_noturno: number;
    plantoes: number;
    outros_adicionais?: string;
    observacoes?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  if (!/^\d{4}-\d{2}$/.test(input.competencia)) {
    return { ok: false, error: "Competência inválida." };
  }
  const func = await getFuncionarioById(user, input.funcionario_id);
  if (!func) {
    return { ok: false, error: "Servidor não localizado no seu escopo." };
  }

  const fechamentos = await listFrequenciaFechamentos(user);
  const fech = fechamentos.find(
    (f) => f.secretaria_id === func.secretaria_id && f.competencia === input.competencia
  );
  if (fech && fech.status !== "aberto" && user.role === "rh_secretaria") {
    return {
      ok: false,
      error: "A frequência desta competência já foi fechada. Solicite ao RH Geral a reabertura caso precise alterar.",
    };
  }

  const payload = {
    funcionario_id: func.id,
    secretaria_id: func.secretaria_id,
    competencia: input.competencia,
    faltas_injustificadas: Math.max(0, Math.trunc(input.faltas_injustificadas || 0)),
    faltas_justificadas: Math.max(0, Math.trunc(input.faltas_justificadas || 0)),
    abonos: Math.max(0, Math.trunc(input.abonos || 0)),
    horas_extras_50: Math.max(0, Number(input.horas_extras_50 || 0)),
    horas_extras_100: Math.max(0, Number(input.horas_extras_100 || 0)),
    adicional_noturno: Math.max(0, Number(input.adicional_noturno || 0)),
    plantoes: Math.max(0, Math.trunc(input.plantoes || 0)),
    outros_adicionais: input.outros_adicionais?.trim() || null,
    observacoes: input.observacoes?.trim() || null,
    registrado_por: user.nome,
    updated_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    const { error } = await sb
      .from("frequencia_mensal")
      .upsert(payload, { onConflict: "funcionario_id,competencia" });
    if (error) return { ok: false, error: error.message };
  } else {
    const db = readLocalDb();
    const idx = db.frequencia_mensal.findIndex(
      (r) =>
        r.funcionario_id === func.id && r.competencia === input.competencia
    );
    if (idx >= 0) {
      db.frequencia_mensal[idx] = {
        ...db.frequencia_mensal[idx],
        ...payload,
      };
    } else {
      db.frequencia_mensal.push({
        id: crypto.randomUUID(),
        ...payload,
        created_at: payload.updated_at,
      });
    }
    writeLocalDb(db);
  }

  await recordActivityLog({
    user,
    modulo: "ponto",
    acao: `Frequência salva (${input.competencia})`,
    detalhes: `${func.nome} — Faltas: ${payload.faltas_injustificadas}I/${payload.faltas_justificadas}J, Abonos: ${payload.abonos}, HE50: ${payload.horas_extras_50}h, HE100: ${payload.horas_extras_100}h`,
  });
  return { ok: true };
}

export async function updateFrequenciaFechamento(
  user: UserAccount,
  secretariaId: string,
  competencia: string,
  nextStatus: StatusFechamentoFrequencia
): Promise<{ ok: boolean; error?: string }> {
  const targetSec =
    user.role === "rh_secretaria" && user.secretaria_id
      ? user.secretaria_id
      : secretariaId;

  if (!targetSec || !/^\d{4}-\d{2}$/.test(competencia)) {
    return { ok: false, error: "Secretaria ou competência inválida." };
  }
  if (!canSeeSecretaria(user, targetSec)) {
    return { ok: false, error: "Sem permissão para esta secretaria." };
  }
  if (user.role === "rh_secretaria" && nextStatus !== "fechado_secretaria") {
    return {
      ok: false,
      error: "Apenas RH Geral ou Administrador pode conferir ou reabrir uma competência.",
    };
  }

  const now = new Date().toISOString();
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    const { data: existing } = await sb
      .from("frequencia_fechamentos")
      .select("*")
      .eq("secretaria_id", targetSec)
      .eq("competencia", competencia)
      .maybeSingle();

    const record = {
      secretaria_id: targetSec,
      competencia,
      status: nextStatus,
      fechado_por:
        nextStatus === "fechado_secretaria"
          ? user.nome
          : existing?.fechado_por || (nextStatus === "conferido_rh" ? user.nome : null),
      fechado_em:
        nextStatus === "fechado_secretaria"
          ? now
          : existing?.fechado_em || (nextStatus === "conferido_rh" ? now : null),
      conferido_por: nextStatus === "conferido_rh" ? user.nome : null,
      conferido_em: nextStatus === "conferido_rh" ? now : null,
    };

    const { error } = await sb
      .from("frequencia_fechamentos")
      .upsert(record, { onConflict: "secretaria_id,competencia" });
    if (error) return { ok: false, error: error.message };
  } else {
    const db = readLocalDb();
    const idx = db.frequencia_fechamentos.findIndex(
      (f) => f.secretaria_id === targetSec && f.competencia === competencia
    );
    const existing = idx >= 0 ? db.frequencia_fechamentos[idx] : null;
    const nextRow: FrequenciaFechamento = {
      id: existing?.id || crypto.randomUUID(),
      secretaria_id: targetSec,
      competencia,
      status: nextStatus,
      fechado_por:
        nextStatus === "fechado_secretaria"
          ? user.nome
          : existing?.fechado_por || (nextStatus === "conferido_rh" ? user.nome : null),
      fechado_em:
        nextStatus === "fechado_secretaria"
          ? now
          : existing?.fechado_em || (nextStatus === "conferido_rh" ? now : null),
      conferido_por: nextStatus === "conferido_rh" ? user.nome : null,
      conferido_em: nextStatus === "conferido_rh" ? now : null,
      observacao: existing?.observacao || null,
      created_at: existing?.created_at || now,
    };
    if (idx >= 0) db.frequencia_fechamentos[idx] = nextRow;
    else db.frequencia_fechamentos.push(nextRow);
    writeLocalDb(db);
  }

  await recordActivityLog({
    user,
    modulo: "ponto",
    acao: `Competência ${competencia} marcada como ${nextStatus}`,
    detalhes: `Secretaria ID: ${targetSec}`,
  });
  return { ok: true };
}
