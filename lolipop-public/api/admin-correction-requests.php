<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

$admin = require_admin();

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $stmt = db()->query(
        "SELECT cr.id, cr.user_id, u.name AS staff_name, cr.requested_type, cr.requested_at,
                cr.reason, cr.status, cr.admin_note, cr.reviewed_at, cr.created_at, au.username AS reviewed_by_name
         FROM correction_requests cr
         INNER JOIN users u ON u.id = cr.user_id
         LEFT JOIN admin_users au ON au.id = cr.reviewed_by
         ORDER BY cr.created_at DESC"
    );
    json_response(200, ['requests' => $stmt->fetchAll()]);
}

require_method('POST');

$payload = read_json_body();
$requestId = (string) ($payload['request_id'] ?? '');
$action = (string) ($payload['action'] ?? '');
$adminNote = trim((string) ($payload['admin_note'] ?? ''));

if ($requestId === '' || !in_array($action, ['approve', 'reject'], true)) {
    json_response(400, ['error' => '申請操作が正しくありません']);
}

$stmt = db()->prepare('SELECT * FROM correction_requests WHERE id = :id');
$stmt->execute([':id' => $requestId]);
$request = $stmt->fetch();
if (!is_array($request)) {
    json_response(404, ['error' => '申請が見つかりません']);
}
if ($request['status'] !== 'pending') {
    json_response(400, ['error' => '処理済みの申請です']);
}

$now = date('Y-m-d H:i:s');
$newStatus = $action === 'approve' ? 'approved' : 'rejected';

db()->beginTransaction();
try {
    if ($action === 'approve') {
        $recordId = 'att_' . bin2hex(random_bytes(16));
        $insert = db()->prepare(
            "INSERT INTO attendance_records
              (id, user_id, type, recorded_at, photo_url, created_at, updated_at)
             VALUES
              (:id, :user_id, :type, :recorded_at, NULL, :created_at, :updated_at)"
        );
        $insert->execute([
            ':id' => $recordId,
            ':user_id' => $request['user_id'],
            ':type' => $request['requested_type'],
            ':recorded_at' => $request['requested_at'],
            ':created_at' => $now,
            ':updated_at' => $now,
        ]);
    }

    $update = db()->prepare(
        "UPDATE correction_requests
         SET status = :status, admin_note = :admin_note, reviewed_by = :reviewed_by,
             reviewed_at = :reviewed_at, updated_at = :updated_at
         WHERE id = :id"
    );
    $update->execute([
        ':status' => $newStatus,
        ':admin_note' => $adminNote === '' ? null : $adminNote,
        ':reviewed_by' => $admin['id'],
        ':reviewed_at' => $now,
        ':updated_at' => $now,
        ':id' => $requestId,
    ]);

    db()->commit();
} catch (Throwable $error) {
    db()->rollBack();
    json_response(500, ['error' => '申請処理に失敗しました']);
}

audit_log('admin', $admin['id'], 'correction_request_' . $action, 'correction_request', $requestId, $request, [
    'status' => $newStatus,
    'admin_note' => $adminNote,
]);

json_response(200, ['ok' => true]);
