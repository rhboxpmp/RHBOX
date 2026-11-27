import type { Atestado, FeriasAfastamento } from "@/types/rh";

export interface CoberturaMes {
  atestadoDias: number;
  afastamentoDias: number;
  diasMap: Map<string, string>; // YYYY-MM-DD -> legenda curta
}

/**
 * Calcula quantos dias de atestado médico e de férias/licenças/afastamentos
 * recaem dentro da competência (YYYY-MM) para um servidor, sem duplicar dias.
 */
export function getCoberturaMensalServidor(
  funcionarioId: string,
  competencia: string,
  atestados: Atestado[],
  movimentacoes: FeriasAfastamento[]
): CoberturaMes {
  const [yStr, mStr] = competencia.split("-");
  const year = Number(yStr) || new Date().getFullYear();
  const month = Number(mStr) || new Date().getMonth() + 1;
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const diasMap = new Map<string, string>();
  let atestadoDias = 0;
  let afastamentoDias = 0;

  const funcMovs = movimentacoes.filter(
    (m) => m.funcionario_id === funcionarioId && m.status !== "cancelado"
  );
  const funcAt = atestados.filter(
    (a) => a.funcionario_id === funcionarioId && a.status !== "rejeitado"
  );

  for (let d = 1; d <= totalDays; d++) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    const mov = funcMovs.find(
      (m) => m.data_inicio <= iso && m.data_fim >= iso
    );
    const at = funcAt.find((a) => a.data_inicio <= iso && a.data_fim >= iso);

    if (mov) {
      afastamentoDias++;
      const label =
        mov.categoria === "ferias"
          ? "Férias"
          : mov.categoria === "licenca"
          ? "Licença"
          : "Afastamento";
      diasMap.set(iso, label);
    } else if (at) {
      atestadoDias++;
      diasMap.set(iso, at.tipo || "Atestado");
    }
  }

  return { atestadoDias, afastamentoDias, diasMap };
}
