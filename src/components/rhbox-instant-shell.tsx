"use client";

import { useTransition } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Stethoscope,
  CalendarDays,
  ClipboardList,
  FileBarChart2,
  ShieldCheck,
  LogOut,
  Plus,
  ArrowLeft,
} from "lucide-react";
import { logoutAction, updateFuncionarioSituacaoAction } from "@/app/actions";
import type { WorkspaceSnapshot } from "@/lib/workspace";
import {
  OCORRENCIA_LABELS,
  ROLE_LABELS,
  SITUACAO_LABELS,
  VINCULO_LABELS,
  type SituacaoFuncionario,
} from "@/types/rh";
import {
  useWorkspace,
  WorkspaceProvider,
  type SectionId,
} from "./workspace-context";
import { FuncionariosClient } from "./funcionarios-client";
import { SecretariasClient } from "./secretarias-client";
import { AtestadosClient } from "./atestados-client";
import { MovimentacoesClient } from "./movimentacoes-client";
import { OcorrenciasClient } from "./ocorrencias-client";
import { RelatoriosClient } from "./relatorios-client";
import { AdminClient } from "./admin-client";

interface NavItem {
  section: SectionId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { section: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { section: "funcionarios", label: "Funcionários", icon: Users },
  { section: "secretarias", label: "Secretarias", icon: Building2 },
  { section: "atestados", label: "Atestados", icon: Stethoscope },
  { section: "ferias", label: "Férias e Afastamentos", icon: CalendarDays },
  { section: "ocorrencias", label: "Ocorrências", icon: ClipboardList },
  { section: "relatorios", label: "Relatórios", icon: FileBarChart2 },
  { section: "admin", label: "Admin & Logs", icon: ShieldCheck, adminOnly: true },
];

function InstantWorkspaceInner() {
  const { data, route, navigate, refreshWorkspace } = useWorkspace();
  const {
    user,
    isLocalMode,
    secretarias,
    secretariaResponsaveis,
    funcionarios,
    atestados,
    movimentacoes,
    ocorrencias,
    users,
    logs,
  } = data;

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || user.role === "admin"
  );

  const countsBySec: Record<string, number> = {};
  for (const f of funcionarios) {
    countsBySec[f.secretaria_id] = (countsBySec[f.secretaria_id] || 0) + 1;
  }

  const activeNavLabel =
    route.section === "ficha"
      ? "Ficha do Servidor"
      : visibleItems.find((i) => i.section === route.section)?.label || "RHBOX";

