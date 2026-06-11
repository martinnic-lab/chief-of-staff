import { NextResponse } from "next/server";
import { sugerirAsignado } from "@/lib/sugerencia";

export async function POST(req: Request) {
  try {
    const { titulo = "", descripcion = "" } = (await req.json()) as {
      titulo?: string;
      descripcion?: string;
    };
    const sugerencia = await sugerirAsignado(titulo, descripcion);
    return NextResponse.json(sugerencia);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ persona: null, razon: error, puntajes: [] });
  }
}
