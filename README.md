# LoL Matchup Viewer

LoLの試合中に、レーン対面のAA射程・スキル射程・危険コンボ射程・主要CDを素早く確認するWindowsデスクトップアプリです。

表示するCDは、同梱データに記録された静的な基礎CDです。敵プレイヤーがスキルを使用した時刻や、現在の残りCDを追跡するものではありません。

## このツールがしないこと

- 敵のスキル使用や残りCDをリアルタイム追跡しません。
- ゲーム内でプレイヤーに公開されていない情報を取得・表示しません。
- 操作、ビルド、戦術などの意思決定を自動化しません。
- League of Legendsのプロセス、メモリ、通信内容を改変しません。
- プレイヤー情報や試合情報を外部サーバーへ送信しません。

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

Windowsインストーラーは `release/LoL-Matchup-Viewer-Setup-<version>.exe` に生成されます。
配布時はこの `.exe` だけを渡せばよく、利用者側にNode.jsは不要です。

## データ構成

- `data/raw/`: 取得元に近いデータ
- `data/champions/`: UIで使う正規化済みの客観データ
- `data/matchup-meta/`: key cooldownやdanger comboなど、人間による意味付け

現在同梱している Ahri / Syndra はスキーマと画面確認用のサンプルです。実運用前に対象パッチの値へ更新してください。`matchup-meta` は自動正規化の対象にせず、機械更新から保護します。

League of Legends Wiki から全チャンピオンの基本攻撃射程と Q/W/E/R の射程・CDなどを同期できます。

```bash
npm run sync:champions
```

取得した Wiki 原文はローカルの `data/raw/lol-wiki/` にキャッシュされます。このキャッシュはGit管理および配布物の対象外です。再取得する場合は `npm run sync:champions -- --refresh` を使います。同期処理は `data/matchup-meta/` を変更しません。

日本語クライアントが返すローカライズ済みチャンピオン名は、各チャンピオンJSONの `aliases` で英語IDへ対応付けます。

## ライセンスと第三者コンテンツ

このプロジェクト独自のソースコードとドキュメントは [MIT License](LICENSE) で公開します。League of Legendsに関する名称、商標、ゲームデータなどの第三者コンテンツはMIT Licenseの対象ではありません。詳細は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照してください。

## Riot Developer Portalへの登録方針

このリポジトリのソースコード公開と、プレイヤー向けバイナリの一般配布を分けて扱います。一般配布を開始する前にRiot Developer Portalへ製品を登録し、説明とメタデータを実際の機能に合わせて維持します。本ツールは、試合前から確認可能な静的ゲームデータを表示する補助ツールとして登録する方針です。

## Legal notice

LoL Matchup Viewer isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
