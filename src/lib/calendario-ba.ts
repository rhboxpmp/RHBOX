import type { FeriadoMunicipal } from "@/types/rh";

export interface DiaCalendarioInfo {
  iso: string; // YYYY-MM-DD
  dia: number;
  diaSemanaIndex: number; // 0 = Dom .. 6 = Sab
  diaSemanaCurto: string;
  isWeekend: boolean;
  feriadoNome: string | null;
  feriadoEsfera:
    | "nacional"
    | "estadual_ba"
    | "municipal"
    | "facultativo"
    | null;
}

const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const MESES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function addDays(date: Date, days: number): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function formatUtcIso(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/**
 * Calcula o Domingo de Páscoa (algoritmo gregoriano) para qualquer ano.
 */
export function getEasterSundayUtc(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=Mar, 4=Abr
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

export interface HolidayEntry {
  iso: string;
  nome: string;
  esfera: "nacional" | "estadual_ba" | "municipal" | "facultativo";
  customId?: string;
  recorrenteAnual?: boolean;
}

/**
 * Retorna mapa de feriados Nacionais (Brasil), Estadual (Bahia) e Municipais cadastrados para o ano.
 */
export function getHolidaysMapForYear(
  year: number,
  municipais: FeriadoMunicipal[] = []
): Map<string, HolidayEntry> {
  const map = new Map<string, HolidayEntry>();

  const fixed: Array<{
    mmdd: string;
    nome: string;
    esfera: HolidayEntry["esfera"];
  }> = [
    { mmdd: "01-01", nome: "Confraternização Universal", esfera: "nacional" },
    { mmdd: "04-21", nome: "Tiradentes", esfera: "nacional" },
    { mmdd: "05-01", nome: "Dia do Trabalhador", esfera: "nacional" },
    { mmdd: "07-02", nome: "Independência da Bahia", esfera: "estadual_ba" },
    { mmdd: "09-07", nome: "Independência do Brasil", esfera: "nacional" },
    { mmdd: "10-12", nome: "Nossa Senhora Aparecida", esfera: "nacional" },
    { mmdd: "11-02", nome: "Finados", esfera: "nacional" },
    { mmdd: "11-15", nome: "Proclamação da República", esfera: "nacional" },
    { mmdd: "11-20", nome: "Dia da Consciência Negra", esfera: "nacional" },
    { mmdd: "12-25", nome: "Natal", esfera: "nacional" },
  ];

  for (const item of fixed) {
    const iso = `${year}-${item.mmdd}`;
    map.set(iso, { iso, nome: item.nome, esfera: item.esfera });
  }

  // Feriados móveis e pontos facultativos nacionais calculados pela Páscoa
  const easter = getEasterSundayUtc(year);
  const segCarnaval = formatUtcIso(addDays(easter, -48));
  const terCarnaval = formatUtcIso(addDays(easter, -47));
  const sextaSanta = formatUtcIso(addDays(easter, -2));
  const corpusChristi = formatUtcIso(addDays(easter, 60));

  map.set(segCarnaval, {
    iso: segCarnaval,
    nome: "Carnaval (Ponto Facultativo)",
    esfera: "facultativo",
  });
  map.set(terCarnaval, {
    iso: terCarnaval,
    nome: "Carnaval (Ponto Facultativo)",
    esfera: "facultativo",
  });
  map.set(sextaSanta, {
    iso: sextaSanta,
    nome: "Sexta-feira Santa",
    esfera: "nacional",
  });
  map.set(corpusChristi, {
    iso: corpusChristi,
    nome: "Corpus Christi",
    esfera: "facultativo",
  });

  // Feriados Municipais e Pontos Facultativos cadastrados pelo RH Geral / Admin
  for (const m of municipais) {
    const [mYear, mMonth, mDay] = m.data.split("-");
    if (!mYear || !mMonth || !mDay) continue;
    let targetIso: string | null = null;
    if (m.recorrente_anual) {
      targetIso = `${year}-${mMonth}-${mDay}`;
    } else if (Number(mYear) === year) {
      targetIso = m.data;
    }
    if (!targetIso) continue;

    map.set(targetIso, {
      iso: targetIso,
      nome: m.descricao,
      esfera:
        m.tipo === "ponto_facultativo" ? "facultativo" : "municipal",
      customId: m.id,
      recorrenteAnual: m.recorrente_anual,
    });
  }

  return map;
}

export function getDaysInCompetencia(
  competencia: string,
  municipais: FeriadoMunicipal[] = []
): DiaCalendarioInfo[] {
  const [yStr, mStr] = competencia.split("-");
  const year = Number(yStr) || new Date().getFullYear();
  const month = Number(mStr) || new Date().getMonth() + 1;
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const holidays = getHolidaysMapForYear(year, municipais);

  const days: DiaCalendarioInfo[] = [];
  for (let d = 1; d <= totalDays; d++) {
    const dt = new Date(Date.UTC(year, month - 1, d));
    const iso = formatUtcIso(dt);
    const dow = dt.getUTCDay();
    const h = holidays.get(iso);
    days.push({
      iso,
      dia: d,
      diaSemanaIndex: dow,
      diaSemanaCurto: DIAS_CURTOS[dow],
      isWeekend: dow === 0 || dow === 6,
      feriadoNome: h?.nome ?? null,
      feriadoEsfera: h?.esfera ?? null,
    });
  }
  return days;
}

export function formatCompetenciaLabel(competencia: string): string {
  const [yStr, mStr] = competencia.split("-");
  const m = Number(mStr);
  if (!yStr || !m || m < 1 || m > 12) return competencia;
  return `${MESES_PT[m - 1]} / ${yStr}`;
}

export function countDiasUteis(days: DiaCalendarioInfo[]): {
  uteis: number;
  feriadosNaSemana: number;
} {
  let uteis = 0;
  let feriadosNaSemana = 0;
  for (const day of days) {
    if (day.isWeekend) continue;
    if (day.feriadoNome) {
      feriadosNaSemana++;
    } else {
      uteis++;
    }
  }
  return { uteis, feriadosNaSemana };
}
