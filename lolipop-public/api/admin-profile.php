<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

$admin = require_admin();
require_method('POST');

$payload = read_json_body();
$currentPassword = (string) ($payload['current_password'] ?? '');
$newPassword = (string) ($payload['new_password'] ?? '');

if ($currentPassword === '' || strlen($newPassword) < 8) {
    json_response(400, ['error' => '現在のパスワードと8文字以上の新しいパスワードを入力してください']);
}

$stmt = db()->prepare('SELECT id, password_hash FROM admin_users WHERE id = :id AND active = 1');
$stmt->execute([':id' => $admin['id']]);
$row = $stmt->fetch();

if (!is_array($row) || !password_verify($currentPassword, $row['password_hash'])) {
    audit_log('admin', $admin['id'], 'admin_password_change_failed', 'admin_user', $admin['id']);
    json_response(401, ['error' => '現在のパスワードが正しくありません']);
}

$now = date('Y-m-d H:i:s');
$update = db()->prepare('UPDATE admin_users SET password_hash = :password_hash, updated_at = :updated_at WHERE id = :id');
$update->execute([
    ':password_hash' => password_hash($newPassword, PASSWORD_DEFAULT),
    ':updated_at' => $now,
    ':id' => $admin['id'],
]);

audit_log('admin', $admin['id'], 'admin_password_change', 'admin_user', $admin['id']);

json_response(200, ['ok' => true]);
