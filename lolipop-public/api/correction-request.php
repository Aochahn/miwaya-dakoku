<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

require_method('POST');

$payload = read_json_body();
$userId = (string) ($payload['user_id'] ?? '');
$user = require_staff_user($userId);
$requestedType = (string) ($payload['requested_type'] ?? '');
$requestedAt = trim((string) ($payload['requested_at'] ?? ''));
$reason = trim((string) ($payload['reason'] ?? ''));

if (!in_array($requestedType, ['clock_in', 'clock_out'], true)) {
    json_response(400, ['error' => '修正種別が正しくありません']);
}

if ($reason === '') {
    json_response(400, ['error' => '申請理由を入力してください']);
}

try {
    $requestedDate = new DateTimeImmutable($requestedAt);
} catch (Throwable $error) {
    json_response(400, ['error' => '希望日時が正しくありません']);
}

$now = date('Y-m-d H:i:s');
$id = 'corr_' . bin2hex(random_bytes(16));
$request = [
    'id' => $id,
    'user_id' => $userId,
    'requested_type' => $requestedType,
    'requested_at' => $requestedDate->format('Y-m-d H:i:s'),
    'reason' => $reason,
];

$stmt = db()->prepare(
    "INSERT INTO correction_requests
      (id, user_id, requested_type, requested_at, reason, status, created_at, updated_at)
     VALUES
      (:id, :user_id, :requested_type, :requested_at, :reason, 'pending', :created_at, :updated_at)"
);
$stmt->execute([
    ':id' => $id,
    ':user_id' => $userId,
    ':requested_type' => $requestedType,
    ':requested_at' => $request['requested_at'],
    ':reason' => $reason,
    ':created_at' => $now,
    ':updated_at' => $now,
]);

audit_log('staff', $userId, 'correction_request_create', 'correction_request', $id, null, $request);
send_correction_request_mail($request, $user);

json_response(201, ['ok' => true, 'request_id' => $id]);
