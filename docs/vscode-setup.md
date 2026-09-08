# VS Code セットアップ

このプロジェクトは PHP + MySQL の勤怠アプリです。
VS Code では、Local by Flywheel に同梱されている PHP を使って構文チェックできるようにしています。

## 推奨拡張

VS Codeでこのフォルダを開くと、次の拡張機能のインストールを促されます。

- PHP Intelephense
- PHP Debug
- PHP DocBlocker
- EditorConfig
- ESLint

最低限必要なのは PHP Intelephense です。
この環境では `code` コマンドが見つからなかったため、拡張機能の自動インストールは行っていません。
VS Codeでこのフォルダを開いたときに表示される推奨からインストールしてください。

## 使えるタスク

`Terminal` > `Run Task...` から実行できます。

- `PHP: syntax check all`
  - `lolipop-public` 配下のPHP構文チェックを実行します。
- `Local: deploy app files`
  - 開発側の `lolipop-public` を Local by Flywheel の `app/public` へ反映します。
- `Local: check health`
  - Localの `/health.php`、ユーザーAPI、管理API保護を確認します。
- `Local: open app`
  - `http://dakoku-app.local` を開きます。
- `Local: open admin`
  - `http://dakoku-app.local/admin.php` を開きます。
- `Local DB: apply security migration`
  - 認証・PIN・修正申請・監査ログ用マイグレーションを適用します。
- `Local DB: apply shifts migration`
  - スタッフシフト管理用マイグレーションを適用します。

## Xdebug

`.vscode/launch.json` に `Listen for Local Xdebug` を追加しています。
Local by Flywheel 側で Xdebug を有効化してから、VS Codeの `Run and Debug` でこの設定を起動してください。

ブレークポイントを置く対象は、このリポジトリ側の `lolipop-public` 配下です。

## 初期ログイン情報

```text
管理者ユーザー名: admin
管理者パスワード: admin1234
スタッフ初期PIN: 0000
```

管理画面に入ったら、まず管理者パスワードとスタッフPINを変更してください。

## 注意

VS Codeで編集する元ファイルは、このリポジトリ側の `lolipop-public` です。
編集後に `Local: deploy app files` を実行すると、Local by Flywheel側へ反映されます。
