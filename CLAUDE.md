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
