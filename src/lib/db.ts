// IndexedDB 永続化: 設定・BGM プリセット・日別セッション数
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { DEFAULT_PRESET, type PresetId } from "./audio-presets";
import { DEFAULT_BREAK_MS, DEFAULT_FOCUS_MS } from "./types";

const DB_NAME = "yonagi";
const DB_VERSION = 1;

export interface AppSettings {
  focusMs: number;
  breakMs: number;
  masterVol: number;
  selectedPreset: PresetId;
}

interface YonagiDB extends DBSchema {
  settings: {
    key: "app";
    value: AppSettings;
  };
  sessions: {
    key: string;
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
  selectedPreset: DEFAULT_PRESET,
};

export async function loadSettings(): Promise<AppSettings> {
  try {
    const db = await getDb();
    const saved = await db.get("settings", "app");
    if (!saved) return { ...DEFAULT_SETTINGS };
    return {
      focusMs: saved.focusMs ?? DEFAULT_FOCUS_MS,
      breakMs: saved.breakMs ?? DEFAULT_BREAK_MS,
      masterVol: saved.masterVol ?? 80,
      selectedPreset: saved.selectedPreset ?? DEFAULT_PRESET,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    const db = await getDb();
    await db.put("settings", settings, "app");
  } catch {
    /* 保存失敗は握りつぶす */
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

export async function clearAllData(): Promise<void> {
  try {
    const db = await getDb();
    await db.clear("settings");
    await db.clear("sessions");
  } catch {
    /* 削除失敗は握りつぶす */
  }
}
