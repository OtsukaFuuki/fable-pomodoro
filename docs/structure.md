# フォルダ構成の設計図

ディレクトリを増やす場合は、**先にこのファイルを更新してから**作ること。

```
yonagi/
├── CLAUDE.md          # エージェントの入口
├── README.md          # 人間用セットアップ手順（環境変数なし）
├── docs/              # 仕様・進捗・設計判断・引き継ぎ
├── reference/         # コード規約の実物（変更禁止）
├── public/            # manifest / icons / sw.js（Phase 4 で作成）
└── src/
    ├── app/           # 単一ページ + layout（App Router）
    ├── components/    # TimerRing / GlowSlider / MixerRow / Stepper …
    └── lib/           # audio-engine / timer / db / types
```

## src/lib

- `timer.ts`: endTime 逆算方式のカウントダウン（実装済み）
- `audio-engine.ts`: 環境音合成エンジン。AudioContext・AudioNode の生成/破棄はここに閉じ込める（雨のみ実装済み）
- `types.ts`: ポモドーロ状態機械の型定義（Phase 1 で追加）
- `db.ts`: IndexedDB 永続化（Phase 3 で追加）
- `db.ts`: IndexedDB 永続化（Phase 3）

## src/components

- `GlowSlider.tsx`: 自作スライダー（実装済み）
- `TimerRing.tsx` / `ModeLabel.tsx`: Phase 1 で追加
- `SettingsModal.tsx` / `SwRegister.tsx`: Phase 4 で追加

## ルール

- ページはデータ取得と組み立てのみ。ロジックは lib、見た目は components
- 音声ノードの生成・破棄は audio-engine の外に漏らさない。UI からは volume/start/stop だけを呼ぶ
