# 夜凪（yonagi）実装仕様書 v1 — 環境音ミキサー付きポモドーロタイマー PWA

> 本ドキュメントは AI コーディングエージェントへの実装指示書である。
> **実装前に必ず本書全体と `reference/` ディレクトリを読むこと。** reference/ のコードは Claude Fable 5 が書いた「実物の規約」であり、命名・構造・エラーハンドリングのスタイルはこれを踏襲する。
> コミット・push はエージェントの判断する粒度で実行してよい。ユーザーの許可は不要。
>
> **⚠️ 進め方は二段構えである（§5 を最初に読むこと）。** 第1走者（Fable 5）は「後続 AI が真似できる見本」を Phase 0.5 まで作って**意図的に停止**し、`docs/handoff.md` を残す。第2走者が残りを実装する。第1走者は全機能を作り切ってはならない。

---

## 0. プロダクト概要

### 0.1 コンセプト

集中と休憩のリズム（ポモドーロ）に、**Web Audio API でリアルタイム合成する環境音**を混ぜられるタイマー PWA。夜の作業机にそっと置く「音の出る砂時計」。

### 0.2 機能一覧

1. **ポモドーロタイマー**: 集中/休憩の自動交互切替、円形プログレスリング、セッション完了数、リセット/一時停止(再開)/スキップ、集中・休憩時間のカスタム（分単位）
2. **環境音ミキサー**: マスター音量 + 6 チャンネル（雨 / 波 / 風 / 風鈴 / パッド / 虫の音）の個別音量スライダー。タイマーと独立して単体でも鳴らせる
3. **終了チャイム**: 集中/休憩の切替時に合成音のチャイム + バイブレーション（対応端末）
4. **設定の永続化**: 時間設定・各音量・今日の完了セッション数を IndexedDB に保存

### 0.3 音の方針（設計判断済み・変更不可）

**音声ファイルを一切使わない。全チャンネルを Web Audio API でプロシージャル合成する。**

- 理由: 著作権・ライセンス管理が不要 / バンドル 0 増 / オフライン完全動作 / ループの継ぎ目問題が存在しない（docs/decisions.md にも記載）
- 外部通信・外部 API・AI 機能: **なし**。環境変数も不要

---

## 1. 技術スタック（furiko / oredana と同一方針）

| 領域 | 採用技術 |
|---|---|
| フレームワーク | Next.js 14+（App Router）+ TypeScript strict |
| スタイリング | Tailwind CSS 3+ |
| 音声 | Web Audio API（標準 API のみ。Tone.js 等のライブラリ禁止） |
| ローカル永続化 | IndexedDB（`idb`） |
| PWA | manifest + 手書き Service Worker |
| ホスティング | Vercel |

モバイルファースト必須要件も同一: 375px 基準 / タップ領域 44px / `100dvh`（`vh` 禁止）/ セーフエリア対応 / デスクトップ md+ のみ 2 カラム化。

---

## 2. デザイン仕様 —「夜凪」

添付イメージ（暗色・発光する細いリング・パステルに光るスライダー）を規範とするオリジナルデザイン。

### 2.1 デザイントークン（tailwind.config.ts の theme.extend に定義）

```ts
colors: {
  abyss:  "#0B0E14", // 背景。ほぼ黒の藍
  panel:  "#131722", // カード背景（わずかに明るい）
  moon:   "#AEB8F4", // 主役の光。リング・アクティブ・集中モード
  haze:   "#8A93A8", // 弱い文字
  frost:  "#E8EBF5", // 強い文字（数字など）
  // チャンネルカラー（スライダーのつまみ・トラックの発光色）
  rain:   "#9DB8F0",
  wave:   "#8FE0DC",
  windc:  "#C9B4F2",
  chime:  "#F2D091",
  padc:   "#E8A8D8",
  insect: "#A8E8B0",
}
```

