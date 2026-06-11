// === Endpoint del cron de atrasos (modo nube) ===
// Vercel lo invoca según el horario de vercel.json, mandando
// "Authorization: Bearer <CRON_SECRET>". Nadie más puede dispararlo.

import { NextRequest } from "next/server";
import { revisarAtrasosPlanner } from "@/sync/atrasos";

export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return new Response("no autorizado", { status: 401 });
  }

  const r = await revisarAtrasosPlanner();
  return Response.json(r);
}
