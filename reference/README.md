# reference/ — 実装のお手本（by Claude Fable 5）

ここのコードは「動く規約」である。以下を踏襲すること:
- AudioContext・AudioNode の生成/破棄は audio-engine の中に閉じ込め、UI からは volume/start/stop だけを呼ぶ
- 時間は常に AudioContext.currentTime / Date.now() 基準。UI 側の setInterval は「表示の更新」にしか使わない
- 失敗しうる処理は throw せず、無視してよい失敗（vibrate 非対応等）は静かに握りつぶす
- コメントは「なぜ」を書く