  return (
    <div className="flex min-h-screen bg-[#F4F7FC]">
      {/* Sidebar Instantânea com Identidade Visual Oficial RHBOX */}
      <aside className="w-64 shrink-0 bg-[#041A47] text-white flex flex-col justify-between shadow-lg">
        <div>
          <div className="p-3.5 border-b border-white/10">
            <div className="bg-white rounded-xl px-3 py-3.5 shadow-sm flex items-center justify-center">
              <Image
                src="/brand/rhbox-logo.png"
                alt="RHBOX"
                width={220}
                height={70}
                priority
                className="w-full max-w-[205px] h-auto object-contain"
              />
            </div>
          </div>

          <nav className="p-3 space-y-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active =
                route.section === item.section ||
                (route.section === "ficha" && item.section === "funcionarios");

              return (
                <button
                  key={item.section}
                  type="button"
                  onClick={() => navigate({ section: item.section })}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left ${
                    active
                      ? "bg-[#0047B3] text-white shadow-sm"
                      : "text-blue-100/85 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon size={17} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="rounded-lg bg-white/8 p-3">
            <div className="text-xs font-bold truncate">{user.nome}</div>
            <div className="text-[11px] text-blue-300 font-medium mt-0.5">
              {ROLE_LABELS[user.role]}
              {user.secretaria_sigla ? ` · ${user.secretaria_sigla}` : ""}
            </div>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              <LogOut size={14} />
              <span>Sair</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Área Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {isLocalMode && (
          <div className="bg-amber-400/90 text-slate-950 px-4 py-1.5 text-center text-[11px] font-semibold">
            MODO LOCAL INTERATIVO (dados salvos em .data/rhbox-local.json) — Configure .env.local para usar seu Supabase gratuito.
          </div>
        )}

        <header className="h-14 bg-white border-b border-[#E2E8F0] px-6 flex items-center justify-between">
          <div className="text-sm font-bold text-[#041A47]">
            {activeNavLabel}
          </div>
          <div className="flex items-center gap-3 text-xs text-[#667085]">
            {user.secretaria_nome && (
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-[#0047B3] font-semibold border border-blue-200">
                Escopo: {user.secretaria_sigla}
              </span>
            )}
            <span className="hidden sm:inline">{user.email}</span>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {route.section === "dashboard" && (
            <DashboardInstantView
              user={user}
              secretarias={secretarias}
              funcionarios={funcionarios}
              atestados={atestados}
              movimentacoes={movimentacoes}
              ocorrencias={ocorrencias}
              onNavigate={navigate}
            />
          )}

          {route.section === "funcionarios" && (
            <FuncionariosClient
              key={route.openNew ? "func-new" : "func-list"}
              funcionarios={funcionarios}
              secretarias={secretarias}
              user={user}
              openInitially={Boolean(route.openNew)}
              onOpenFicha={(id) => navigate({ section: "ficha", fichaId: id })}
              onMutated={refreshWorkspace}
            />
          )}

          {route.section === "ficha" && (
            <FichaInstantView
              fichaId={route.fichaId || ""}
              funcionarios={funcionarios}
              atestados={atestados}
              movimentacoes={movimentacoes}
              ocorrencias={ocorrencias}
              onBack={() => navigate({ section: "funcionarios" })}
              onMutated={refreshWorkspace}
            />
          )}

          {route.section === "secretarias" && (
            <SecretariasClient
              secretarias={secretarias}
              responsaveis={secretariaResponsaveis}
              countsBySec={countsBySec}
              userRole={user.role}
              onOpenAdmin={
                user.role === "admin"
                  ? () => navigate({ section: "admin" })
                  : undefined
              }
              onMutated={refreshWorkspace}
            />
          )}

          {route.section === "atestados" && (
            <AtestadosClient
              key={route.openNew ? "at-new" : "at-list"}
              atestados={atestados}
              funcionarios={funcionarios}
              openInitially={Boolean(route.openNew)}
              onMutated={refreshWorkspace}
            />
          )}

          {route.section === "ferias" && (
            <MovimentacoesClient
              key={route.openNew ? "fer-new" : "fer-list"}
              itens={movimentacoes}
              funcionarios={funcionarios}
              openInitially={Boolean(route.openNew)}
              onMutated={refreshWorkspace}
            />
          )}

          {route.section === "ocorrencias" && (
            <OcorrenciasClient
              ocorrencias={ocorrencias}
              funcionarios={funcionarios}
              onMutated={refreshWorkspace}
            />
          )}

          {route.section === "relatorios" && (
            <RelatoriosClient secretarias={secretarias} user={user} />
          )}

          {route.section === "admin" && user.role === "admin" && (
            <AdminClient
              users={users}
              logs={logs}
              secretarias={secretarias}
              currentUserId={user.id}
              isSupabase={!isLocalMode}
              onMutated={refreshWorkspace}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function DashboardInstantView({
  user,
  secretarias,
  funcionarios,
  atestados,
  movimentacoes,
  ocorrencias,
  onNavigate,
}: {
  user: WorkspaceSnapshot["user"];
  secretarias: WorkspaceSnapshot["secretarias"];
  funcionarios: WorkspaceSnapshot["funcionarios"];
  atestados: WorkspaceSnapshot["atestados"];
  movimentacoes: WorkspaceSnapshot["movimentacoes"];
  ocorrencias: WorkspaceSnapshot["ocorrencias"];
  onNavigate: (next: { section: SectionId; openNew?: boolean }) => void;
}) {
  const ativos = funcionarios.filter((f) => f.situacao !== "desligado").length;
  const emFeriasOuAfast = movimentacoes.filter(
    (m) => m.status === "em_andamento"
  ).length;
  const atestadosPendentes = atestados.filter(
    (a) => a.status === "recebido"
  ).length;

  const porSecretaria = secretarias
    .filter((s) => s.ativa)
    .map((s) => ({
      ...s,
      total: funcionarios.filter((f) => f.secretaria_id === s.id).length,
    }))
    .filter((s) => user.role !== "rh_secretaria" || s.id === user.secretaria_id);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#041A47] to-[#0047B3] text-white rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div>
          <h1 className="text-xl font-bold">Bem-vindo, {user.nome}</h1>
          <p className="text-xs text-blue-100 mt-1">
            Gestão de servidores com organização, valorização e transparência.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate({ section: "funcionarios", openNew: true })}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white text-[#041A47] hover:bg-blue-50 text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            <Plus size={15} />
            Novo Servidor
          </button>
          <button
            type="button"
            onClick={() => onNavigate({ section: "atestados", openNew: true })}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <Stethoscope size={15} />
            Lançar Atestado
          </button>
          <button
            type="button"
            onClick={() => onNavigate({ section: "ferias", openNew: true })}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <CalendarDays size={15} />
            Férias / Afastamento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate({ section: "funcionarios" })}
          className="text-left bg-white rounded-xl border border-[#E2E8F0] hover:border-[#0047B3] p-5 shadow-2xs transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[#667085]">
            <span>Servidores Ativos</span>
            <Users size={18} className="text-[#041A47]" />
          </div>
          <div className="text-2xl font-bold text-[#041A47] mt-2">{ativos}</div>
          <div className="text-[11px] text-[#667085] mt-1">
            Total cadastrado: {funcionarios.length}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate({ section: "atestados" })}
          className="text-left bg-white rounded-xl border border-[#E2E8F0] hover:border-[#0047B3] p-5 shadow-2xs transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[#667085]">
            <span>Atestados Registrados</span>
            <Stethoscope size={18} className="text-[#0047B3]" />
          </div>
          <div className="text-2xl font-bold text-[#041A47] mt-2">
            {atestados.length}
          </div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">
            {atestadosPendentes} aguardando conferência
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate({ section: "ferias" })}
          className="text-left bg-white rounded-xl border border-[#E2E8F0] hover:border-[#0047B3] p-5 shadow-2xs transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[#667085]">
            <span>Férias / Afastamentos Ativos</span>
            <CalendarDays size={18} className="text-emerald-700" />
          </div>
          <div className="text-2xl font-bold text-[#041A47] mt-2">
            {emFeriasOuAfast}
          </div>
          <div className="text-[11px] text-[#667085] mt-1">
            Total histórico: {movimentacoes.length}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate({ section: "ocorrencias" })}
          className="text-left bg-white rounded-xl border border-[#E2E8F0] hover:border-[#0047B3] p-5 shadow-2xs transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[#667085]">
            <span>Ocorrências Funcionais</span>
            <ClipboardList size={18} className="text-indigo-700" />
          </div>
          <div className="text-2xl font-bold text-[#041A47] mt-2">
            {ocorrencias.length}
          </div>
          <div className="text-[11px] text-[#667085] mt-1">
            Registros no seu escopo
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-[#041A47] flex items-center gap-2">
              <Building2 size={16} className="text-[#0047B3]" />
              Servidores por Secretaria
            </h2>
            <button
              type="button"
              onClick={() => onNavigate({ section: "secretarias" })}
              className="text-xs font-semibold text-[#0047B3] hover:underline cursor-pointer"
            >
              Ver todas
            </button>
          </div>

          <div className="space-y-3">
            {porSecretaria.map((sec) => {
              const pct =
                funcionarios.length > 0
                  ? Math.round((sec.total / funcionarios.length) * 100)
                  : 0;
              return (
                <div key={sec.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-[#344054]">
                      {sec.sigla} — {sec.nome}
                    </span>
                    <span className="font-bold text-[#041A47]">
                      {sec.total} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0047B3] rounded-full"
                      style={{
                        width: `${Math.max(pct, sec.total > 0 ? 6 : 0)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-[#041A47] flex items-center gap-2">
              <Stethoscope size={16} className="text-[#0047B3]" />
              Últimos Atestados Lançados
            </h2>
            <button
              type="button"
              onClick={() => onNavigate({ section: "atestados" })}
              className="text-xs font-semibold text-[#0047B3] hover:underline cursor-pointer"
            >
              Abrir controle
            </button>
          </div>

          {atestados.length === 0 ? (
            <p className="text-xs text-[#667085] py-6 text-center">
              Nenhum atestado lançado até o momento.
            </p>
          ) : (
            <div className="divide-y divide-[#EEF2F6]">
              {atestados.slice(0, 5).map((at) => (
                <div
                  key={at.id}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold text-[#041A47]">
                      {at.funcionario_nome}
                    </div>
                    <div className="text-[11px] text-[#667085]">
                      {at.data_inicio} a {at.data_fim} ({at.dias} dia
                      {at.dias > 1 ? "s" : ""}) · {at.secretaria_sigla}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      at.status === "aprovado"
                        ? "bg-emerald-50 text-emerald-700"
                        : at.status === "rejeitado"
                        ? "bg-red-50 text-red-700"
                        : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {at.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FichaInstantView({
  fichaId,
  funcionarios,
  atestados,
  movimentacoes,
  ocorrencias,
  onBack,
  onMutated,
}: {
  fichaId: string;
  funcionarios: WorkspaceSnapshot["funcionarios"];
  atestados: WorkspaceSnapshot["atestados"];
  movimentacoes: WorkspaceSnapshot["movimentacoes"];
  ocorrencias: WorkspaceSnapshot["ocorrencias"];
  onBack: () => void;
  onMutated?: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const func = funcionarios.find((f) => f.id === fichaId);
  if (!func) {
    return (
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 text-xs space-y-3">
        <p className="font-semibold text-[#041A47]">Servidor não encontrado.</p>
        <button
          type="button"
          onClick={onBack}
          className="text-[#0047B3] font-semibold hover:underline cursor-pointer"
        >
          Voltar para Funcionários
        </button>
      </div>
    );
  }

  const funcAtest = atestados.filter((a) => a.funcionario_id === func.id);
  const funcMovs = movimentacoes.filter((m) => m.funcionario_id === func.id);
  const funcOcorr = ocorrencias.filter((o) => o.funcionario_id === func.id);

  function handleChangeSituacao(next: SituacaoFuncionario) {
    if (!func || next === func.situacao) return;
    startTransition(async () => {
      const res = await updateFuncionarioSituacaoAction(func.id, next);
      if (res.ok) await onMutated?.();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-slate-200/70 text-[#041A47] cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-[#041A47]">{func.nome}</h1>
            <p className="text-xs text-[#667085]">
              Matrícula <strong>{func.matricula}</strong> · {func.cargo} ·{" "}
              {func.secretaria_sigla}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="ficha-situacao"
            className="text-[11px] font-semibold text-[#667085]"
          >
            Situação:
          </label>
          <select
            id="ficha-situacao"
            value={func.situacao}
            disabled={pending}
            onChange={(e) =>
              handleChangeSituacao(e.target.value as SituacaoFuncionario)
            }
            className="px-3 py-1.5 rounded-lg bg-white border border-[#D0D5DD] text-xs font-bold text-[#041A47] cursor-pointer disabled:opacity-60"
          >
            {(Object.keys(SITUACAO_LABELS) as SituacaoFuncionario[]).map(
              (key) => (
                <option key={key} value={key}>
                  {SITUACAO_LABELS[key]}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div>
          <div className="text-[#667085]">CPF</div>
          <div className="font-mono font-semibold mt-0.5">{func.cpf}</div>
        </div>
        <div>
          <div className="text-[#667085]">Vínculo</div>
          <div className="font-semibold mt-0.5">
            {VINCULO_LABELS[func.vinculo]}
          </div>
        </div>
        <div>
          <div className="text-[#667085]">Admissão</div>
          <div className="font-semibold mt-0.5">{func.data_admissao}</div>
        </div>
        <div>
          <div className="text-[#667085]">Contato</div>
          <div className="font-semibold mt-0.5">
            {func.telefone || func.email || "Não informado"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <h2 className="text-sm font-bold text-[#041A47] flex items-center gap-2 mb-3">
            <Stethoscope size={16} className="text-[#0047B3]" />
            Atestados ({funcAtest.length})
          </h2>
          {funcAtest.length === 0 ? (
            <p className="text-xs text-[#667085]">Sem atestados registrados.</p>
          ) : (
            <ul className="space-y-2.5 text-xs">
              {funcAtest.map((a) => (
                <li
                  key={a.id}
                  className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#EEF2F6]"
                >
                  <div className="font-semibold text-[#041A47]">
                    {a.tipo} ({a.dias}d)
                  </div>
                  <div className="text-[11px] text-[#667085]">
                    {a.data_inicio} a {a.data_fim} · Status:{" "}
                    <strong className="uppercase">{a.status}</strong>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <h2 className="text-sm font-bold text-[#041A47] flex items-center gap-2 mb-3">
            <CalendarDays size={16} className="text-[#0047B3]" />
            Férias e Afastamentos ({funcMovs.length})
          </h2>
          {funcMovs.length === 0 ? (
            <p className="text-xs text-[#667085]">Sem registros.</p>
          ) : (
            <ul className="space-y-2.5 text-xs">
              {funcMovs.map((m) => (
                <li
                  key={m.id}
                  className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#EEF2F6]"
                >
                  <div className="font-semibold text-[#041A47]">{m.subtipo}</div>
                  <div className="text-[11px] text-[#667085]">
                    {m.data_inicio} a {m.data_fim} ({m.dias}d) · {m.status}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <h2 className="text-sm font-bold text-[#041A47] flex items-center gap-2 mb-3">
            <ClipboardList size={16} className="text-[#0047B3]" />
            Ocorrências ({funcOcorr.length})
          </h2>
          {funcOcorr.length === 0 ? (
            <p className="text-xs text-[#667085]">Sem ocorrências registradas.</p>
          ) : (
            <ul className="space-y-2.5 text-xs">
              {funcOcorr.map((o) => (
                <li
                  key={o.id}
                  className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#EEF2F6]"
                >
                  <div className="font-semibold text-[#041A47]">{o.titulo}</div>
                  <div className="text-[11px] text-[#667085]">
                    {OCORRENCIA_LABELS[o.tipo]} · {o.data_fato}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function RhboxInstantShell({
  initialData,
}: {
  initialData: WorkspaceSnapshot;
}) {
  const pathname = usePathname();
  return (
    <WorkspaceProvider initialData={initialData} initialPathname={pathname}>
      <InstantWorkspaceInner />
    </WorkspaceProvider>
  );
}
