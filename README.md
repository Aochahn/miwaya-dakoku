# MIWAYA 勤怠打刻アプリ

MIWAYA向けのPHP/MySQL製の勤怠打刻アプリです。スタッフのPINログイン、出退勤打刻、写真記録、管理画面での勤怠確認、修正申請、シフト管理、週間シフト自動編成を備えています。

## 主な機能

- スタッフ選択 + PINコードによる本人確認
- 出勤・退勤打刻
- 出勤後3時間の二重出勤打刻防止
- 出勤時の写真撮影・保存
- スタッフ別マイページとシフト確認
- 管理者ログイン
- 勤怠一覧表示とCSV出力
- スタッフ追加、PIN変更、表示順変更
- スタッフのアーカイブ、復帰、引き継ぎメモ管理
- 打刻修正申請と管理者承認/却下
- 監査ログ
- 手動シフト登録、編集、削除
- 週間シフト自動編成

## ディレクトリ構成

```text
lolipop-public/
  index.php              # 打刻画面
  admin.php              # 管理画面
  app.js                 # 画面ロジック
  styles.css             # スタイル
  api/                   # API
  private/               # DB設定・schema・migration
  storage/photos/        # 打刻写真保存先
docs/                    # 環境構築メモ
scripts/                 # ローカル確認・Local反映スクリプト
```

ロリポップへアップロードする場合は、`lolipop-public` フォルダそのものではなく、`lolipop-public` の中身を公開ディレクトリへ配置します。

## 初期ログイン

管理画面:

```text
/admin.php
```

初期管理者:

```text
ユーザー名: admin
パスワード: admin1234
```

初期スタッフPIN:

```text
0000
```

本番運用前に、管理者パスワードと各スタッフPINを必ず変更してください。

## DBセットアップ

本番DBには以下のSQLを順番に適用します。

```text
lolipop-public/private/migrations/001_security_workflow.sql
lolipop-public/private/migrations/002_member_shifts.sql
lolipop-public/private/migrations/003_shift_scheduler_preferences.sql
lolipop-public/private/migrations/004_staff_archive_fields.sql
```

新規構築の場合は `lolipop-public/private/schema.sql` を利用できます。

## 設定ファイル

本番DB接続情報は以下に配置します。

```text
lolipop-public/private/config.php
```

このファイルは機密情報を含むため、Git管理対象外です。  
雛形は以下を参照してください。

```text
lolipop-public/private/config.sample.php
lolipop-public/private/config.local.sample.php
```

## 注意

`health.php` は診断用ページです。DB接続やテーブル状態を表示するため、本番確認後は削除するかアクセス制限をかけてください。
