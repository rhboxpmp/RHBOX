"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { readLocalDb } from "@/lib/local-store";
import { LOCAL_SESSION_COOKIE, requireUser } from "@/lib/auth";
import {
  createAtestado,
  createFuncionario,
  createLocalOrSupabaseUser,
  createMovimentacao,
  createOcorrencia,
  createSecretaria,
  recordActivityLog,
  toggleSecretaria,
  toggleUserActive,
  updateAtestadoStatus,
  updateFuncionarioSituacao,
  updateMovimentacaoStatus,
} from "@/lib/db";
import type {
  CategoriaMovimentacao,
  SituacaoFuncionario,
  StatusAtestado,
  StatusMovimentacao,
  TipoOcorrencia,
  UserRole,
  VinculoTipo,
} from "@/types/rh";

export async function loginAction(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Informe seu e-mail e senha." };
  }

  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return { error: "E-mail ou senha inválidos." };
    }

    const { data: profile } = await sb
      .from("profiles")
      .select("nome, role, ativo")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profile && !profile.ativo) {
      await sb.auth.signOut();
      return { error: "Esta conta está desativada. Contate o Administrador." };
    }

    await recordActivityLog({
      user: {
        nome: profile?.nome || data.user.email || "Usuário",
        role: (profile?.role as UserRole) || "rh_secretaria",
      },
      modulo: "auth",
      acao: "Login realizado (Supabase)",
      detalhes: `Acesso via ${data.user.email}`,
    });

    redirect("/");
  }

  const db = readLocalDb();
  const found = db.users.find(
    (u) => u.email === email && u.password === password
  );
  if (!found) {
    return { error: "Credenciais inválidas. No modo local use um dos 3 perfis abaixo (senha: 123456)." };
  }
  if (!found.ativo) {
    return { error: "Esta conta está desativada. Contate o Administrador." };
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCAL_SESSION_COOKIE, found.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  await recordActivityLog({
    user: { nome: found.nome, role: found.role },
    modulo: "auth",
    acao: "Login realizado",
    detalhes: `Acesso via ${found.email}`,
  });

  redirect("/");
}

export async function logoutAction() {
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseServer();
    await sb.auth.signOut();
  } else {
    const cookieStore = await cookies();
    cookieStore.delete(LOCAL_SESSION_COOKIE);
  }
  redirect("/login");
}

export async function createSecretariaAction(formData: FormData) {
  const user = await requireUser(["admin", "rh_geral"]);
  const res = await createSecretaria(user, {
    nome: String(formData.get("nome") || ""),
    sigla: String(formData.get("sigla") || ""),
    responsavel: String(formData.get("responsavel") || ""),
  });
  if (res.ok) revalidatePath("/secretarias");
  return res;
}

export async function toggleSecretariaAction(id: string, ativa: boolean) {
  const user = await requireUser(["admin", "rh_geral"]);
  const res = await toggleSecretaria(user, id, ativa);
  if (res.ok) revalidatePath("/secretarias");
  return res;
}

export async function createFuncionarioAction(formData: FormData) {
  const user = await requireUser();
  const res = await createFuncionario(user, {
    nome: String(formData.get("nome") || ""),
    cpf: String(formData.get("cpf") || ""),
    matricula: String(formData.get("matricula") || ""),
    cargo: String(formData.get("cargo") || ""),
    vinculo: (formData.get("vinculo") as VinculoTipo) || "efetivo",
    secretaria_id: String(formData.get("secretaria_id") || ""),
    data_admissao: String(formData.get("data_admissao") || ""),
    telefone: String(formData.get("telefone") || ""),
    email: String(formData.get("email") || ""),
    observacoes: String(formData.get("observacoes") || ""),
  });
  if (res.ok) {
    revalidatePath("/funcionarios");
    revalidatePath("/");
  }
  return res;
}

export async function updateFuncionarioSituacaoAction(
  id: string,
  situacao: SituacaoFuncionario
) {
  const user = await requireUser();
  const res = await updateFuncionarioSituacao(user, id, situacao);
  if (res.ok) {
    revalidatePath("/funcionarios");
    revalidatePath(`/funcionarios/${id}`);
    revalidatePath("/");
  }
  return res;
}

