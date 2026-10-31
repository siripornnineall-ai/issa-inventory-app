"use client";

import { useSyncExternalStore } from "react";
import { getSyncSnapshot, subscribeSyncStatus, type SyncSnapshot } from "./syncStatus";

// สถานะการบันทึกลงฐานข้อมูลสำหรับแสดงบนหน้าจอ: กำลังส่ง / ส่งไม่สำเร็จรอส่งซ้ำ
export function useSyncStatus(): SyncSnapshot {
  return useSyncExternalStore(subscribeSyncStatus, getSyncSnapshot, getSyncSnapshot);
}
