# 夜凪（yonagi）

環境音ミキサー付きポモドーロタイマー PWA。集中と休憩のリズムに、Web Audio API でリアルタイム合成する環境音（雨・波・風・風鈴・パッド・虫の音）を混ぜられる。音声ファイルは一切使わず、すべてブラウザ内で合成する。

## セットアップ

環境変数は不要。

```bash
npm i
npm run dev
```

http://localhost:3000 を開く。

## コマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド |
| `npm run typecheck` | 型チェック（tsc --noEmit） |
| `npm run lint` | Lint |

## ドキュメント

- 仕様: [docs/spec.md](docs/spec.md)
- 進捗: [docs/progress.md](docs/progress.md)
- 設計判断: [docs/decisions.md](docs/decisions.md)
- 引き継ぎ書: [docs/handoff.md](docs/handoff.md)

## リポジトリ

https://github.com/OtsukaFuuki/fable-pomodoro

## 現在の状態

Phase 3 まで実装済み。設定・音量・セッション数の永続化、分数ステッパー、背景演出が動く。残タスクは docs/handoff.md を参照。
