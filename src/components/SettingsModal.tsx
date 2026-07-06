// 設定モーダル: 音の説明 + データ全削除
"use client";
import { AUDIO_PRESETS } from "@/lib/audio-presets";

interface SettingsModalProps {
  open: boolean;
  onClose(): void;
  onClearData(): void;
}

export function SettingsModal({ open, onClose, onClearData }: SettingsModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-abyss/70 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-labelledby="settings-title"
        aria-modal="true"
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-frost/10 bg-panel px-6 py-6 shadow-[0_0_40px_rgba(174,184,244,0.08)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="settings-title" className="text-sm tracking-widest text-frost">
            設定
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-haze/30 text-haze transition-shadow duration-700 hover:shadow-[0_0_16px_rgba(138,147,168,0.2)]"
          >
            ✕
          </button>
        </div>

        <section className="mb-6">
          <h3 className="mb-3 text-xs tracking-widest text-haze">音について</h3>
          <p className="mb-4 text-[11px] leading-relaxed text-haze">
            BGM は <code className="text-frost">public/audio/</code>{" "}
            の MP3 をプリセット単位で順番にループ再生しています。
          </p>
          <ul className="flex flex-col gap-3">
            {AUDIO_PRESETS.map((p) => (
              <li key={p.id} className="text-[11px]">
                <span style={{ color: p.color }}>{p.name}</span>
                <ul className="mt-1 flex flex-col gap-0.5 pl-3 text-haze">
                  {p.files.map((f) => (
                    <li key={f}>{f.replace("/audio/", "")}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-3 text-xs tracking-widest text-haze">データ</h3>
          <p className="mb-4 text-[11px] leading-relaxed text-haze">
            タイマー設定・音量・セッション記録を端末から削除します。この操作は取り消せません。
          </p>
          <button
            type="button"
            onClick={() => {
              onClearData();
              onClose();
            }}
            className="min-h-11 w-full rounded-full border border-haze/40 text-sm tracking-widest text-haze shadow-[0_0_12px_rgba(138,147,168,0.1)] transition-shadow duration-700 hover:shadow-[0_0_20px_rgba(138,147,168,0.25)]"
          >
            データをすべて削除
          </button>
        </section>
      </div>
    </div>
  );
}
