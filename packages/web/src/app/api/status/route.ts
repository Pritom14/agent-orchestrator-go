import { NextResponse } from "next/server";
import packageJson from "../../../../package.json";

export const dynamic = "force-dynamic";

/**
 * GET /api/status — Server health check
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    version: packageJson.version,
  });
}