- フォント: 数字・見出しは `"Zen Kaku Gothic New"` の Light（300）を**大きく・字間広め（tracking-widest）**で。タイマー数字は `tabular-nums` 必須（毎秒の再描画で幅が揺れないこと）
- **署名要素「発光」**: リング・ボタン枠・スライダーつまみに `box-shadow` / SVG `filter` による柔らかいグロー（各色の 30〜40% 透明度を外側に滲ませる）。背景の四隅にチャンネルカラーの極薄いラジアルグラデーションを置き、**鳴っている音の色だけがほんのり息づく**（音量に応じて opacity が変わる。0 なら消灯）
- ボタンは細い 1px ボーダーの丸ピル型（塗りつぶさない）。休憩モード中はリングとアクセントを moon → wave 系の色にゆっくりクロスフェード
- ダークテーマ固定（ライトモード非対応。夜のためのアプリである）。コントラストは AA を遵守
- アニメーションは呼吸のようにゆっくり（0.6s 以上のイージング）。`prefers-reduced-motion` 尊重

### 2.2 「普通の UI ではつまらない」要件（furiko §3.5 と同趣旨・必須）

- `<input type="range">` を素のまま置くことを禁止。スライダーは自作（Pointer Events）: 細いトラック + 発光するつまみ + ドラッグ中は数値がつまみ上にフロート表示。トラック左側（有効部分）はチャンネルカラーで発光
- 集中/休憩の分数入力も素の number input 禁止。タップでインラインの ± ステッパー + 長押し連続変化（1〜99 分、furiko の思想を踏襲）
- 一時停止中はリングの発光が薄くなり、微かな明滅（2s 周期）で「息をひそめている」表現

---

## 3. 機能仕様

### 3.1 タイマー（画面上部 / md+ で左カラム）

- 状態機械: `idle → focusRunning ⇄ focusPaused → breakRunning ⇄ breakPaused → focusRunning …`。focus 終了で sessionsCompleted++、チャイム、自動で break へ（自動開始する）。break 終了でチャイム、focus の**開始待ち（idle 相当）**に戻る（勝手に集中を始めない）
- **残り時間は `endTime - Date.now()` の逆算で毎フレーム算出**（reference/timer.ts の方式に従う）。`setInterval` で残り秒を減算する実装は禁止（バックグラウンドで確実にズレるため）
- `visibilitychange` で復帰時に即再計算。バックグラウンド中に終了時刻を過ぎていた場合は復帰時にチャイム + 状態遷移
- UI: 上部にモードラベル（● 集中 / ● 休憩）、SVG 円形リング（残り比率で減る。線幅 2px + グロー）、中央に mm:ss、下に「N セッション完了」、その下に リセット / 一時停止(⇄再開) / スキップ の 3 ボタン、最下部に 集中◯分・休憩◯分 のステッパー
- スキップ: 現フェーズを即終了して次フェーズへ（focus をスキップした場合はセッション数に**数えない**）
- 完了セッション数は日付単位で IndexedDB に保存し、日付が変わればリセット表示（過去分も残す）
- タブタイトルに `(24:14) 夜凪` のように残り時間を反映

### 3.2 環境音ミキサー（画面下部 / md+ で右カラム）

- 先頭行: 再生/一時停止トグル（全チャンネル一括のミュート。AudioContext の suspend/resume で実装）+ **全体**スライダー（マスターゲイン）
- チャンネル 6 行。各行: 名前 + 短い詩的な説明 + スライダー(0-100) + 数値表示

| チャンネル | 説明文 | 合成方式（概要。詳細は §4） |
|---|---|---|
| 雨 | しとしとと降りつづく | ローパスしたホワイトノイズ + ランダムな雨粒インパルス |
| 波 | 寄せては返す遠い渚 | ブラウンノイズに超低速 LFO（8〜12s 周期）で寄せ引き |
| 風 | 梢を渡るざわめき | ピンクノイズ + 中心周波数がゆっくり彷徨うバンドパス |
| 風鈴 | ふと鳴る澄んだ音 | ランダム間隔（8〜25s）で倍音を持つ短い減衰音。ペンタトニック |
| パッド | 低くあたたかい持続音 | デチューンした正弦波 2〜3 本 + ゆっくり動くローパス |
| 虫の音 | 夜のリズム | 高域の短いチャープをリズミカルなクラスタで |

