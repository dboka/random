import { z } from "zod";
import { db, dayHours, json, minutes, occupiedTimes, purgeExpired, randomToken, rateLimit, rigaNow, sameOrigin, sendSalonSms, sha256 } from "@/lib/salon";

const schema = z.object({
  serviceId: z.string().min(1).max(80),
  staffId: z.string().min(1).max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^\+?[0-9\s()-]{8,20}$/),
  privacyAccepted: z.literal(true),
});

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Nederīgs pieprasījums." }, 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Pārbaudiet ievadītos datus." }, 400);
  if (!(await rateLimit(request, "booking", 5, 3600))) return json({ error: "Pārāk daudz mēģinājumu. Lūdzu, zvaniet salonam." }, 429);
  const input = parsed.data;
  const now = rigaNow();
  const hours = dayHours(input.date);
  const start = minutes(input.time);
  if (!hours || input.date < now.date || input.date > new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)) return json({ error: "Datums nav pieejams." }, 400);
  const service = await db().prepare("SELECT s.name AS serviceName,s.duration_minutes AS duration,t.name AS staffName FROM services s JOIN staff_services ss ON ss.service_id=s.id JOIN staff t ON t.id=ss.staff_id WHERE s.id=? AND t.id=? AND s.active=1 AND t.active=1")
    .bind(input.serviceId, input.staffId).first<{ serviceName: string; duration: number; staffName: string }>();
  if (!service || !Number.isInteger(start) || start % 30 !== 0 || start < hours[0] || start + service.duration > hours[1] || (input.date === now.date && start <= minutes(now.time) + 60)) return json({ error: "Laiks nav pieejams." }, 400);

  const id = crypto.randomUUID();
  const token = randomToken();
  const database = db();
  try {
    await database.batch([
      database.prepare("INSERT INTO bookings (id,service_id,staff_id,date,time,customer_name,customer_phone,status,cancel_token_hash,sms_status,created_at) VALUES (?,?,?,?,?,?,?,'confirmed',?,'pending',?)")
        .bind(id, input.serviceId, input.staffId, input.date, input.time, input.name, input.phone, await sha256(token), new Date().toISOString()),
      ...occupiedTimes(start, service.duration).map(slot => database.prepare("INSERT INTO slot_locks (staff_id,date,time,booking_id) VALUES (?,?,?,?)").bind(input.staffId, input.date, slot, id)),
    ]);
  } catch {
    return json({ error: "Šis laiks tikko tika aizņemts. Izvēlieties citu." }, 409);
  }
  await purgeExpired();
  const smsStatus = await sendSalonSms({ id, customerName: input.name, customerPhone: input.phone, serviceName: service.serviceName, staffName: service.staffName, date: input.date, time: input.time });
  await database.prepare("UPDATE bookings SET sms_status=? WHERE id=?").bind(smsStatus, id).run();
  return json({ id, cancelToken: token, smsStatus, date: input.date, time: input.time, serviceName: service.serviceName, staffName: service.staffName }, 201);
}
