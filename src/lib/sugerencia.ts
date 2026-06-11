import { readFile } from "node:fs/promises";
import path from "node:path";
import { TEAM } from "@/db/schema";

// Mapeo: nombre de persona -> archivo .md en la carpeta equipo/
const ARCHIVOS: Record<(typeof TEAM)[number], string> = {
  "Camila Arbeláez": "camila-arbelaez.md",
  "Juan Esteban Vásquez": "juan-esteban-vasquez.md",
  "Laura Isaza": "laura-isaza.md",
  "Natalia Burgos": "natalia-burgos.md",
  "Steven Cadavid": "steven-cadavid.md",
};

// Palabras clave curadas por persona (resumen de sus fortalezas según el MD).
// Cada acierto pesa fuerte y alimenta la razón mostrada.
const KEYWORDS: Record<
  (typeof TEAM)[number],
  { palabras: string[]; area: string }
> = {
  "Camila Arbeláez": {
    area: "finanzas, tesorería, banca y temas administrativos/jurídicos",
    palabras: [
      "finanza", "financ", "tesoreria", "caja", "flujo", "banco", "bancari",
      "credito", "fiducia", "desembolso", "juridic", "legal", "administrativ",
      "payable", "contable", "contabilidad", "presupuesto", "equilibrio",
      "portal", "encargo", "multi-area", "multiarea",
    ],
  },
  "Juan Esteban Vásquez": {
    area: "project management de proyectos, licencias y trámites de obra",
    palabras: [
      "licencia", "curaduria", "planeacion", "obra", "tramite", "permiso",
      "cronograma", "project", "ejecucion de proyecto", "destrabar",
    ],
  },
  "Laura Isaza": {
    area: "inmobiliario en USA, renta y property management, orden de procesos",
    palabras: [
      "usa", "estados unidos", "renta", "property", "management", "ee.uu",
      "proceso", "comunicacion interna", "comunicaciones", "portafolio us",
    ],
  },
  "Natalia Burgos": {
    area: "comercial Colombia: ventas, clientes y cierre de negocios",
    palabras: [
      "comercial", "venta", "vender", "cliente", "vendedora", "cierre",
      "negocio", "comercializa", "fuerza comercial",
    ],
  },
  "Steven Cadavid": {
    area: "relaciones de alto nivel con externos: inversionistas y stakeholders",
    palabras: [
      "inversionista", "stakeholder", "externo", "alto nivel", "representa",
      "tercero", "relacion", "portafolio a", "interlocucion",
    ],
  },
};

// Normaliza: minúsculas y sin acentos.
const ACENTOS: Record<string, string> = {
  á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", ñ: "n",
};
function normalizar(t: string): string {
  return t.toLowerCase().replace(/[áéíóúüñ]/g, (c) => ACENTOS[c] ?? c);
}

// Cache de los MDs ya leídos y normalizados.
let cacheMDs: Record<string, string> | null = null;

async function leerMDs(): Promise<Record<string, string>> {
  if (cacheMDs) return cacheMDs;
  const dir = path.join(process.cwd(), "equipo");
  const out: Record<string, string> = {};
  for (const persona of TEAM) {
    try {
      const contenido = await readFile(
        path.join(dir, ARCHIVOS[persona]),
        "utf-8"
      );
      out[persona] = normalizar(contenido);
    } catch {
      out[persona] = "";
    }
  }
  cacheMDs = out;
  return out;
}

export type Sugerencia = {
  persona: (typeof TEAM)[number] | null;
  razon: string;
  puntajes: { persona: string; puntaje: number }[];
};

export async function sugerirAsignado(
  titulo: string,
  descripcion: string
): Promise<Sugerencia> {
  const texto = normalizar(`${titulo} ${descripcion}`);
  if (texto.trim().length < 3) {
    return {
      persona: null,
      razon: "Escribí un título y una descripción para recibir una sugerencia.",
      puntajes: [],
    };
  }

  const mds = await leerMDs();

  // Palabras significativas del input (>=4 letras) para cruzar contra el MD.
  const palabrasInput = Array.from(
    new Set(texto.split(/[^a-z0-9]+/).filter((w) => w.length >= 4))
  );

  const resultados = TEAM.map((persona) => {
    const md = mds[persona] ?? "";
    const { palabras, area } = KEYWORDS[persona];

    // 1) Aciertos de palabras clave curadas (peso 3).
    const aciertosCurados = palabras.filter((k) => texto.includes(k));
    // 2) Palabras del input que aparecen en el MD de la persona (peso 1).
    const aciertosMD = palabrasInput.filter((w) => md.includes(w));

    const puntaje = aciertosCurados.length * 3 + aciertosMD.length;
    return { persona, puntaje, aciertosCurados, area };
  }).sort((a, b) => b.puntaje - a.puntaje);

  const top = resultados[0];

  if (!top || top.puntaje === 0) {
    return {
      persona: null,
      razon:
        "No encontré una coincidencia clara con las áreas del equipo. Elegí manualmente a quién asignar.",
      puntajes: resultados.map((r) => ({
        persona: r.persona,
        puntaje: r.puntaje,
      })),
    };
  }

  const razon = `${top.persona} porque su MD la/lo marca fuerte en ${top.area}.`;

  return {
    persona: top.persona,
    razon,
    puntajes: resultados.map((r) => ({
      persona: r.persona,
      puntaje: r.puntaje,
    })),
  };
}