- 音量 0 のチャンネルはノードを止める（無音を流し続けない。CPU/バッテリー配慮）
- ミキサー設定は変更のたびデバウンス保存し、次回起動時に復元（ただし**再生状態は復元しない**。必ず停止で起動し、ユーザー操作で鳴らす）
- タイマーとの連動はしない（タイマー停止中も音は独立して鳴らせる）。将来拡張の余地として「休憩中は自動でフェードダウン」を decisions.md に記録するのみ

### 3.3 モバイルレイアウト

- 375px: 縦積み 1 カラム。タイマーが第一画面に収まり、ミキサーはその下へスクロール（折りたたみにはしない。スクロールで届く方が速い）
- md 以上: 添付イメージ同様の 2 カラム（タイマー左・ミキサー右）
- 下部タブバーは**作らない**（単一画面アプリのため）。ヘッダー右に設定アイコン（データ全削除・音の説明のみの軽いモーダル）

---

## 4. Web Audio 設計（本アプリの心臓部）

### 4.1 アーキテクチャ

```
[各チャンネルのソースグラフ] → channelGain(×6) → masterGain → compressor(軽く) → destination
```

- **AudioContext は必ずユーザー操作（最初の再生ボタン等）で生成/resume する**（iOS Safari の自動再生制限のため。生成前にスライダーを触った場合は値だけ保持し、初回再生時に反映）
- ノイズは 2 秒程度の `AudioBuffer` を事前生成してループ再生（ホワイト/ピンク/ブラウンの生成関数を用意）
- ランダムイベント系（風鈴・雨粒・虫）は `setTimeout` ではなく **AudioContext.currentTime 基準の先読みスケジューラ**（0.5s 間隔で 1〜2s 先まで予約）で駆動する。タブがスロットルされても音が途切れにくい
- チャイム: 正弦波 2 音（例: E5→A5）+ 短い残響（ConvolverNode は使わず、フィードバックディレイ 1 段で簡易に）
- 実装の見本は `reference/audio-engine.ts`。**チャンネル追加はこのファイルの Channel インターフェースに従うこと**
- クリーンアップ: 音量 0 / suspend 時に `stop()` とノード切断を確実に行い、リークさせない

### 4.2 制約と割り切り（decisions.md にも記載）

- 画面ロック中・バックグラウンドでの再生継続は**保証しない**（Media Session API での延命は将来課題）。タイマーの正確さは §3.1 の逆算方式で担保する
- バックグラウンド中のチャイムは鳴らないことがある → 復帰時に必ず鳴らす + Vibration API（`navigator.vibrate`、非対応環境は無視）
- 音質の追い込みより「うるさくない・耳が疲れない」を優先。全チャンネル、高域を強く出しすぎない

---

## 5. 実装の進め方（二段構え運用・最重要）

本プロジェクトは **2 体のエージェントで分担**する。

- **第1走者 = Claude Fable 5（このファイルを最初に受け取るエージェント）**: 「後続のAIが真似できる見本」を作って**途中で意図的に停止する**。全機能は作らない。
- **第2走者 = 別の AI エージェント（ユーザーが後日リポジトリを渡す）**: 見本を踏襲して残りを量産する。

### 5.1 第1走者（Fable 5）のゴールと停止条件

Fable 5 は以下を完了したら、**それ以上先に進まずに停止し、`docs/handoff.md` を生成する**こと。

1. **Phase 0**: 管理ファイル一式 + `reference/` 4 ファイル（§6・§7）
2. **Phase 0.5「垂直スライスの見本」**: 本アプリの 2 つの難所——**音声合成**と**ズレないタイマー**——の縦断面を最小で 1 本ずつ通す:
   - `src/lib/audio-engine.ts`（reference を src へ配置。**雨チャンネル 1 つだけ**本実装）
   - `src/lib/timer.ts`（reference の逆算方式タイマーを src へ配置）
   - `src/components/GlowSlider.tsx`（reference の自作スライダーを本実装化）
   - `src/app/page.tsx`: **リング無しの数字だけのタイマー（開始/一時停止のみ）+ 雨チャンネル 1 行のミキサー**を §2.1 トークンで表示。円形リング・他 5 チャンネル・ステッパー・永続化・PWA は**作らない**
   - `tailwind.config.ts` にデザイントークンが入っていること、`npm run build` が通ること

