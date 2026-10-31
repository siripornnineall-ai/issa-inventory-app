import { emptyState, type AppState } from "./state";

// สถานะการบันทึกลงฐานข้อมูล: รายการที่ยังส่งอยู่ (pending) กับรายการที่ส่งไม่สำเร็จ (failed)
// รายการที่ส่งไม่สำเร็จไม่ถูกทิ้ง เก็บไว้ส่งซ้ำ (เก็บลง localStorage เป็น "ส่วนที่เปลี่ยน" เล็ก ๆ ปิดแอปแล้วเปิดใหม่ก็ยังส่งต่อได้)
// เก็บทีละส่วนที่เปลี่ยนจริง (sparse) ไม่ใช่ state ทั้งก้อน เพราะ state ทั้งหมดหลาย MB เก็บลง localStorage ไม่ได้

export interface FailedSync {
  id: string;
  at: number;
  userId: string | null; // คนที่ทำรายการ: ส่งซ้ำด้วยบัญชีของคนนั้นเท่านั้น (สิทธิ์ฝั่งฐานข้อมูลผูกกับบัญชี)
  error: string;
  attempts: number;
  prev: AppState; // sparse: มีเฉพาะระเบียนที่เปลี่ยน
  next: AppState;
}

export interface SyncSnapshot {
  pending: number; // กำลังส่ง/รอคิว
  failed: number; // ส่งไม่สำเร็จ รอส่งซ้ำ
  retrying: boolean;
  lastError: string;
}

const STORAGE_KEY = "issa-unsent-syncs";
const MAX_STORED_BYTES = 1_500_000;

let pending = 0;
let retrying = false;
let failures: FailedSync[] = [];
// ของบัญชีอื่นบนเครื่องเดียวกัน: เก็บไว้ในเครื่องไม่ลบ ไม่นับ ไม่ส่ง (ส่งได้เฉพาะตอนเจ้าของบัญชีล็อกอิน)
let foreign: FailedSync[] = [];
let snapshot: SyncSnapshot = { pending: 0, failed: 0, retrying: false, lastError: "" };
const listeners = new Set<() => void>();

function refreshSnapshot() {
  const next: SyncSnapshot = { pending, failed: failures.length, retrying, lastError: failures[0]?.error ?? "" };
  if (next.pending === snapshot.pending && next.failed === snapshot.failed && next.retrying === snapshot.retrying && next.lastError === snapshot.lastError) return;
  snapshot = next;
  listeners.forEach((l) => l());
}

export function getSyncSnapshot(): SyncSnapshot {
  return snapshot;
}

export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setPendingSyncs(n: number) {
  pending = n;
  refreshSnapshot();
}

export function setRetrying(v: boolean) {
  retrying = v;
  refreshSnapshot();
}

export function failedSyncCount(): number {
  return failures.length;
}

export function getFailedSyncs(): FailedSync[] {
  return failures;
}

// ---------- ส่วนที่เปลี่ยนจริงระหว่าง prev กับ next ----------
// ตารางแบบ Record<id, ระเบียน>: เก็บเฉพาะ id ที่อ้างอิงเปลี่ยน (immer ให้ระเบียนที่ไม่เปลี่ยนอ้างอิงเดิมเสมอ)
// ฟิลด์ก้อนเดียว (companyInfo ฯลฯ): เก็บทั้งก้อนถ้าอ้างอิงเปลี่ยน
const WHOLE_VALUE_KEYS = new Set(["companyInfo", "storefrontSettings"]);
const SKIP_KEYS = new Set(["currentUserId", "seededAt"]);

export function sparseChange(prev: AppState, next: AppState): { prev: AppState; next: AppState } {
  const sp = emptyState() as unknown as Record<string, unknown>;
  const sn = emptyState() as unknown as Record<string, unknown>;
  const p = prev as unknown as Record<string, unknown>;
  const n = next as unknown as Record<string, unknown>;
  for (const key of Object.keys(sp)) {
    if (SKIP_KEYS.has(key)) continue;
    if (WHOLE_VALUE_KEYS.has(key)) {
      if (p[key] !== n[key]) {
        sp[key] = p[key];
        sn[key] = n[key];
      }
      continue;
    }
    const pm = (p[key] ?? {}) as Record<string, unknown>;
    const nm = (n[key] ?? {}) as Record<string, unknown>;
    const outP: Record<string, unknown> = {};
    const outN: Record<string, unknown> = {};
    for (const id of new Set([...Object.keys(pm), ...Object.keys(nm)])) {
      if (pm[id] === nm[id]) continue;
      if (id in pm) outP[id] = pm[id];
      if (id in nm) outN[id] = nm[id];
    }
    sp[key] = outP;
    sn[key] = outN;
  }
  return { prev: sp as unknown as AppState, next: sn as unknown as AppState };
}

// ---------- เก็บ/โหลดจากเครื่อง ----------
function persist() {
  if (typeof window === "undefined") return;
  try {
    const all = [...failures, ...foreign];
    if (all.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const json = JSON.stringify(all);
    // ใหญ่เกินจะเก็บลงเครื่องไม่ได้ (ยังอยู่ในหน่วยความจำและขึ้นแถบเตือนตามปกติ)
    if (json.length <= MAX_STORED_BYTES) window.localStorage.setItem(STORAGE_KEY, json);
  } catch {
    // localStorage ใช้ไม่ได้ (โหมดส่วนตัว/เต็ม) ไม่เป็นไร ยังส่งซ้ำจากหน่วยความจำได้
  }
}

export function recordFailure(prev: AppState, next: AppState, error: string, userId: string | null): FailedSync {
  const sparse = sparseChange(prev, next);
  const f: FailedSync = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: Date.now(), userId, error, attempts: 1, prev: sparse.prev, next: sparse.next };
  failures = [...failures, f];
  persist();
  refreshSnapshot();
  return f;
}

export function markAttempt(id: string, error: string) {
  failures = failures.map((f) => (f.id === id ? { ...f, error, attempts: f.attempts + 1 } : f));
  persist();
  refreshSnapshot();
}

export function clearFailure(id: string) {
  failures = failures.filter((f) => f.id !== id);
  persist();
  refreshSnapshot();
}

export function discardAllFailures() {
  failures = [];
  persist();
  refreshSnapshot();
}

// เปิดแอปใหม่: โหลดรายการที่ค้างจากรอบก่อน (เฉพาะของบัญชีที่ล็อกอินอยู่ ของคนอื่นเก็บไว้ไม่ลบ)
export function restoreFailures(userId: string | null): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const stored = JSON.parse(raw) as FailedSync[];
    const have = new Set(failures.map((f) => f.id));
    const mine = stored.filter((f) => f && !have.has(f.id) && (f.userId === userId || f.userId === null));
    foreign = stored.filter((f) => f && f.userId !== userId && f.userId !== null);
    failures = [...failures, ...mine];
    refreshSnapshot();
    return mine.length;
  } catch {
    return 0;
  }
}

// ใช้ในเทสต์
export function resetSyncStatusForTests() {
  pending = 0;
  retrying = false;
  failures = [];
  foreign = [];
  snapshot = { pending: 0, failed: 0, retrying: false, lastError: "" };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  listeners.forEach((l) => l());
}
