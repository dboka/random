import { db, dayHours, minutes, occupiedTimes, rigaNow, timeLabel, json } from "@/lib/salon";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const serviceId = params.get("service") || "";
  const staffId = params.get("staff") || "";
  const date = params.get("date") || "";
  const hours = dayHours(date);
  const now = rigaNow();
  if (!hours || date < now.date || date > new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)) return json({ times: [] });
  const service = await db().prepare("SELECT s.duration_minutes AS duration FROM services s JOIN staff_services ss ON ss.service_id=s.id JOIN staff t ON t.id=ss.staff_id WHERE s.id=? AND t.id=? AND s.active=1 AND t.active=1")
    .bind(serviceId, staffId).first<{ duration: number }>();
  if (!service) return json({ times: [] });
  const locks = await db().prepare("SELECT time FROM slot_locks WHERE staff_id=? AND date=?").bind(staffId, date).all<{ time: string }>();
  const busy = new Set(locks.results.map(v => v.time));
  const times: string[] = [];
  for (let start = hours[0]; start + service.duration <= hours[1]; start += 30) {
    const label = timeLabel(start);
    if (date === now.date && start <= minutes(now.time) + 60) continue;
    if (occupiedTimes(start, service.duration).some(slot => busy.has(slot))) continue;
    times.push(label);
  }
  return json({ times });
}