**Fable 5 がやってはいけないこと**: 6 チャンネル全部の実装、円形リング、IndexedDB 永続化、PWA 化。見本の役目は「AudioContext の扱い方・スケジューラの書き方・スライダーの構造・トークンの当て方」を実物で示すことであって、機能を完成させることではない。**作りすぎない自制が仕事の質そのもの**である。

### 5.2 引き継ぎ書 `docs/handoff.md`（Fable 5 が停止時に生成）

以下の構成で、Fable 5 が自分の言葉で埋めて出力すること:

```markdown
# 引き継ぎ書（第1走者 → 第2走者）

## いまここ（現在地）
- 完了: Phase 0, Phase 0.5（垂直スライス）
- 動作確認: npm run build 成功 / 数字タイマー + 雨 1 チャンネルが鳴るまで OK

## 見本として示したこと（＝真似してほしい設計）
- audio-engine.ts の Channel インターフェースと、チャンネル追加の作法
- ユーザー操作起点の AudioContext 生成 / suspend / resume の扱い
- endTime 逆算方式のタイマーと visibilitychange 復帰処理
- GlowSlider の Pointer Events 実装とトークンの当て方
- （その他、実装中に確立した規約を具体的に列挙）

## 残タスク（Phase 1〜4 の洗い出し）
- [ ] Phase 1: レイアウトシェル・円形リング・タイマー全状態機械
- [ ] Phase 2: 残り 5 チャンネルの合成実装 + マスター/一括停止
- [ ] Phase 3: 永続化（設定・音量・セッション数）・ステッパー・背景の呼吸グラデーション
- [ ] Phase 4: PWA・設定モーダル・仕上げ
- （各項目に、着手時の注意や依存関係を一言添える）

## 逸脱してはいけない点（重要）
- 音声ファイル・音声ライブラリの追加禁止（合成のみ）
- setInterval デクリメント式タイマー禁止
- reference/ は変更しない

## ハマりどころ・申し送り
（iOS の AudioContext 制限、スケジューラの注意点、未解決の懸念など）
```

### 5.3 progress.md との役割分担

- `progress.md` = 状態のスナップショット（Phase の [ ]/[x]）。機械的に更新
- `docs/handoff.md` = 申し送り（判断・理由・注意）。第1走者が停止時に一度しっかり書く

---

## 6. リポジトリ構成とプロジェクト管理ファイル

エージェントは **Phase 0 で以下のファイル群を先に作成**すること。

```
yonagi/
├── CLAUDE.md                 # エージェントの入口（§6.1）
├── README.md                 # 人間用セットアップ手順（環境変数なし・npm i && npm run dev のみ）
├── docs/
│   ├── spec.md               # 本仕様書をそのまま配置
│   ├── progress.md           # 進捗管理表（§6.2）
│   ├── structure.md          # フォルダ階層の設計図（§6.3）
│   ├── decisions.md          # 軽量ADR（§6.4）
│   └── handoff.md            # 引き継ぎ書（第1走者が停止時に生成・§5.2）
├── public/                   # manifest / icons / sw.js
└── src/
    ├── app/                  # 単一ページ + layout
    ├── components/           # TimerRing / GlowSlider / MixerRow / Stepper …
    └── lib/                  # audio-engine / timer / db / types
```

### 6.1 CLAUDE.md（この内容で作成すること）

