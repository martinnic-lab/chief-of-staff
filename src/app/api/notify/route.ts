import { NextResponse } from "next/server";
import {
  enviarTelegram,
  type TipoNotificacion,
  type PayloadNotificacion,
} from "@/lib/telegram";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      tipo: TipoNotificacion;
      payload: PayloadNotificacion;
    };

    if (!body?.tipo || !body?.payload) {
      return NextResponse.json(
        { ok: false, error: "Faltan 'tipo' o 'payload'." },
        { status: 400 }
      );
    }

    const resultado = await enviarTelegram(body.tipo, body.payload);
    return NextResponse.json(resultado, {
      status: resultado.ok ? 200 : 502,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
