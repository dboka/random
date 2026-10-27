import { env } from "cloudflare:workers";

type Runtime = Cloudflare.Env & {
  ADMIN_PASSWORD_HASH?: string;
  ADMIN_SESSION_SECRET?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM_NUMBER?: string;
  SALON_SMS_NUMBER?: string;
};

export const runtime = env as Runtime;
export const db = () => {
  if (!runtime.DB) throw new Error("DB binding is missing");
  return runtime.DB;
};

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !!origin && origin === new URL(request.url).origin;
}

export async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

export function rigaNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map(v => [v.type, v.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export function dayHours(date: string): [number, number] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) return null;
  const weekday = d.getUTCDay();
  if (weekday === 0) return null;
  return weekday === 6 ? [10 * 60, 16 * 60] : [9 * 60, 19 * 60];
}

export function minutes(time: string) {
  if (!/^\d{2}:\d{2}$/.test(time)) return NaN;
  const [h, m] = time.split(":").map(Number);
  return h < 24 && m < 60 ? h * 60 + m : NaN;
}

export function timeLabel(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function occupiedTimes(start: number, duration: number) {
  return Array.from({ length: duration / 30 }, (_, i) => timeLabel(start + i * 30));
}

export async function ensureSeed() {
  const database = db();
  await database.batch([
    database.prepare("INSERT OR IGNORE INTO services (id,name,description,duration_minutes,price_cents,active,sort_order) VALUES ('consultation','Pakalpojuma konsultācija','Pakalpojumu un cenu precizēsim ar jums personīgi.',30,NULL,1,0)"),
    database.prepare("INSERT OR IGNORE INTO staff (id,name,active) VALUES ('team','Salona komanda',1)"),
    database.prepare("INSERT OR IGNORE INTO staff_services (staff_id,service_id) VALUES ('team','consultation')"),
  ]);
}

export async function rateLimit(request: Request, prefix: string, max: number, windowSeconds: number) {
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const key = `${prefix}:${await sha256(ip)}`;
  const now = Math.floor(Date.now() / 1000);
  const result = await db().prepare("INSERT INTO rate_limits (key,count,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at < ? THEN 1 ELSE count+1 END, reset_at=CASE WHEN reset_at < ? THEN ? ELSE reset_at END RETURNING count")
    .bind(key, now + windowSeconds, now, now, now + windowSeconds).first<{ count: number }>();
  return (result?.count || 0) <= max;
}

async function sign(value: string) {
  const secret = runtime.ADMIN_SESSION_SECRET;
  if (!secret) return "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}

export async function adminCookie() {
  const expires = Date.now() + 12 * 60 * 60 * 1000;
  const payload = String(expires);
  return `astorija_admin=${payload}.${await sign(payload)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`;
}

export async function isAdmin(request: Request) {
  const cookie = request.headers.get("cookie")?.match(/(?:^|;\s*)astorija_admin=([^;]+)/)?.[1];
  if (!cookie || !runtime.ADMIN_SESSION_SECRET) return false;
  const [payload, signature] = cookie.split(".");
  if (!payload || !signature || Number(payload) < Date.now()) return false;
  const expected = await sign(payload);
  if (signature.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < signature.length; i++) diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function sendSalonSms(booking: { id: string; customerName: string; customerPhone: string; serviceName: string; staffName: string; date: string; time: string }, kind: "booking" | "cancel" = "booking") {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM_NUMBER: from, SALON_SMS_NUMBER: to } = runtime;
  if (!sid || !token || !from || !to) return "unconfigured";
  const body = `ASTORIJA ${kind === "cancel" ? "ATCELTS" : "jauns pieraksts"}: ${booking.customerName}, ${booking.customerPhone}; ${booking.serviceName}; ${booking.staffName}; ${booking.date} ${booking.time}.`;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ From: from, To: to, Body: body }),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

export async function purgeExpired() {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const database = db();
  await database.prepare("DELETE FROM slot_locks WHERE booking_id IN (SELECT id FROM bookings WHERE date < ?)").bind(cutoff).run();
  await database.prepare("DELETE FROM bookings WHERE date < ?").bind(cutoff).run();
  await database.prepare("DELETE FROM rate_limits WHERE reset_at < ?").bind(Math.floor(Date.now() / 1000)).run();
}