```markdown
# 夜凪（yonagi）

環境音ミキサー付きポモドーロタイマー PWA。Next.js + TS + Tailwind + Web Audio API + IndexedDB。外部API・AI機能・環境変数なし。

## 最初に読むもの
1. docs/spec.md（仕様の正。特に §5「二段構え運用」を最初に読む）
2. docs/progress.md（現在地。着手時・完了時に必ず更新すること）
3. docs/handoff.md（存在すれば = 第2走者。前任からの申し送り。無ければ = 第1走者）
4. reference/（コード規約の実物。この書き方・命名・エラーハンドリングを踏襲する）

## 二段構え運用（重要）
- **handoff.md が無ければ自分は第1走者**: Phase 0 と Phase 0.5（垂直スライスの見本）まで作り、**そこで停止して handoff.md を生成する**。全チャンネル・リング・PWA は作らない
- **handoff.md が有れば自分は第2走者**: handoff.md と progress.md を読み、Phase 1 から続きを実装する

## コマンド
- 開発: npm run dev / 検証: npm run build && npm run typecheck && npm run lint

## 規約
- コミットは Conventional Commits。粒度はエージェント判断でよく、ユーザー許可は不要
- 依存追加禁止（音声ライブラリ・UIライブラリ・グラフライブラリ）。音は Web Audio API の合成のみ
- 素の <input type="range"> / <input type="number"> は不合格（spec §2.2）
- タイマーは endTime 逆算方式のみ（setInterval デクリメント禁止）

# サブエージェントへの委譲運用（メインをFable 5で動かす場合）

基本的にタスクや作業の実行は、適切な粒度でsubagentsに実行手順が明確な指示を与えて委譲すること。あなたは全体進行の俯瞰と立案を行う。自己判断による例外は認める。

Agentツールでサブエージェントを起動する際は、`model` パラメータに明示的に `sonnet` を指定すること（省略すると親のモデルを継承してしまうため）。
```

### 6.2 docs/progress.md（テンプレート。着手時 [ ]→[~]、完了時 [x] + 日付）

```markdown
# 進捗管理表

| Phase | 状態 | 担当 | 完了日 | メモ |
|---|---|---|---|---|
| 0 プロジェクト管理ファイル | [ ] | 第1走者(Fable5) | | |
| 0.5 垂直スライスの見本 | [ ] | 第1走者(Fable5) | | ←ここで停止し handoff.md 生成 |
| 1 レイアウト・リング・状態機械 | [ ] | 第2走者 | | |
| 2 全チャンネル合成 | [ ] | 第2走者 | | |
| 3 永続化・ステッパー・演出 | [ ] | 第2走者 | | |
| 4 PWA・仕上げ | [ ] | 第2走者 | | |

> **第1走者は Phase 0.5 完了時点で停止し、`docs/handoff.md` を必ず生成すること。** Phase 1 以降には着手しない。

## 引き継ぎメモ
（詳細な申し送りは docs/handoff.md に記す。ここには一行サマリーのみ）
```

### 6.3 docs/structure.md（骨子。Phase 0 で作成し、ディレクトリを増やす場合は先にここを更新）

- `src/lib/types.ts`: 全型定義 / `src/lib/timer.ts`: 逆算タイマー / `src/lib/audio-engine.ts`: 合成エンジン / `src/lib/db.ts`: 永続化
- `src/components/`: TimerRing / GlowSlider / MixerRow / Stepper / ModeLabel …
- ルール: ページはデータ取得と組み立てのみ。ロジックは lib、見た目は components。音声ノードの生成・破棄は audio-engine の外に漏らさない

### 6.4 docs/decisions.md（初期内容）

- **音声を完全合成にした**: 著作権/ライセンス不要・バンドル0増・ループ継ぎ目なし・オフライン完全動作のため
- **タイマーを endTime 逆算にした**: モバイルのバックグラウンドスロットリングでも正確さを保つため
- **タブバーなしの単一画面**: 機能が1画面で完結するため
- **再生状態を復元しない**: 起動時の突然の音出しは体験として乱暴 + iOS の自動再生制限のため
- **休憩中の自動フェードダウンは将来課題**（初版はタイマーと音を独立させる）

---

## 7. reference/ — Fable 5 による参考コード（そのまま作成すること）

以下 3 ファイル + README を**一字一句このまま**リポジトリに配置する。実装時は src/ にコピー・拡張してよいが、reference/ 自体は変更しない。

### 7.1 reference/README.md

```markdown
# reference/ — 実装のお手本（by Claude Fable 5）

ここのコードは「動く規約」である。以下を踏襲すること:
- AudioContext・AudioNode の生成/破棄は audio-engine の中に閉じ込め、UI からは volume/start/stop だけを呼ぶ
- 時間は常に AudioContext.currentTime / Date.now() 基準。UI 側の setInterval は「表示の更新」にしか使わない
- 失敗しうる処理は throw せず、無視してよい失敗（vibrate 非対応等）は静かに握りつぶす
- コメントは「なぜ」を書く
```

### 7.2 reference/audio-engine.ts