export async function createAtestadoAction(formData: FormData) {
  const user = await requireUser();
  const inicio = String(formData.get("data_inicio") || "");
  const fim = String(formData.get("data_fim") || "");
  const dias = Math.max(1, Number(formData.get("dias") || 1));
  const file = formData.get("anexo") as File | null;
  const anexoNome = file && file.size > 0 ? file.name : null;

  if (!inicio || !fim || new Date(inicio) > new Date(fim)) {
    return { ok: false, error: "Informe datas válidas (início não pode ser maior que fim)." };
  }

  const res = await createAtestado(user, {
    funcionario_id: String(formData.get("funcionario_id") || ""),
    data_emissao: String(formData.get("data_emissao") || inicio),
    data_inicio: inicio,
    data_fim: fim,
    dias,
    tipo: String(formData.get("tipo") || "Atestado Médico"),
    observacoes: String(formData.get("observacoes") || ""),
    anexo_nome: anexoNome,
    anexo_file: file && file.size > 0 ? file : null,
    gerar_afastamento: formData.get("gerar_afastamento") === "on",
  });

  if (res.ok) {
    revalidatePath("/atestados");
    revalidatePath("/ferias-afastamentos");
    revalidatePath("/");
  }
  return res;
}

export async function updateAtestadoStatusAction(
  id: string,
  status: StatusAtestado
) {
  const user = await requireUser();
  const res = await updateAtestadoStatus(user, id, status);
  if (res.ok) {
    revalidatePath("/atestados");
    revalidatePath("/");
  }
  return res;
}

export async function createMovimentacaoAction(formData: FormData) {
  const user = await requireUser();
  const inicio = String(formData.get("data_inicio") || "");
  const fim = String(formData.get("data_fim") || "");
  const dias = Math.max(1, Number(formData.get("dias") || 1));

  if (!inicio || !fim || new Date(inicio) > new Date(fim)) {
    return { ok: false, error: "Período inválido." };
  }

  const res = await createMovimentacao(user, {
    funcionario_id: String(formData.get("funcionario_id") || ""),
    categoria: (formData.get("categoria") as CategoriaMovimentacao) || "ferias",
    subtipo: String(formData.get("subtipo") || "Férias Regulamentares"),
    data_inicio: inicio,
    data_fim: fim,
    dias,
    status: (formData.get("status") as StatusMovimentacao) || "programado",
    observacoes: String(formData.get("observacoes") || ""),
  });

  if (res.ok) {
    revalidatePath("/ferias-afastamentos");
    revalidatePath("/funcionarios");
    revalidatePath("/");
  }
  return res;
}

export async function updateMovimentacaoStatusAction(
  id: string,
  status: StatusMovimentacao
) {
  const user = await requireUser();
  const res = await updateMovimentacaoStatus(user, id, status);
  if (res.ok) {
    revalidatePath("/ferias-afastamentos");
    revalidatePath("/");
  }
  return res;
}

export async function createOcorrenciaAction(formData: FormData) {
  const user = await requireUser();
  const res = await createOcorrencia(user, {
    funcionario_id: String(formData.get("funcionario_id") || ""),
    tipo: (formData.get("tipo") as TipoOcorrencia) || "outro",
    titulo: String(formData.get("titulo") || ""),
    descricao: String(formData.get("descricao") || ""),
    data_fato: String(formData.get("data_fato") || ""),
    numero_ato: String(formData.get("numero_ato") || ""),
  });

  if (res.ok) {
    revalidatePath("/ocorrencias");
    revalidatePath("/");
  }
  return res;
}

export async function createUserAction(formData: FormData) {
  const user = await requireUser(["admin"]);
  const res = await createLocalOrSupabaseUser(user, {
    nome: String(formData.get("nome") || ""),
    email: String(formData.get("email") || ""),
    password: String(formData.get("password") || "123456"),
    role: (formData.get("role") as UserRole) || "rh_secretaria",
    secretaria_id: (formData.get("secretaria_id") as string) || null,
  });
  if (res.ok) revalidatePath("/admin");
  return res;
}

export async function toggleUserActiveAction(id: string, ativo: boolean) {
  const user = await requireUser(["admin"]);
  const res = await toggleUserActive(user, id, ativo);
  if (res.ok) revalidatePath("/admin");
  return res;
}
