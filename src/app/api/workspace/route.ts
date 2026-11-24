import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { loadWorkspaceSnapshot } from "@/lib/workspace";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const snapshot = await loadWorkspaceSnapshot(user);
  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });
}