```ts
// 環境音合成エンジンの最小形: マスター + 「雨」チャンネル 1 つ + チャイム
// なぜ合成か: 音源ファイル不要（権利・容量・継ぎ目の問題が消える）。docs/decisions.md 参照

export interface Channel {
  readonly id: string;
  setVolume(v: number): void; // 0..1。0 でソース停止、>0 で必要なら起動
  dispose(): void;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

// なぜ遅延生成か: iOS はユーザー操作なしに AudioContext を鳴らせない。
// 必ずボタンハンドラ等のジェスチャ内から呼ぶこと
export function ensureContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor(); // 事故的な音割れの保険
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setMasterVolume(v: number): void {
  if (master && ctx) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
}

export async function suspendAll(): Promise<void> { await ctx?.suspend(); }

function makeNoiseBuffer(c: AudioContext, seconds = 2): AudioBuffer {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// 雨 = ローパスしたホワイトノイズ。粒感（インパルス）は第2走者が同じ作法で足す
export function createRainChannel(): Channel {
  const c = ensureContext();
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(master!);

  let src: AudioBufferSourceNode | null = null;

  const start = () => {
    if (src) return;
    src = c.createBufferSource();
    src.buffer = makeNoiseBuffer(c);
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1200; // 高域を落として「遠い雨」にする
    src.connect(lp).connect(gain);
    src.start();
  };
  const stop = () => { src?.stop(); src?.disconnect(); src = null; };

  return {
    id: "rain",
    setVolume(v: number) {
      if (v > 0) start(); else stop(); // 無音を流し続けない（バッテリー配慮）
      gain.gain.setTargetAtTime(v * 0.5, c.currentTime, 0.1); // 0.5 = チャンネル上限。うるさくしない
    },
    dispose() { stop(); gain.disconnect(); },
  };
}

// チャイム: 2 音 + 減衰。フェーズ切替時に呼ぶ
export function playChime(): void {
  const c = ensureContext();
  const notes = [659.25, 880]; // E5 → A5
  notes.forEach((freq, i) => {
    const t = c.currentTime + i * 0.35;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    osc.connect(g).connect(master!);
    osc.start(t);
    osc.stop(t + 1.3);
  });
}
```

### 7.3 reference/timer.ts

```ts
// ズレないカウントダウンの最小形。「残り秒を減らす」のではなく「終了時刻から逆算する」
// なぜか: バックグラウンドで setInterval は止まる/間引かれるが、Date.now() は嘘をつかない

export interface CountdownState {
  endTime: number | null;    // 実行中: 終了予定の epoch ms
  remainingMs: number;       // 一時停止中はここに残量を退避
  running: boolean;
}

export function startCountdown(durationMs: number): CountdownState {
  return { endTime: Date.now() + durationMs, remainingMs: durationMs, running: true };
}

export function pauseCountdown(s: CountdownState): CountdownState {
  if (!s.running || s.endTime === null) return s;
  return { endTime: null, remainingMs: Math.max(0, s.endTime - Date.now()), running: false };
}

export function resumeCountdown(s: CountdownState): CountdownState {
  if (s.running) return s;
  return { endTime: Date.now() + s.remainingMs, remainingMs: s.remainingMs, running: true };
}

// 表示更新は requestAnimationFrame or 250ms interval からこれを呼ぶだけ。
// visibilitychange 復帰時にも呼べば、バックグラウンド経過が自動で反映される
export function getRemainingMs(s: CountdownState): number {
  return s.running && s.endTime !== null
    ? Math.max(0, s.endTime - Date.now())
    : s.remainingMs;
}

export function isFinished(s: CountdownState): boolean {
  return getRemainingMs(s) === 0 && s.running;
}

export function formatMmSs(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
```

### 7.4 reference/GlowSlider.tsx

