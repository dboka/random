import { db, isAdmin, json, purgeExpired, runtime } from "@/lib/salon";

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return json({ error: "Nav piekļuves." }, 401);
  await purgeExpired();
  const database = db();
  const [bookings, services, staff, assignments] = await database.batch([
    database.prepare("SELECT b.id,b.date,b.time,b.customer_name AS customerName,b.customer_phone AS customerPhone,b.status,b.sms_status AS smsStatus,b.created_at AS createdAt,s.name AS serviceName,t.name AS staffName FROM bookings b JOIN services s ON s.id=b.service_id JOIN staff t ON t.id=b.staff_id ORDER BY b.date DESC,b.time DESC LIMIT 500"),
    database.prepare("SELECT id,name,description,duration_minutes AS durationMinutes,price_cents AS priceCents,active FROM services ORDER BY sort_order,name"),
    database.prepare("SELECT id,name,active FROM staff ORDER BY name"),
    database.prepare("SELECT staff_id AS staffId,service_id AS serviceId FROM staff_services"),
  ]);
  return json({ bookings: bookings.results, services: services.results, staff: staff.results, assignments: assignments.results, smsConfigured: !!(runtime.TWILIO_ACCOUNT_SID && runtime.TWILIO_AUTH_TOKEN && runtime.TWILIO_FROM_NUMBER && runtime.SALON_SMS_NUMBER) });
}
