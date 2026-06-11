import Link from "next/link";
import { getEstadoTelegram } from "@/lib/telegram";
import BotonProbar from "./BotonProbar";

export const dynamic = "force-dynamic";

function maskear(valor: string | undefined): string {
  if (!valor) return "— no configurado —";
  if (valor.length <= 8) return "••••";
  return `${valor.slice(0, 4)}…${valor.slice(-4)}`;
}

export default function ConfigPage() {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const tieneNeon = Boolean(process.env.NEON_CONNECTION_STRING);
  const estado = getEstadoTelegram();

  const Fila = ({
    etiqueta,
    valor,
  }: {
    etiqueta: string;
    valor: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0">
      <span className="text-sm font-semibold text-gray-500">{etiqueta}</span>
      <span className="text-sm font-bold">{valor}</span>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/"
        className="text-sm font-semibold text-gray-500 hover:text-gray-700"
      >
        ← Volver al tablero
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-extrabold tracking-tight">
        Configuración
      </h1>
      <p className="mb-6 text-sm text-gray-500">
        Solo lectura. Estado de las conexiones del sistema.
      </p>

      <div className="rounded-2xl border border-[#eef0f7] bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-gray-500">
          Telegram
        </p>
        <Fila
          etiqueta="Bot token"
          valor={
            token ? (
              <span className="text-emerald-600">{maskear(token)} ✓</span>
            ) : (
              <span className="text-red-600">no configurado</span>
            )
          }
        />
        <Fila etiqueta="Chat ID (destino)" valor={chatId ?? "no configurado"} />
        <Fila
          etiqueta="Último mensaje enviado"
          valor={
            estado.ultimoEnvio
              ? new Date(estado.ultimoEnvio).toLocaleString("es-CO")
              : "todavía ninguno"
          }
        />
        <Fila
          etiqueta="¿Telegram respondiendo bien?"
          valor={
            estado.ultimoOk === null ? (
              <span className="text-gray-400">sin pruebas aún</span>
            ) : estado.ultimoOk ? (
              <span className="text-emerald-600">Sí ✓</span>
            ) : (
              <span className="text-red-600">No — {estado.ultimoError}</span>
            )
          }
        />
      </div>

      <div className="mt-5 rounded-2xl border border-[#eef0f7] bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-gray-500">
          Base de datos
        </p>
        <Fila
          etiqueta="Neon (PostgreSQL)"
          valor={
            tieneNeon ? (
              <span className="text-emerald-600">conectada ✓</span>
            ) : (
              <span className="text-red-600">no configurada</span>
            )
          }
        />
      </div>

      <div className="mt-5 rounded-2xl border border-[#eef0f7] bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
        <p className="mb-3 text-[11px] font-extrabold uppercase tracking-wide text-gray-500">
          Probar conexión
        </p>
        <BotonProbar />
      </div>
    </div>
  );
}
