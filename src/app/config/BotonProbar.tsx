"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { probarTelegram } from "@/app/actions";

export default function BotonProbar() {
  const [pendiente, startTransition] = useTransition();
  const [resultado, setResultado] = useState<string | null>(null);
  const router = useRouter();

  function probar() {
    setResultado(null);
    startTransition(async () => {
      const r = await probarTelegram();
      setResultado(
        r.ok
          ? "✅ ¡Mensaje enviado! Revisá tu Telegram."
          : `❌ Falló: ${r.error}`
      );
      router.refresh();
    });
  }

  return (
    <div>
      <button
        onClick={probar}
        disabled={pendiente}
        className="rounded-xl bg-[#5e55fe] px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(94,85,254,0.3)] transition hover:brightness-105 disabled:opacity-60"
      >
        {pendiente ? "Enviando…" : "Enviar mensaje de prueba"}
      </button>
      {resultado && <p className="mt-3 text-sm font-semibold">{resultado}</p>}
    </div>
  );
}
