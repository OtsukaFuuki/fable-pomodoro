# 引き継ぎ書（第1走者 → 第2走者）

作成: 2026-07-06 / 第1走者: Claude Fable 5

## いまここ（現在地）

- 完了: Phase 0（管理ファイル + reference/）、Phase 0.5（垂直スライスの見本）
- 動作確認: `npm run build` / `npm run typecheck` / `npm run lint` すべて成功。本番サーバーを起動して HTML の描画（タイマー・ミキサー・スライダー）まで確認済み
- **音の実耳確認はしていない**（ヘッドレス環境のため）。着手前に `npm run dev` で「再生 → 雨が鳴る → スライダーで音量が変わる → 一時停止で止まる」を一度確かめてから進むこと
- スタック実績: Next.js 15.5 / React 19 / Tailwind 3.4 / TypeScript strict

## 見本として示したこと（＝真似してほしい設計）

- **Channel インターフェースとチャンネル追加の作法**（`src/lib/audio-engine.ts`）: AudioNode の生成・破棄はチャンネル内に閉じ込め、外には `setVolume` / `dispose` だけを見せる。音量 0 でソース停止（無音を流し続けない）。チャンネルゲインに上限係数を掛けてうるさくしない（雨は 0.5）
- **ユーザー操作起点の AudioContext**: `ensureContext()` は必ずボタンハンドラ等のジェスチャ内から呼ぶ。生成前にスライダーを触られた場合は React 側で値だけ保持し、初回再生時に `setVolume` で反映する（`page.tsx` の `togglePlay` 参照）。一括停止は `AudioContext.suspend`
- **先読みスケジューラ**（雨粒インパルス）: `setTimeout` で直接鳴らさず、0.5s ごとの tick で `AudioContext.currentTime` 基準の発音時刻を約 1.5s 先まで予約する。スロットル明けは `nextDropAt` を `currentTime` に追いつかせてから予約する。風鈴・虫の音もこの作法で書くこと
- **endTime 逆算タイマー + visibilitychange**（`src/lib/timer.ts` + `page.tsx`）: interval は表示の再描画にしか使わない。残り時間は常に `getRemainingMs` で逆算。`visibilitychange` 復帰時に即再計算する
- **GlowSlider**（`src/components/GlowSlider.tsx`）: Pointer Events + `setPointerCapture`。トラック自体を 44px のタップ領域にし、ドラッグ中はつまみ上に数値をフロート表示。キーボード（← →）対応。`role="slider"` + aria 属性を忘れない
- **トークンの当て方**: 色は `tailwind.config.ts` の `theme.extend.colors` のみを使う。発光は box-shadow の「色 + `66`/`AA` の 8 桁 hex」。数字は `font-light` + `tabular-nums` + `tracking-widest`。ボタンは塗らない丸ピル（1px ボーダー + 発光）。`min-h-dvh` を使う（`vh` 禁止）

## 残タスク（Phase 1〜4 の洗い出し）

- [ ] **Phase 1: レイアウトシェル・円形リング・タイマー全状態機械**
  - `page.tsx` の仮タイマー（0 で止まるだけ）を `idle → focusRunning ⇄ focusPaused → breakRunning ⇄ breakPaused → …` の状態機械で置き換える。break 終了後は自動で focus を始めない（開始待ちに戻す）。focus スキップはセッション数に数えない
  - チャイムは `playChime()` が既にあるが、spec §4.1 の「フィードバックディレイ 1 段の残響」が未実装なので足すこと。バックグラウンド中に終了していた場合は復帰時にチャイム + `navigator.vibrate`（非対応は無視）
  - md+ で 2 カラム化、SVG リング（線幅 2px + グロー、休憩中は moon → wave にクロスフェード）、タブタイトルに残り時間
- [ ] **Phase 2: 残り 5 チャンネルの合成 + マスター/一括停止**
  - ピンク/ブラウンノイズの生成関数を `makeNoiseBuffer` の隣に足す。風鈴（ペンタトニック・8〜25s 間隔）と虫の音はスケジューラ作法を流用
  - ミキサー行が 6 本になるので `MixerRow` コンポーネントに抽出する（いまは page.tsx に 1 行直書き）。先頭行に一括再生/停止 + マスタースライダー（`setMasterVolume` は実装済み）
  - AC の「全チャンネル音量 0 で CPU が下がる」はソース停止の作法を守れば自然に満たせる
- [ ] **Phase 3: 永続化・ステッパー・演出**
  - IndexedDB は `idb` を依存に追加してよい（spec §1 が明示採用している唯一の追加依存。CLAUDE.md の「依存追加禁止」は音声/UI/グラフライブラリの話）
  - 再生状態は復元しない（docs/decisions.md）。保存はデバウンス。セッション数は日付キーで保存
  - 分数ステッパー（± + 長押し連続変化、1〜99 分）、背景四隅の呼吸グラデーション（鳴っているチャンネルの色だけ点く）、一時停止中のリング明滅（2s 周期）。`prefers-reduced-motion` を尊重
- [ ] **Phase 4: PWA・仕上げ**
  - manifest（name 夜凪 / theme_color #0B0E14）、手書き SW、アイコン、設定モーダル（データ全削除 + 音の説明）
  - next/font が Google Fonts をビルド時に自己ホストするので機内モード要件は満たせるはず。Lighthouse で最終確認を

## 逸脱してはいけない点（重要）

- 音声ファイル・音声ライブラリの追加禁止（Web Audio API の合成のみ）
- setInterval デクリメント式タイマー禁止（endTime 逆算のみ）
- reference/ は変更しない（tsconfig の typecheck 対象に入っているので、コンパイルが通る状態は保たれる）
- 素の `<input type="range">` / `<input type="number">` 禁止（GlowSlider / ステッパーを使う）
- 追加してよい依存は `idb` のみ

## ハマりどころ・申し送り

- **iOS の AudioContext**: 生成も resume も必ずユーザージェスチャ内で。Phase 1 でタイマー終了時の自動チャイムを入れるとき、ユーザーが一度も音に触れていないと鳴らない可能性がある。「復帰時に鳴らす + vibrate」の二段構え（spec §4.2）を必ず入れること
- **`exponentialRampToValueAtTime` は 0 を扱えない**: 0.0001 から始めて 0.0001 に戻す（`scheduleDrop` 参照）。0 を渡すと例外で音が止まる
- **suspend 中もチャンネル内の setInterval は動き続ける**が、`currentTime` が止まるので予約は horizon で頭打ちになりリークしない。Phase 2 の一括停止 UI で長時間 suspend を想定するなら、チャンネルごと `stop()` まで落とすかは判断してよい
- **GlowSlider の onPointerMove は `e.buttons === 1` で判定**している。マルチタッチ（2 本目の指）の挙動は未検証
- **tabular-nums は必須**（毎秒の再描画で数字幅が揺れる）。新しい数字表示を作るたびに忘れず付けること
- `next lint` は Next 16 で削除予定の deprecation 警告が出るが動く。移行するかは第2走者の判断でよい
- 雨粒の音量・密度（`0.12 + Math.random() * 0.5` 間隔、ゲイン 0.12〜0.20）は耳で聴いて調整していない暫定値。実耳確認時に「うるさくない」方向へ調整してよい（spec §10-1 が最優先）
