"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { loginAction } from "@/app/actions";
import { Lock, Mail, ShieldAlert, FlaskConical } from "lucide-react";

const LOCAL_PROFILES = [
  {
    label: "Admin (Controle Total + Logs)",
    email: "admin@planalto.local",
  },
  {
    label: "RH Geral (Todas as Secretarias)",
    email: "rh@planalto.local",
  },
  {
    label: "RH Secretaria (Somente SMS)",
    email: "secretaria@planalto.local",
  },
];

const SHOW_LOCAL_DEMO = !process.env.NEXT_PUBLIC_SUPABASE_URL;

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);
  const [email, setEmail] = useState(SHOW_LOCAL_DEMO ? "admin@planalto.local" : "");
  const [password, setPassword] = useState(SHOW_LOCAL_DEMO ? "123456" : "");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#041A47] via-[#0B2B6B] to-[#0047B3] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
        {/* Cabeçalho com a Logo Oficial RHBOX + Slogan em destaque */}
        <div className="bg-white px-6 pt-8 pb-6 border-b border-slate-100 text-center">
          <div className="mx-auto w-full">
            <Image
              src="/brand/rhbox-logo-slogan.jpg"
              alt="RHBOX — Gestão de servidores com organização, valorização e transparência"
              width={800}
              height={280}
              priority
              className="w-full h-auto object-contain scale-[1.03]"
            />
          </div>
        </div>

        <div className="p-6 sm:p-7">
          {state?.error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"
            >
              <ShieldAlert size={16} className="shrink-0 mt-0.5 text-red-600" />
              <span>{state.error}</span>
            </div>
          )}

          <form action={formAction} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#041A47] mb-1">
                E-mail
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@rhbox.com.br"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-[#0047B3] focus:ring-2 focus:ring-[#0047B3]/25 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#041A47] mb-1">
                Senha
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-[#0047B3] focus:ring-2 focus:ring-[#0047B3]/25 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center py-2.5 px-4 rounded-lg bg-gradient-to-r from-[#041A47] to-[#0047B3] hover:opacity-95 text-white text-sm font-semibold shadow-sm disabled:opacity-60 transition-opacity cursor-pointer"
            >
              <span>{isPending ? "Iniciando..." : "Iniciar"}</span>
            </button>
          </form>

          {SHOW_LOCAL_DEMO && (
            <div className="mt-5 rounded-xl border border-blue-100 bg-[#F4F7FC] p-3.5 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-[#041A47] mb-2">
                <FlaskConical size={14} className="text-[#0047B3]" />
                <span>Acesso Rápido Local (Senha: 123456)</span>
              </div>
              <div className="space-y-1.5">
                {LOCAL_PROFILES.map((p) => (
                  <button
                    key={p.email}
                    type="button"
                    onClick={() => {
                      setEmail(p.email);
                      setPassword("123456");
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                      email === p.email
                        ? "bg-[#041A47] text-white border-[#041A47]"
                        : "bg-white text-[#1E293B] border-blue-100 hover:bg-blue-50"
                    }`}
                  >
                    <div className="font-semibold text-[11px]">{p.label}</div>
                    <div
                      className={`text-[10px] font-mono ${
                        email === p.email ? "text-blue-200" : "text-slate-500"
                      }`}
                    >
                      {p.email}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
