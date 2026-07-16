import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "./_sb";

export default defineTool({
  name: "workshop_time_summary",
  title: "Resumo de Tempo Gasto em OS",
  description:
    "Agrega o tempo gasto (total_time_seconds) das OS concluídas no período, agrupando por atividade. Retorna também o detalhamento por usuário via work_order_time_entries.",
  inputSchema: {
    date_from: z.string().optional().describe("ISO date (created_at >=)"),
    date_to: z.string().optional().describe("ISO date (created_at <=)"),
    activity_id: z.string().uuid().optional(),
    cliente_id: z.string().uuid().optional(),
    group_by: z.enum(["activity", "user", "os"]).optional().describe("Padrão: activity"),
    limit: z.number().int().min(1).max(500).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const client = sb(ctx);
    const groupBy = input.group_by ?? "activity";

    let q = client
      .from("work_orders")
      .select("id, os_code, status, activity_id, cliente_id, created_at, end_time, total_time_seconds, activities:activity_id(name), clientes:cliente_id(nome)")
      .eq("status", "concluido")
      .limit(input.limit ?? 500);
    if (input.date_from) q = q.gte("created_at", input.date_from);
    if (input.date_to) q = q.lte("created_at", input.date_to);
    if (input.activity_id) q = q.eq("activity_id", input.activity_id);
    if (input.cliente_id) q = q.eq("cliente_id", input.cliente_id);
    const { data: wos, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const fmt = (s: number) => {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      return `${h}h${m.toString().padStart(2, "0")}`;
    };

    if (groupBy === "os") {
      const rows = (wos ?? []).map((w: any) => ({
        os_code: w.os_code,
        activity: w.activities?.name,
        cliente: w.clientes?.nome,
        total_time_seconds: w.total_time_seconds ?? 0,
        total_time_hours: +((w.total_time_seconds ?? 0) / 3600).toFixed(2),
        total_time_hms: fmt(w.total_time_seconds ?? 0),
      }));
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }], structuredContent: { rows } };
    }

    if (groupBy === "user") {
      const ids = (wos ?? []).map((w: any) => w.id);
      if (!ids.length) return { content: [{ type: "text", text: "[]" }], structuredContent: { rows: [] } };
      const { data: entries, error: e2 } = await client
        .from("work_order_time_entries")
        .select("work_order_id, user_id, duration_seconds, profiles:user_id(nome)")
        .in("work_order_id", ids);
      if (e2) return { content: [{ type: "text", text: e2.message }], isError: true };
      const acc = new Map<string, { user_id: string; user_name: string; total_seconds: number; os_count: Set<string> }>();
      for (const e of entries ?? []) {
        const key = (e as any).user_id ?? "unknown";
        const cur = acc.get(key) ?? { user_id: key, user_name: (e as any).profiles?.nome ?? "—", total_seconds: 0, os_count: new Set() };
        cur.total_seconds += (e as any).duration_seconds ?? 0;
        cur.os_count.add((e as any).work_order_id);
        acc.set(key, cur);
      }
      const rows = [...acc.values()]
        .map((r) => ({ user_id: r.user_id, user_name: r.user_name, os_count: r.os_count.size, total_seconds: r.total_seconds, total_hours: +(r.total_seconds / 3600).toFixed(2), total_hms: fmt(r.total_seconds) }))
        .sort((a, b) => b.total_seconds - a.total_seconds);
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }], structuredContent: { rows } };
    }

    // group_by activity
    const acc = new Map<string, { activity_id: string; activity_name: string; os_count: number; total_seconds: number }>();
    for (const w of wos ?? []) {
      const key = (w as any).activity_id ?? "none";
      const cur = acc.get(key) ?? { activity_id: key, activity_name: (w as any).activities?.name ?? "—", os_count: 0, total_seconds: 0 };
      cur.os_count += 1;
      cur.total_seconds += (w as any).total_time_seconds ?? 0;
      acc.set(key, cur);
    }
    const rows = [...acc.values()]
      .map((r) => ({
        ...r,
        avg_seconds: r.os_count ? Math.round(r.total_seconds / r.os_count) : 0,
        avg_hms: fmt(r.os_count ? Math.round(r.total_seconds / r.os_count) : 0),
        total_hours: +(r.total_seconds / 3600).toFixed(2),
        total_hms: fmt(r.total_seconds),
      }))
      .sort((a, b) => b.total_seconds - a.total_seconds);
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }], structuredContent: { rows } };
  },
});
