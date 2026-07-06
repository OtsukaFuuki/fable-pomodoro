// IndexedDB 永続化: 設定・音量・日別セッション数（spec §3.1 / §3.2）
// 再生状態は保存しない（docs/decisions.md）
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { DEFAULT_VOLUMES, type ChannelId } from "./channels";
import { DEFAULT_BREAK_MS, DEFAULT_FOCUS_MS } from "./types";

const DB_NAME = "yonagi";
const DB_VERSION = 1;

export interface AppSettings {
  focusMs: number;
  breakMs: number;
  masterVol: number;
  volumes: Record<ChannelId, number>;
}

interface YonagiDB extends DBSchema {
  settings: {
    key: "app";
    value: AppSettings;
  };
  sessions: {
    key: string; // YYYY-MM-DD
    value: number;
  };
}

let dbPromise: Promise<IDBPDatabase<YonagiDB>> | null = null;

function getDb(): Promise<IDBPDatabase<YonagiDB>> {
  if (!dbPromise) {
    dbPromise = openDB<YonagiDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("settings");
        db.createObjectStore("sessions");
      },
    });
  }
  return dbPromise;
}

export function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const DEFAULT_SETTINGS: AppSettings = {
  focusMs: DEFAULT_FOCUS_MS,
  breakMs: DEFAULT_BREAK_MS,
  masterVol: 80,
  volumes: { ...DEFAULT_VOLUMES },
};

export async function loadSettings(): Promise<AppSettings> {
  try {
    const db = await getDb();
    const saved = await db.get("settings", "app");
    if (!saved) return { ...DEFAULT_SETTINGS, volumes: { ...DEFAULT_VOLUMES } };
    return {
      focusMs: saved.focusMs ?? DEFAULT_FOCUS_MS,
      breakMs: saved.breakMs ?? DEFAULT_BREAK_MS,
      masterVol: saved.masterVol ?? 80,
      volumes: { ...DEFAULT_VOLUMES, ...saved.volumes },
    };
  } catch {
    return { ...DEFAULT_SETTINGS, volumes: { ...DEFAULT_VOLUMES } };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    const db = await getDb();
    await db.put("settings", settings, "app");
  } catch {
    /* 保存失敗は握りつぶす。次回変更時に再試行される */
  }
}

export async function loadTodaySessions(): Promise<number> {
  try {
    const db = await getDb();
    const count = await db.get("sessions", todayKey());
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function saveTodaySessions(count: number): Promise<void> {
  try {
    const db = await getDb();
    await db.put("sessions", count, todayKey());
  } catch {
    /* 保存失敗は握りつぶす */
  }
}

/** Phase 4 の設定モーダル「データ全削除」用 */
export async function clearAllData(): Promise<void> {
  try {
    const db = await getDb();
    await db.clear("settings");
    await db.clear("sessions");
  } catch {
    /* 削除失敗は握りつぶす */
  }
}
