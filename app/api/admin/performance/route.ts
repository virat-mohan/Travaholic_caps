import { NextResponse } from "next/server";
import { setSetting } from "@/lib/settings";
import {
  bootstrapPerformanceProgram,
  runPerformanceSweep,
  getPerformanceOverview,
  getPmState,
  getPmConfig,
  generateExperimentIdeas,
} from "@/lib/performance-manager";
import { setCampaignStatus } from "@/lib/meta-marketing";

export const maxDuration = 300;

export async function GET() {
  try {
    return NextResponse.json(await getPerformanceOverview());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  try {
    switch (body.action) {
      case "bootstrap":
        return NextResponse.json(await bootstrapPerformanceProgram({ productSetId: body.productSetId, landingUrl: body.landingUrl }));
      case "sweep":
        return NextResponse.json(await runPerformanceSweep());
      case "ideas": {
        const [state, config] = await Promise.all([getPmState(), getPmConfig()]);
        await generateExperimentIdeas(state, config);
        await setSetting("PM_STATE", JSON.stringify(state));
        return NextResponse.json({ ok: true, experiments: state.experiments });
      }
      case "config": {
        if (body.enabled != null) await setSetting("PM_ENABLED", body.enabled ? "true" : "false");
        if (body.capRupees != null) await setSetting("PM_DAILY_BUDGET_CAP_RUPEES", String(body.capRupees));
        if (body.targetRoas != null) await setSetting("PM_TARGET_ROAS", String(body.targetRoas));
        return NextResponse.json({ ok: true });
      }
      case "campaign_status": {
        const config = await getPmConfig();
        const id = config.managedCampaignIds[0];
        if (!id) return NextResponse.json({ error: "No managed campaign" }, { status: 400 });
        await setCampaignStatus(id, body.status === "ACTIVE" ? "ACTIVE" : "PAUSED");
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    console.error("Performance manager action failed", body?.action, err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
