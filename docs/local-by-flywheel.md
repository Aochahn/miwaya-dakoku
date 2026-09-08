# Local by Flywheel 起動手順

このアプリは WordPress ではなく、PHP + MySQL で作られた勤怠アプリです。
Local by Flywheel は WordPress 向けのツールですが、PHP と MySQL を同梱しているため、公開ディレクトリを差し替えれば動かせます。

## 1. Local でサイトを作る

1. Local by Flywheel を起動します。
2. `Create a new site` を選びます。
3. サイト名を入力します。例: `dakoku-app`
4. 環境は `Preferred` または `Custom` を選びます。
5. PHP は `8.0` 以上を選びます。
6. WordPress のユーザー名とパスワードは仮の値で作成します。

作成後、Local のサイト画面で `Site domain` と `Database` 情報を確認できる状態にします。

## 2. 公開ファイルを置き換える

Local が作ったサイトフォルダを Finder で開き、次のフォルダへ移動します。

```text
app/public
```

このリポジトリから自動配置する場合は、次のコマンドを実行します。

```bash
bash scripts/install-local-by-flywheel.sh "/path/to/local-site/app/public"
```

例:

```bash
bash scripts/install-local-by-flywheel.sh "/Users/aoki_mac-mini/Local Sites/dakoku-app/app/public"
```

このスクリプトは、Local が作成した WordPress ファイルが残っている場合に `app/_wordpress-backups/wordpress-backup-日時` フォルダへ退避し、`lolipop-public` の中身をコピーします。
また、Local 用の `private/config.php` も自動で作成します。

手動で配置する場合は、以下の手順で進めてください。

`app/public` の WordPress ファイルを別名で退避するか削除し、このリポジトリの `lolipop-public` の中身を `app/public` にコピーします。

コピーする中身:

- `index.php`
- `admin.php`
- `health.php`
- `.htaccess`
- `app.js`
- `styles.css`
- `api/`
- `private/`
- `storage/`

## 3. 設定ファイルを作る

`app/public/private/config.local.sample.php` をコピーして、同じフォルダに `config.php` として保存します。

Local の標準設定なら、通常は次の値で動きます。

```php
'host' => 'localhost',
'name' => 'local',
'user' => 'root',
'password' => 'root',
```

Local の `Database` タブに別の値が表示されている場合は、その値に合わせて `config.php` を変更してください。

## 4. DBを作成する

Local のサイト画面から `Database` タブを開き、`Open Adminer` を押します。

Adminer で `SQL command` を開き、次のファイルの内容を実行します。

```text
app/public/private/schema.sql
```

実行後、`users` と `attendance_records` テーブルが作成されていればOKです。

## 5. サイトを確認する

Local のサイトを `Start site` で起動し、次を確認します。

- `/health.php`: PHP、DB接続、テーブル、写真フォルダが `OK`
- `/`: 打刻画面が表示される
- `/admin.php`: 勤怠一覧が表示される

初期ログイン情報:

- 管理者ユーザー名: `admin`
- 管理者パスワード: `admin1234`
- スタッフ初期PIN: `0000`

管理者パスワードとスタッフPINは、管理画面から変更してください。

カメラ利用を確認する場合は、Local の `SSL` を有効化して、ブラウザから証明書を信頼してください。
ブラウザによっては `http://localhost` 以外のHTTPページでカメラが使えないためです。

## 6. 既存DBへ機能追加を反映する

既存のLocal DBに認証・修正申請・監査ログ機能を追加する場合は、Adminer または MySQL で次を実行します。

```text
app/public/private/migrations/001_security_workflow.sql
```

スタッフシフト管理機能を追加する場合は、続けて次も実行します。

```text
app/public/private/migrations/002_member_shifts.sql
```

## 7. シフト管理

管理画面の `シフト管理` タブから、スタッフ別に日付、開始時刻、終了時刻、休憩時間、メモを登録できます。
同じスタッフ・同じ日付で保存すると、既存シフトを更新します。

スタッフ側では、PINログイン後のマイページに今後14日分のシフトが表示されます。

## 8. よくある詰まりどころ

### `config.php が見つかりません`

`private/config.local.sample.php` をコピーして `private/config.php` を作成してください。

### `DB接続/テーブル` が `NG`

`private/config.php` のDB情報が Local の `Database` タブと一致しているか確認してください。
その後、`private/schema.sql` を Adminer で実行してください。

### 写真保存ができない

`storage/photos` が存在し、PHPから書き込める必要があります。
Local の場合は通常そのまま書き込めますが、失敗する場合はフォルダの権限を確認してください。

### HTTPからHTTPSへ転送される

このアプリの `.htaccess` は本番向けにHTTPSへリダイレクトします。
Local の `SSL` を有効にして `https://サイトドメイン` で確認してください。
