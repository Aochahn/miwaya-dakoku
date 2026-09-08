<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

require_method('POST');

$payload = read_json_body();
$username = trim((string) ($payload['username'] ?? ''));
$password = (string) ($payload['password'] ?? '');

if ($username === '' || $password === '') {
    json_response(400, ['error' => 'ユーザー名とパスワードを入力してください']);
}

$stmt = db()->prepare('SELECT id, username, password_hash FROM admin_users WHERE username = :username AND active = 1');
$stmt->execute([':username' => $username]);
$admin = $stmt->fetch();

if (!is_array($admin) || !password_verify($password, $admin['password_hash'])) {
    audit_log('system', null, 'admin_login_failed', 'admin_user', $username);
    json_response(401, ['error' => 'ログイン情報が正しくありません']);
}

session_regenerate_id(true);
$_SESSION['admin_id'] = $admin['id'];

$now = date('Y-m-d H:i:s');
$update = db()->prepare('UPDATE admin_users SET last_login_at = :last_login_at, updated_at = :updated_at WHERE id = :id');
$update->execute([':last_login_at' => $now, ':updated_at' => $now, ':id' => $admin['id']]);

audit_log('admin', $admin['id'], 'admin_login', 'admin_user', $admin['id']);

json_response(200, ['admin' => ['id' => $admin['id'], 'username' => $admin['username']]]);
