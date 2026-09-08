<?php
declare(strict_types=1);

date_default_timezone_set('Asia/Tokyo');

session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'httponly' => true,
    'samesite' => 'Lax',
    'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
]);
session_start();

$configPath = __DIR__ . '/../private/config.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'config.php が見つかりません'], JSON_UNESCAPED_UNICODE);
    exit;
}

$config = require $configPath;

if (!isset($config['correction_request_mail_to'])) {
    $config['correction_request_mail_to'] = 'info@miwaya.site';
}

function json_response(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function read_json_body(): array
{
    global $config;

    $maxBytes = (int) ($config['max_request_bytes'] ?? $config['max_photo_bytes'] ?? 8388608);
    $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($contentLength > $maxBytes) {
        json_response(413, ['error' => '送信データが大きすぎます']);
    }

    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
        json_response(400, ['error' => 'JSONを読み取れませんでした']);
    }
    return $payload;
}

function require_method(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) {
        json_response(405, ['error' => '許可されていないHTTPメソッドです']);
    }
}

function db(): PDO
{
    static $pdo = null;
    global $config;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $db = $config['db'];
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $db['host'], $db['name']);

    $pdo = new PDO($dsn, $db['user'], $db['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}

function active_user_exists(string $userId): bool
{
    $stmt = db()->prepare('SELECT COUNT(*) FROM users WHERE id = :id AND active = 1');
    $stmt->execute([':id' => $userId]);
    return (int) $stmt->fetchColumn() > 0;
}

function find_active_user(string $userId): ?array
{
    $stmt = db()->prepare(
        'SELECT id, name, display_order, active, pin_hash, last_login_at, created_at, updated_at
         FROM users
         WHERE id = :id AND active = 1'
    );
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch();

    return is_array($user) ? $user : null;
}

function current_admin(): ?array
{
    $adminId = (string) ($_SESSION['admin_id'] ?? '');
    if ($adminId === '') {
        return null;
    }

    $stmt = db()->prepare('SELECT id, username FROM admin_users WHERE id = :id AND active = 1');
    $stmt->execute([':id' => $adminId]);
    $admin = $stmt->fetch();

    return is_array($admin) ? $admin : null;
}

function require_admin(): array
{
    $admin = current_admin();
    if ($admin === null) {
        json_response(401, ['error' => '管理者ログインが必要です']);
    }

    return $admin;
}

function current_staff_user_id(): string
{
    return (string) ($_SESSION['staff_user_id'] ?? '');
}

function require_staff_user(string $userId): array
{
    if ($userId === '' || current_staff_user_id() !== $userId) {
        json_response(401, ['error' => 'スタッフPINログインが必要です']);
    }

    $user = find_active_user($userId);
    if ($user === null) {
        json_response(401, ['error' => 'スタッフが見つかりません']);
    }

    return $user;
}

function client_ip(): ?string
{
    return $_SERVER['REMOTE_ADDR'] ?? null;
}

function user_agent(): ?string
{
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;
    return is_string($ua) ? substr($ua, 0, 255) : null;
}

function audit_log(
    string $actorType,
    ?string $actorId,
    string $action,
    ?string $targetType = null,
    ?string $targetId = null,
    ?array $before = null,
    ?array $after = null
): void {
    try {
        $now = date('Y-m-d H:i:s');
        $stmt = db()->prepare(
            "INSERT INTO audit_logs
              (id, actor_type, actor_id, action, target_type, target_id, before_json, after_json, ip_address, user_agent, created_at)
             VALUES
              (:id, :actor_type, :actor_id, :action, :target_type, :target_id, :before_json, :after_json, :ip_address, :user_agent, :created_at)"
        );
        $stmt->execute([
            ':id' => 'audit_' . bin2hex(random_bytes(16)),
            ':actor_type' => $actorType,
            ':actor_id' => $actorId,
            ':action' => $action,
            ':target_type' => $targetType,
            ':target_id' => $targetId,
            ':before_json' => $before === null ? null : json_encode($before, JSON_UNESCAPED_UNICODE),
            ':after_json' => $after === null ? null : json_encode($after, JSON_UNESCAPED_UNICODE),
            ':ip_address' => client_ip(),
            ':user_agent' => user_agent(),
            ':created_at' => $now,
        ]);
    } catch (Throwable $error) {
        error_log('audit_log failed: ' . $error->getMessage());
    }
}

function user_status(string $userId): string
{
    $stmt = db()->prepare(
        "SELECT type
         FROM attendance_records
         WHERE user_id = :user_id AND DATE(recorded_at) = CURDATE()
         ORDER BY recorded_at DESC, created_at DESC
         LIMIT 1"
    );
    $stmt->execute([':user_id' => $userId]);
    $type = $stmt->fetchColumn();

    if ($type === false) {
        return 'not_clocked_in';
    }

    return $type === 'clock_in' ? 'clocked_in' : 'clocked_out';
}

function latest_attendance_record(string $userId): ?array
{
    $stmt = db()->prepare(
        "SELECT id, user_id, type, recorded_at, photo_url, created_at, updated_at
         FROM attendance_records
         WHERE user_id = :user_id
         ORDER BY recorded_at DESC, created_at DESC
         LIMIT 1"
    );
    $stmt->execute([':user_id' => $userId]);
    $record = $stmt->fetch();

    return is_array($record) ? $record : null;
}

function clock_in_lock_until(string $userId): ?string
{
    $latest = latest_attendance_record($userId);
    if ($latest === null || $latest['type'] !== 'clock_in') {
        return null;
    }

    $clockInAt = new DateTimeImmutable($latest['recorded_at']);
    $unlockAt = $clockInAt->modify('+3 hours');
    $now = new DateTimeImmutable('now');

    if ($now >= $unlockAt) {
        return null;
    }

    return $unlockAt->format('Y-m-d H:i:s');
}

function user_status_payload(string $userId): array
{
    $status = user_status($userId);
    $lockedUntil = clock_in_lock_until($userId);

    return [
        'attendance_status' => $lockedUntil !== null ? 'clocked_in_locked' : $status,
        'locked_until' => $lockedUntil,
    ];
}

function save_photo(string $dataUrl): string
{
    global $config;

    if (!preg_match('/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/', $dataUrl, $matches)) {
        json_response(400, ['error' => '画像データが不正です']);
    }

    $extension = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
    $image = base64_decode($matches[2], true);
    if ($image === false) {
        json_response(400, ['error' => '画像データを復元できませんでした']);
    }

    if (strlen($image) > ($config['max_photo_bytes'] ?? 8388608)) {
        json_response(400, ['error' => '画像サイズが大きすぎます']);
    }

    $targetDir = __DIR__ . '/../' . $config['photo_dir'];
    if (!is_dir($targetDir) && !mkdir($targetDir, 0755, true)) {
        json_response(500, ['error' => '写真保存ディレクトリを作成できませんでした']);
    }

    $dir = realpath($targetDir);
    if ($dir === false) {
        json_response(500, ['error' => '写真保存ディレクトリを確認できませんでした']);
    }

    $filename = date('Ymd_His') . '_' . bin2hex(random_bytes(16)) . '.' . $extension;
    $path = $dir . DIRECTORY_SEPARATOR . $filename;
    if (file_put_contents($path, $image) === false) {
        json_response(500, ['error' => '写真を保存できませんでした']);
    }

    return rtrim($config['photo_url_base'], '/') . '/' . $filename;
}

function send_correction_request_mail(array $request, array $user): void
{
    global $config;

    $to = (string) ($config['correction_request_mail_to'] ?? 'info@miwaya.site');
    $subject = '勤怠修正申請: ' . $user['name'];
    $typeLabel = $request['requested_type'] === 'clock_in' ? '出勤' : '退勤';
    $body = implode("\n", [
        '勤怠修正申請が届きました。',
        '',
        'スタッフ: ' . $user['name'],
        '種別: ' . $typeLabel,
        '希望日時: ' . $request['requested_at'],
        '理由:',
        $request['reason'],
        '',
        '管理画面から確認してください。',
    ]);
    $headers = [
        'From: no-reply@miwaya.site',
        'Content-Type: text/plain; charset=UTF-8',
    ];

    try {
        if (!mail($to, $subject, $body, implode("\r\n", $headers))) {
            error_log('correction request mail failed: ' . $request['id']);
        }
    } catch (Throwable $error) {
        error_log('correction request mail error: ' . $error->getMessage());
    }
}
