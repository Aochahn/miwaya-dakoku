<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

try {
    $stmt = db()->query(
        'SELECT id, name, display_order, active, created_at, updated_at
         FROM users
         WHERE active = 1
         ORDER BY display_order ASC, name ASC'
    );

    $users = [];
    foreach ($stmt->fetchAll() as $user) {
        $user['active'] = (bool) $user['active'];
        $status = user_status_payload($user['id']);
        $user['attendance_status'] = $status['attendance_status'];
        $user['locked_until'] = $status['locked_until'];
        $users[] = $user;
    }

    json_response(200, ['users' => $users]);
} catch (Throwable $error) {
    json_response(500, ['error' => 'スタッフ一覧を取得できませんでした']);
}
