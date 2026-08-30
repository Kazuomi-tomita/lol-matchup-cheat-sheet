# LoL Matchup Viewer

LoLの試合中に、レーン対面のAA射程・スキル射程・危険コンボ射程・主要CDを素早く確認するWindowsデスクトップアプリです。

## 開発

```bash
npm install
npm run dev
```

Windowsでは `debug.cmd` をダブルクリックしてもデバッグ起動できます。デバッグ中は開発者ツールも自動的に開きます。画面やCSSの変更は再インストールなしで反映されます。停止するにはデバッグ用のコマンド画面で `Ctrl+C` を押します。

試合外では `Waiting for game...` と表示します。試合中はローカルの Live Client Data API (`https://127.0.0.1:2999`) を2秒ごとに確認します。対面を特定できない場合は敵チャンピオンを手動選択できます。

## ビルド

```bash
npm run build
```

Windowsインストーラーは `release/` に生成されます。利用者側にNode.jsは不要です。

## データ構成

- `data/raw/`: 取得元に近いデータ
- `data/champions/`: UIで使う正規化済みの客観データ
- `data/matchup-meta/`: key cooldownやdanger comboなど、人間による意味付け

現在同梱している Ahri / Syndra はスキーマと画面確認用のサンプルです。実運用前に対象パッチの値へ更新してください。`matchup-meta` は自動正規化の対象にせず、機械更新から保護します。

日本語クライアントが返すローカライズ済みチャンピオン名は、各チャンピオンJSONの `aliases` で英語IDへ対応付けます。
