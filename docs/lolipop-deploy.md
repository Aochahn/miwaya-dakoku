# ロリポップ公開手順

## 前提

- プラン: ライト
- 公開先: 独自ドメインのサブドメイン
- 実装方式: PHP + MySQL
- カメラ利用: HTTPS必須
- 現在の前提: サブドメインのSSLは有効化済み

## 1. ロリポップ側で行うこと

1. サブドメインを作成する
2. サブドメインの公開フォルダを決める
3. 独自SSLを有効にする
4. PHPを有効にする
5. MySQLデータベースを作成する

## 2. DBを作成する

ロリポップ管理画面またはphpMyAdminで、`lolipop-public/private/schema.sql` のSQLを実行します。

## 3. 設定ファイルを作る

`lolipop-public/private/config.sample.php` をコピーして `config.php` にリネームし、ロリポップのMySQL情報を入力します。

必要な値:

- DBホスト名
- DB名
- DBユーザー名
- DBパスワード
- 必要に応じて `max_photo_bytes` / `max_request_bytes`

## 4. アップロードする

サブドメインの公開フォルダへ `lolipop-public` の中身をアップロードします。

アップロード対象:

- `index.php`
- `admin.php`
- `health.php`
- `.htaccess`
- `app.js`
- `styles.css`
- `api/`
- `private/config.php`
- `storage/photos/`

`config.sample.php` はアップロードしなくても構いません。

`.htaccess` は隠しファイルのため、FTPソフト側で隠しファイル表示を有効にしてアップロードしてください。

## 5. パーミッション

写真保存先の `storage/photos/` はPHPから書き込める必要があります。

まずは `755` で試し、保存できない場合のみロリポップ推奨の値に調整してください。

## 6. 公開後の確認

- `http://サブドメイン/` にアクセスすると `https://サブドメイン/` へリダイレクトされる
- `https://サブドメイン/health.php` で PHP / DB / 写真フォルダが OK になる
- `https://サブドメイン/` でスタッフ一覧が表示される
- `https://サブドメイン/admin.php` で勤怠一覧が表示される
- iPad Safariでカメラ許可ダイアログが出る
- 出勤写真が `storage/photos/` に保存される
- DBの `attendance_records.photo_url` に写真パスが保存される
- 試運転確認後、`health.php` は削除する

## 注意

現段階ではアプリ独自の管理者ログインはありません。管理画面はロリポップ側のBasic認証で保護してください。

写真URLも管理画面から参照できるため、試運転URLは関係者以外に共有しないでください。
