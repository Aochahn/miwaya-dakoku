<?php
declare(strict_types=1);

date_default_timezone_set('Asia/Tokyo');
header('Content-Type: text/html; charset=utf-8');

function status_row(string $label, bool $ok, string $message): string
{
    $mark = $ok ? 'OK' : 'NG';
    $class = $ok ? 'ok' : 'ng';
    return '<tr><th>' . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . '</th><td class="' . $class . '">' . $mark . '</td><td>' . htmlspecialchars($message, ENT_QUOTES, 'UTF-8') . '</td></tr>';
}

$rows = [];
$rows[] = status_row('PHP', version_compare(PHP_VERSION, '8.0.0', '>='), 'PHP ' . PHP_VERSION);

$configPath = __DIR__ . '/private/config.php';
$configExists = file_exists($configPath);
$rows[] = status_row('config.php', $configExists, $configExists ? 'private/config.php が存在します' : 'private/config.php が見つかりません');

$config = null;
if ($configExists) {
    try {
        $config = require $configPath;
        $hasDb = isset($config['db']['host'], $config['db']['name'], $config['db']['user'], $config['db']['password']);
        $rows[] = status_row('DB設定', $hasDb, $hasDb ? 'DB設定項目があります' : 'DB設定項目が不足しています');
    } catch (Throwable $error) {
        $rows[] = status_row('DB設定', false, 'config.php を読み込めません: ' . $error->getMessage());
    }
}

if (is_array($config) && isset($config['db'])) {
    try {
        $db = $config['db'];
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $db['host'], $db['name']);
        $pdo = new PDO($dsn, $db['user'], $db['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $rows[] = status_row('DB接続', true, 'MySQLへ接続できました');

        foreach (['users', 'attendance_records', 'admin_users', 'correction_requests', 'audit_logs', 'member_shifts', 'shift_preferences'] as $table) {
            $count = $pdo->query('SELECT COUNT(*) FROM ' . $table)->fetchColumn();
            $rows[] = status_row('テーブル: ' . $table, true, $table . ' は存在します。件数: ' . $count);
        }
    } catch (Throwable $error) {
        $rows[] = status_row('DB接続/テーブル', false, $error->getMessage());
    }
}

$photoDir = __DIR__ . '/' . ($config['photo_dir'] ?? 'storage/photos');
if (!is_dir($photoDir)) {
    $rows[] = status_row('写真フォルダ', false, $photoDir . ' が見つかりません');
} else {
    $rows[] = status_row('写真フォルダ', true, $photoDir . ' が存在します');
    $rows[] = status_row('写真フォルダ書込', is_writable($photoDir), is_writable($photoDir) ? 'PHPから書き込めます' : 'PHPから書き込めません');
}
?>
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>勤怠アプリ診断</title>
    <style>
      body { font-family: sans-serif; margin: 24px; color: #1c2430; }
      table { border-collapse: collapse; width: 100%; max-width: 960px; }
      th, td { border: 1px solid #dbe1e8; padding: 10px; text-align: left; vertical-align: top; }
      th { width: 220px; background: #f6f7f9; }
      .ok { color: #16724a; font-weight: 700; }
      .ng { color: #b42318; font-weight: 700; }
      p { max-width: 960px; line-height: 1.7; }
    </style>
  </head>
  <body>
    <h1>勤怠アプリ診断</h1>
    <p>公開確認用の一時ファイルです。確認後は安全のため削除してください。</p>
    <table>
      <tbody>
        <?= implode("\n", $rows) ?>
      </tbody>
    </table>
  </body>
</html>
