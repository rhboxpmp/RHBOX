"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { WorkspaceSnapshot } from "@/lib/workspace";

export type SectionId =
  | "dashboard"
  | "funcionarios"
  | "ficha"
  | "secretarias"
  | "atestados"
  | "ferias"
  | "ponto"
  | "ocorrencias"
  | "relatorios"
  | "admin";

export interface RouteState {
  section: SectionId;
  fichaId?: string;
  openNew?: boolean;
}

export function parsePathToRoute(pathname: string, role: string): RouteState {
  if (pathname.startsWith("/funcionarios/")) {
    const id = pathname.replace("/funcionarios/", "").split("/")[0];
    if (id) return { section: "ficha", fichaId: id };
  }
  if (pathname.startsWith("/funcionarios")) return { section: "funcionarios" };
  if (pathname.startsWith("/secretarias")) return { section: "secretarias" };
  if (pathname.startsWith("/atestados")) return { section: "atestados" };
  if (pathname.startsWith("/ferias-afastamentos")) return { section: "ferias" };
  if (pathname.startsWith("/ponto-frequencia")) return { section: "ponto" };
  if (pathname.startsWith("/ocorrencias")) return { section: "ocorrencias" };
  if (pathname.startsWith("/relatorios")) return { section: "relatorios" };
  if (pathname.startsWith("/admin") && role === "admin") return { section: "admin" };
  return { section: "dashboard" };
}

export function routeToPath(route: RouteState): string {
  switch (route.section) {
    case "funcionarios":
      return "/funcionarios";
    case "ficha":
      return route.fichaId ? `/funcionarios/${route.fichaId}` : "/funcionarios";
    case "secretarias":
      return "/secretarias";
    case "atestados":
      return "/atestados";
    case "ferias":
      return "/ferias-afastamentos";
    case "ponto":
      return "/ponto-frequencia";
    case "ocorrencias":
      return "/ocorrencias";
    case "relatorios":
      return "/relatorios";
    case "admin":
      return "/admin";
    default:
      return "/";
  }
}

interface WorkspaceContextValue {
  data: WorkspaceSnapshot;
  route: RouteState;
  navigate: (next: RouteState) => void;
  refreshWorkspace: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  initialData,
  initialPathname,
  children,
}: {
  initialData: WorkspaceSnapshot;
  initialPathname: string;
  children: React.ReactNode;
}) {
  const [data, setData] = useState<WorkspaceSnapshot>(initialData);
  const [route, setRoute] = useState<RouteState>(() =>
    parsePathToRoute(initialPathname, initialData.user.role)
  );

  const navigate = useCallback(
    (next: RouteState) => {
      if (next.section === "admin" && data.user.role !== "admin") {
        return;
      }
      setRoute(next);
      const targetUrl = routeToPath(next);
      if (typeof window !== "undefined" && window.location.pathname !== targetUrl) {
        window.history.pushState(null, "", targetUrl);
      }
    },
    [data.user.role]
  );

  useEffect(() => {
    const onPopState = () => {
      setRoute(parsePathToRoute(window.location.pathname, data.user.role));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [data.user.role]);

  const refreshWorkspace = useCallback(async () => {
    try {
      const res = await fetch("/api/workspace", { cache: "no-store" });
      if (res.ok) {
        const fresh = (await res.json()) as WorkspaceSnapshot;
        setData(fresh);
      }
    } catch {
      // Silencioso em caso de queda momentânea
    }
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{ data, route, navigate, refreshWorkspace }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
