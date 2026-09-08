<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

require_method('POST');

$payload = read_json_body();
$userId = (string) ($payload['user_id'] ?? '');
$pin = (string) ($payload['pin'] ?? '');
$user = $userId === '' ? null : find_active_user($userId);

if ($user === null || $pin === '' || !password_verify($pin, (string) $user['pin_hash'])) {
    audit_log('system', null, 'staff_login_failed', 'user', $userId);
    json_response(401, ['error' => 'PINコードが正しくありません']);
}

session_regenerate_id(true);
$_SESSION['staff_user_id'] = $user['id'];

$now = date('Y-m-d H:i:s');
$stmt = db()->prepare('UPDATE users SET last_login_at = :last_login_at, updated_at = :updated_at WHERE id = :id');
$stmt->execute([':last_login_at' => $now, ':updated_at' => $now, ':id' => $user['id']]);

audit_log('staff', $user['id'], 'staff_login', 'user', $user['id']);

json_response(200, [
    'user' => [
        'id' => $user['id'],
        'name' => $user['name'],
        'attendance_status' => user_status_payload($user['id'])['attendance_status'],
        'locked_until' => user_status_payload($user['id'])['locked_until'],
    ],
]);