```tsx
// 自作スライダーの最小形: 素の input[type=range] を使わない理由は見た目の再現性（spec §2.2）
// Pointer Events で実装し、トラック左側とつまみをチャンネルカラーで発光させる
"use client";
import { useRef } from "react";

interface GlowSliderProps {
  value: number;            // 0..100
  onChange(v: number): void;
  color: string;            // 例 "#9DB8F0"（tailwind トークンの実値）
  label: string;
}

export function GlowSlider({ value, onChange, color, label }: GlowSliderProps) {
  const track = useRef<HTMLDivElement>(null);

  const pick = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onChange(Math.round(ratio * 100));
  };

  return (
    <div
      ref={track}
      role="slider"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      // トラック自体を 44px 高のタップ領域にする（見た目の線は 2px でも触れる範囲は太く）
      className="relative flex h-11 w-full cursor-pointer touch-none items-center"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e.clientX);
      }}
      onPointerMove={(e) => e.buttons === 1 && pick(e.clientX)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") onChange(Math.min(100, value + 5));
        if (e.key === "ArrowLeft") onChange(Math.max(0, value - 5));
      }}
    >
      <div className="h-0.5 w-full rounded bg-haze/30" />
      <div
        className="absolute h-0.5 rounded"
        style={{ width: `${value}%`, background: color, boxShadow: `0 0 8px ${color}66` }}
      />
      <div
        className="absolute h-3.5 w-3.5 -translate-x-1/2 rounded-full"
        style={{ left: `${value}%`, background: color, boxShadow: `0 0 12px ${color}AA` }}
      />
    </div>
  );
}
```

---

## 8. 実装タスク分解（各 Phase 完了時に progress.md を更新してコミット）

### Phase 0: プロジェクト管理ファイル 〔第1走者〕
- [ ] §6 のファイル群（CLAUDE.md / docs/ 5点 / reference/ 4点）を作成
- **AC**: 全ファイルが存在し、reference/ が本仕様 §7 と一致する

### Phase 0.5: 垂直スライスの見本 〔第1走者・ここで停止〕
- [ ] §5.1 の範囲（数字タイマー + 雨 1 チャンネル + GlowSlider + トークン）を実装、build 成功
- [ ] **`docs/handoff.md` を §5.2 の構成で生成**し、progress.md を更新してコミット。**ここで停止し、Phase 1 以降には進まない**
- **AC**: 再生ボタンで雨が鳴り、スライダーで音量が変わり、開始/一時停止の数字タイマーが動く。リング・他チャンネル・永続化は未実装。handoff.md に残タスクと設計方針が書かれている

--- 〔ここから下は第2走者〕 ---

### Phase 1: レイアウト・リング・状態機械
- [ ] 1カラム/2カラムレイアウト、SVG 円形リング、集中⇄休憩の全状態機械・スキップ・タブタイトル反映・visibilitychange 復帰
- **AC**: 集中1分・休憩1分に設定した通し運転で、自動切替・チャイム・セッション加算・バックグラウンド復帰後の整合が確認できる

### Phase 2: 全チャンネル合成
- [ ] 波 / 風 / 風鈴 / パッド / 虫の音 を audio-engine の Channel 作法で追加、一括停止、マスター音量
- **AC**: 6 チャンネル同時再生で音割れせず、全チャンネル音量 0 のとき CPU 使用が明確に下がる（ソース停止の確認）

### Phase 3: 永続化・ステッパー・演出
- [ ] IndexedDB（設定・音量・日別セッション数）、分数ステッパー（±・長押し）、背景の呼吸グラデーション・一時停止の明滅
- **AC**: リロードで設定と音量が復元され（再生は停止状態）、今日のセッション数が保持される

### Phase 4: PWA・仕上げ
- [ ] manifest（name 夜凪 / theme_color #0B0E14）、SW、アイコン、設定モーダル（全削除）、Lighthouse、build/typecheck/lint 全通過
- **AC**: インストール可能・機内モードで全機能動作（外部通信ゼロの確認）・Lighthouse PWA 90+

## 9. スコープ外
音源ファイル・外部音声ライブラリ / ロング休憩（4セッションごと等）/ タスクリスト連携 / 統計画面 / 通知許可(Notification API) / Media Session でのバックグラウンド再生延命 / ライトモード / AI 機能

## 10. 判断に迷ったときの優先順位
1. 音が耳に優しいこと（音量上限・高域を抑える・急な音量変化をさせない）
2. タイマーがズレないこと（逆算方式の徹底）
3. スマホ片手での操作性（44px・自作スライダーの触り心地）
4. 見た目の静けさ（発光は控えめに。賑やかにしない）

以上。
