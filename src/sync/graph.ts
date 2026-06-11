// === Cliente de Microsoft Graph ===
//
// Autenticación DELEGADA con "device code flow": el servicio actúa COMO
// Martín (con sus permisos, y las escrituras quedan auditadas a su nombre).
// La primera vez pide entrar a microsoft.com/devicelogin con un código;
// después renueva el token solo, usando un caché en .msal-cache.json.
//
// Permisos pedidos (mínimo viable):
//  - Tasks.ReadWrite      → leer y escribir tareas de Planner del usuario
//  - User.ReadBasic.All   → traducir el ID de un asignado a su nombre
//  (offline_access/openid los agrega MSAL solo, para renovar sesión)
//
// TODA llamada a Graph queda registrada en sync_log (lectura o escritura,
// y si una escritura fue aprobada por un humano).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  PublicClientApplication,
  type Configuration,
} from "@azure/msal-node";
import { sql } from "./neon";

const SCOPES = ["Tasks.ReadWrite", "User.ReadBasic.All"];
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const CACHE_FILE = path.join(process.cwd(), ".msal-cache.json");

function requerirEnv(nombre: string): string {
  const v = process.env[nombre];
  if (!v) {
    throw new Error(
      `Falta ${nombre} en .env.local — mirá RUNBOOK.md, sección "Registro en Azure".`
    );
  }
  return v;
}

// Caché de tokens en disco para no pedir login en cada arranque.
const cachePlugin = {
  beforeCacheAccess: async (ctx: {
    tokenCache: { deserialize: (s: string) => void };
  }) => {
    if (existsSync(CACHE_FILE)) {
      ctx.tokenCache.deserialize(readFileSync(CACHE_FILE, "utf-8"));
    }
  },
  afterCacheAccess: async (ctx: {
    cacheHasChanged: boolean;
    tokenCache: { serialize: () => string };
  }) => {
    if (ctx.cacheHasChanged) {
      writeFileSync(CACHE_FILE, ctx.tokenCache.serialize(), "utf-8");
    }
  },
};

let pca: PublicClientApplication | null = null;
function getPca(): PublicClientApplication {
  if (pca) return pca;
  const config: Configuration = {
    auth: {
      clientId: requerirEnv("AZURE_CLIENT_ID"),
      authority: `https://login.microsoftonline.com/${requerirEnv("AZURE_TENANT_ID")}`,
    },
    cache: { cachePlugin },
  };
  pca = new PublicClientApplication(config);
  return pca;
}

// Devuelve un access token válido. Si hay sesión guardada la renueva en
// silencio; si no, inicia el device code flow (imprime el código en consola).
export async function getToken(): Promise<string> {
  const app = getPca();
  const cuentas = await app.getTokenCache().getAllAccounts();

  if (cuentas.length > 0) {
    try {
      const r = await app.acquireTokenSilent({
        account: cuentas[0],
        scopes: SCOPES,
      });
      if (r?.accessToken) return r.accessToken;
    } catch {
      // El refresh falló (sesión vencida) → caemos al device code.
    }
  }

  console.log("\n🔐 Hay que iniciar sesión con tu cuenta Microsoft:");
  const r = await app.acquireTokenByDeviceCode({
    scopes: SCOPES,
    deviceCodeCallback: (info) => console.log(`\n   ${info.message}\n`),
  });
  if (!r?.accessToken) throw new Error("No se pudo obtener el token de Microsoft.");
  console.log(`✓ Sesión iniciada como ${r.account?.username ?? "(desconocido)"}\n`);
  return r.accessToken;
}

// Registra cada llamada a Graph en la bitácora sync_log.
export async function registrarSync(
  direction: "read" | "write",
  operation: string,
  payloadSummary: string,
  humanApproved = false
): Promise<void> {
  try {
    await sql.query(
      `INSERT INTO sync_log (direction, operation, payload_summary, human_approved)
       VALUES ($1, $2, $3, $4)`,
      [direction, operation, payloadSummary, humanApproved]
    );
  } catch (e) {
    // La bitácora nunca debe tumbar el sync.
    console.error("[sync_log] No pude registrar:", e);
  }
}

export type GraphOpts = {
  method?: "GET" | "PATCH" | "POST";
  body?: unknown;
  etag?: string; // requerido por Planner para PATCH (header If-Match)
  humanApproved?: boolean; // marca de aprobación en la bitácora
  resumen?: string; // descripción humana para la bitácora
};

// Llamada genérica a Graph con registro automático en sync_log y un
// reintento si Microsoft pide esperar (HTTP 429/503).
export async function graphFetch<T = unknown>(
  ruta: string,
  opts: GraphOpts = {}
): Promise<T> {
  const method = opts.method ?? "GET";
  const token = await getToken();

  const hacer = async (): Promise<Response> =>
    fetch(`${GRAPH_BASE}${ruta}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(opts.etag ? { "If-Match": opts.etag } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

  let resp = await hacer();
  if (resp.status === 429 || resp.status === 503) {
    const espera = Number(resp.headers.get("Retry-After") ?? "5");
    await new Promise((r) => setTimeout(r, Math.min(espera, 30) * 1000));
    resp = await hacer();
  }

  const direction = method === "GET" ? "read" : "write";
  const resumen = opts.resumen ?? `${method} ${ruta}`;

  if (!resp.ok) {
    const cuerpo = await resp.text();
    await registrarSync(
      direction,
      `${method} ${ruta}`,
      `ERROR HTTP ${resp.status}: ${cuerpo.slice(0, 300)}`,
      opts.humanApproved ?? false
    );
    throw new Error(`Graph ${method} ${ruta} → HTTP ${resp.status}: ${cuerpo.slice(0, 300)}`);
  }

  await registrarSync(direction, `${method} ${ruta}`, resumen, opts.humanApproved ?? false);

  // Algunos PATCH devuelven 204 sin cuerpo.
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}

export function getPlanId(): string {
  return requerirEnv("PLANNER_PLAN_ID");
}
