import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServer, isSupabaseConfigured } from "./supabase";
import { readLocalDb } from "./local-store";
import type { UserAccount, UserRole } from "@/types/rh";

export const LOCAL_SESSION_COOKIE = "rhbox_simples_session";

/**
 * Memoizado por requisição via React.cache() — elimina consultas duplicadas
 * entre Sidebar, Header e Pages (navegação muito mais rápida!).
 */
export const getCurrentUser = cache(async (): Promise<UserAccount | null> => {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, nome, email, role, secretaria_id, ativo, created_at, secretarias(sigla, nome)")
      .eq("id", user.id)
      .single();

    if (!profile || !profile.ativo) return null;
    const sec = Array.isArray(profile.secretarias)
      ? profile.secretarias[0]
      : profile.secretarias;

    return {
      id: profile.id,
      nome: profile.nome,
      email: profile.email,
      role: profile.role as UserRole,
      secretaria_id: profile.secretaria_id,
      secretaria_sigla: sec?.sigla ?? null,
      secretaria_nome: sec?.nome ?? null,
      ativo: profile.ativo,
      created_at: profile.created_at,
    };
  }

  // Modo Local Interativo
  const cookieStore = await cookies();
  const userId = cookieStore.get(LOCAL_SESSION_COOKIE)?.value;
  if (!userId) return null;

  const db = readLocalDb();
  const found = db.users.find((u) => u.id === userId && u.ativo);
  if (!found) return null;

  const sec = found.secretaria_id
    ? db.secretarias.find((s) => s.id === found.secretaria_id)
    : null;

  return {
    id: found.id,
    nome: found.nome,
    email: found.email,
    role: found.role,
    secretaria_id: found.secretaria_id,
    secretaria_sigla: sec?.sigla ?? null,
    secretaria_nome: sec?.nome ?? null,
    ativo: found.ativo,
    created_at: found.created_at,
  };
});

export async function requireUser(allowedRoles?: UserRole[]): Promise<UserAccount> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    redirect("/");
  }
  return user;
}
