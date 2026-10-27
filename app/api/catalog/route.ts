import { db, ensureSeed, json } from "@/lib/salon";

export async function GET() {
  await ensureSeed();
  const [services, staff] = await db().batch([
    db().prepare("SELECT id,name,description,duration_minutes AS durationMinutes,price_cents AS priceCents FROM services WHERE active=1 ORDER BY sort_order,name"),
    db().prepare("SELECT s.id,s.name,ss.service_id AS serviceId FROM staff s JOIN staff_services ss ON ss.staff_id=s.id WHERE s.active=1"),
  ]);
  return json({ services: services.results, staff: staff.results });
}
