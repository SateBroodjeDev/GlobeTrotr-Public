import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireTripManagementAccess } from "@/lib/trip-management-access.server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TripTask = {
  id: string;
  title: string;
  assigneeName: string;
  dueDate: string | null;
  completed: boolean;
  category: "task" | "departure" | "shopping" | "custom" | "packing";
  listName: string;
  assigneeMemberId: string | null;
  packingScope: "shared" | "member" | null;
  baggageType: "personal" | "cabin" | "checked" | "shared" | null;
  itemCategory: "clothing" | "toiletries" | "documents" | "electronics" | "medical" | "food" | "other" | null;
  quantity: number;
  createdAt: string;
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function requireTaskAccess(client: any, actorId: string, tripId: string, write: boolean) {
  if (!UUID.test(tripId)) throw new Error("INVALID_TRIP");
  const { data: trip, error } = await client.from("trips")
    .select("workspace_user_id,workspace_uuid")
    .eq("trip_uuid", tripId)
    .maybeSingle();
  if (error || !trip) throw new Error("TRIP_NOT_FOUND");
  if (trip.workspace_user_id === actorId) return;

  const { data: member } = await client.from("trip_members")
    .select("role,status")
    .eq("trip_uuid", tripId)
    .eq("user_id", actorId)
    .eq("status", "active")
    .maybeSingle();
  if (member && (!write || ["traveler", "advisor", "finance"].includes(member.role))) return;
  try {
    await requireTripManagementAccess(client, actorId, tripId, write ? "trips_plan" : "trips_view");
    return;
  } catch { /* Normalize all denied paths below. */ }
  throw new Error("TRIP_ACCESS_REQUIRED");
}

export const listTripTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tripId: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    await requireTaskAccess(client, context.userId, data.tripId, false);
    const { data: rows, error } = await client.from("trip_tasks")
      .select("id,title,assignee_name,due_date,completed,category,list_name,assignee_member_id,packing_scope,baggage_type,item_category,quantity,created_at")
      .eq("trip_uuid", data.tripId)
      .order("completed")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at");
    if (error) throw new Error("TRIP_TASKS_UNAVAILABLE");
    return (rows ?? []).map((row: any) => ({
      id: row.id,
      title: row.title,
      assigneeName: row.assignee_name ?? "",
      dueDate: row.due_date,
      completed: Boolean(row.completed),
      category: row.category ?? "task",
      listName: row.list_name ?? "",
      assigneeMemberId: row.assignee_member_id,
      packingScope: row.packing_scope,
      baggageType: row.baggage_type,
      itemCategory: row.item_category,
      quantity: Number(row.quantity ?? 1),
      createdAt: row.created_at,
    })) as TripTask[];
  });

export const saveTripTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tripId: string; id?: string; title: string; assigneeName: string; dueDate: string | null; completed: boolean; category?: TripTask["category"]; listName?: string; assigneeMemberId?: string | null; packingScope?: "shared" | "member" | null; baggageType?: TripTask["baggageType"]; itemCategory?: TripTask["itemCategory"]; quantity?: number }) => input)
  .handler(async ({ data, context }) => {
    const title = data.title.trim();
    const assigneeName = data.assigneeName.trim();
    const category = data.category ?? "task";
    const listName = (data.listName ?? "").trim();
    const packing = category === "packing";
    const quantity = Math.floor(Number(data.quantity ?? 1));
    if (title.length < 2 || title.length > 160 || assigneeName.length > 100 || !["task", "departure", "shopping", "custom", "packing"].includes(category) || (category === "custom" && (listName.length < 2 || listName.length > 80)) || (data.id && !UUID.test(data.id)) || (packing && (!data.packingScope || !data.baggageType || !data.itemCategory || quantity < 1 || quantity > 99 || (data.packingScope === "member" && !data.assigneeMemberId)))) {
      throw new Error("INVALID_TASK");
    }
    const client = await db();
    await requireTaskAccess(client, context.userId, data.tripId, true);
    const payload = {
      trip_uuid: data.tripId,
      title,
      assignee_name: assigneeName || null,
      due_date: data.dueDate || null,
      completed: data.completed,
      category,
      list_name: category === "custom" ? listName : null,
      assignee_member_id: packing && data.packingScope === "member" ? data.assigneeMemberId : null,
      packing_scope: packing ? data.packingScope : null,
      baggage_type: packing ? data.baggageType : null,
      item_category: packing ? data.itemCategory : null,
      quantity: packing ? quantity : 1,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    };
    const query = data.id
      ? client.from("trip_tasks").update(payload).eq("id", data.id).eq("trip_uuid", data.tripId)
      : client.from("trip_tasks").insert({ ...payload, created_by: context.userId });
    const { data: row, error } = await query.select("id").single();
    if (error || !row) throw new Error("TRIP_TASK_SAVE_FAILED");
    return { id: row.id as string };
  });

export const deleteTripTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tripId: string; id: string }) => input)
  .handler(async ({ data, context }) => {
    if (!UUID.test(data.id)) throw new Error("INVALID_TASK");
    const client = await db();
    await requireTaskAccess(client, context.userId, data.tripId, true);
    const { error } = await client.from("trip_tasks").delete().eq("id", data.id).eq("trip_uuid", data.tripId);
    if (error) throw new Error("TRIP_TASK_DELETE_FAILED");
    return { ok: true };
  });
