import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return new NextResponse(
      "Anexo em modo demonstração local. Conecte o Supabase para baixar PDFs/imagens reais do Storage.",
      { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  const { id } = await context.params;
  const sb = await createSupabaseServer();

  // RLS garante que rh_secretaria só acessa atestados da própria pasta
  const { data: atestado, error } = await sb
    .from("atestados")
    .select("id, anexo_path, anexo_nome")
    .eq("id", id)
    .single();

  if (error || !atestado || !atestado.anexo_path) {
    return NextResponse.json(
      { error: "Anexo não encontrado ou sem permissão." },
      { status: 404 }
    );
  }

  const { data: signed, error: signErr } = await sb.storage
    .from("atestados")
    .createSignedUrl(atestado.anexo_path, 60);

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json(
      { error: "Não foi possível gerar link seguro do anexo." },
      { status: 500 }
    );
  }

  return NextResponse.redirect(signed.signedUrl);
}
