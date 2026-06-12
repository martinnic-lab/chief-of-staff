// === Intérprete de lenguaje natural (Claude API) ===
//
// Claude NO ejecuta nada ni responde por su cuenta: solo TRADUCE el mensaje
// libre a una intención estructurada (acción + campos), forzada por un
// esquema JSON rígido. Quien ejecuta es el código de comandos.ts, con las
// mismas validaciones de siempre. Anti-alucinación:
//   - "persona" solo puede ser uno de los 5 nombres reales (enum) o null
//   - si falta información, la acción es "aclarar" con una pregunta
//   - la fecha de hoy se le pasa explícita para resolver "el 16 de junio"

import Anthropic from "@anthropic-ai/sdk";

export const EQUIPO_NOMBRES = [
  "Camila Arbeláez",
  "Juan Esteban Vásquez",
  "Laura Isaza",
  "Natalia Burgos",
  "Steven Cadavid",
] as const;

export type Intencion = {
  accion: "crear" | "listar" | "cambiar_estado" | "ayuda" | "aclarar";
  titulo: string | null;
  descripcion: string | null;
  persona: (typeof EQUIPO_NOMBRES)[number] | null;
  prioridad: "ALTA" | "MEDIA" | "BAJA" | null;
  deadline: string | null; // YYYY-MM-DD
  nuevo_estado: "COMPLETADA" | "EN_PROGRESO" | "BLOQUEADA" | null;
  fragmento: string | null; // parte del título de una tarea existente
  pregunta: string | null; // solo cuando accion = "aclarar"
};

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "accion", "titulo", "descripcion", "persona", "prioridad",
    "deadline", "nuevo_estado", "fragmento", "pregunta",
  ],
  properties: {
    accion: {
      type: "string",
      enum: ["crear", "listar", "cambiar_estado", "ayuda", "aclarar"],
      description: "Qué quiere hacer el usuario.",
    },
    titulo: {
      type: ["string", "null"],
      description: "Título corto y accionable de la tarea nueva (solo para crear).",
    },
    descripcion: {
      type: ["string", "null"],
      description: "Detalle adicional de la tarea nueva, si el mensaje lo trae.",
    },
    persona: {
      type: ["string", "null"],
      enum: [...EQUIPO_NOMBRES, null],
      description: "Miembro del equipo mencionado. SOLO uno de la lista; si no es claro, null.",
    },
    prioridad: { type: ["string", "null"], enum: ["ALTA", "MEDIA", "BAJA", null] },
    deadline: {
      type: ["string", "null"],
      description: "Fecha límite en formato YYYY-MM-DD, resuelta con la fecha de hoy.",
    },
    nuevo_estado: {
      type: ["string", "null"],
      enum: ["COMPLETADA", "EN_PROGRESO", "BLOQUEADA", null],
    },
    fragmento: {
      type: ["string", "null"],
      description: "Palabras del título de la tarea EXISTENTE a la que se refiere (para cambiar_estado o filtrar listados).",
    },
    pregunta: {
      type: ["string", "null"],
      description: "Pregunta breve en español para pedir lo que falta (solo si accion = aclarar).",
    },
  },
} as const;

const SISTEMA = `Eres el traductor de un asistente de gestión de tareas de la empresa Promotora Nivel (Colombia). Tu ÚNICA función es convertir el mensaje del usuario en una intención estructurada según el esquema. NO conversas, NO opinas, NO ejecutas.

Equipo (los únicos valores válidos para "persona"):
- Camila Arbeláez — finanzas, tesorería, banca, jurídico
- Juan Esteban Vásquez — proyectos, licencias, trámites de obra
- Laura Isaza — inmobiliario USA, renta, procesos
- Natalia Burgos — comercial Colombia, ventas
- Steven Cadavid — relaciones externas, inversionistas

Reglas estrictas:
1. NUNCA inventes datos. Si un campo no está en el mensaje, va null.
2. "persona": acepta variantes razonables de escritura (sin tildes, solo nombre de pila, apellido). Si el nombre NO corresponde claramente a alguien de la lista, déjalo null y usa accion "aclarar" preguntando a quién se refiere.
3. "crear": el título debe ser corto y accionable (ej: "Reporte de control de costos de Ryos a cierre de mayo"); el resto del mensaje va en descripcion. Si no hay título identificable, accion "aclarar".
4. Fechas relativas ("mañana", "el viernes", "16 de junio") se resuelven con la fecha de hoy que viene en el mensaje, SIEMPRE hacia el futuro, formato YYYY-MM-DD.
5. "cambiar_estado": "fragmento" son las palabras clave del título de la tarea existente ("terminé lo del predial" → fragmento "predial", nuevo_estado COMPLETADA).
6. "listar": pedidos como "qué tareas tenemos", "pendientes de Camila", "en qué está el equipo".
7. Saludos o mensajes sin pedido claro de tareas → accion "ayuda".
8. Ante ambigüedad real, prefiere "aclarar" con una pregunta corta antes que adivinar.`;

export function hayInterprete(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function interpretar(
  texto: string,
  nombreAutor: string
): Promise<Intencion | null> {
  const client = new Anthropic();

  // Fecha de hoy en Colombia (en-CA da YYYY-MM-DD).
  const hoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
  }).format(new Date());

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1000,
    system: SISTEMA,
    output_config: {
      format: { type: "json_schema", schema: ESQUEMA },
    },
    messages: [
      {
        role: "user",
        content: `Hoy es ${hoy}. Mensaje de ${nombreAutor}:\n"""${texto}"""`,
      },
    ],
  });

  const bloque = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );
  if (!bloque) return null;

  try {
    return JSON.parse(bloque.text) as Intencion;
  } catch {
    return null;
  }
}
