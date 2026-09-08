<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

require_method('POST');

try {
    $payload = read_json_body();
    $userId = (string) ($payload['user_id'] ?? '');
    require_staff_user($userId);

    if ($userId === '' || !active_user_exists($userId)) {
        json_response(400, ['error' => 'スタッフが見つかりません']);
    }

    $lockedUntil = clock_in_lock_until($userId);
    if ($lockedUntil !== null) {
        json_response(429, ['error' => '出勤後3時間は退勤打刻できません', 'locked_until' => $lockedUntil]);
    }

    if (user_status($userId) !== 'clocked_in') {
        json_response(400, ['error' => '出勤中のスタッフのみ退勤できます']);
    }

    $recordedAt = date('Y-m-d H:i:s');
    $id = 'att_' . bin2hex(random_bytes(16));

    $stmt = db()->prepare(
        "INSERT INTO attendance_records
          (id, user_id, type, recorded_at, photo_url, created_at, updated_at)
         VALUES
          (:id, :user_id, 'clock_out', :recorded_at, NULL, :created_at, :updated_at)"
    );
    $stmt->execute([
        ':id' => $id,
        ':user_id' => $userId,
        ':recorded_at' => $recordedAt,
        ':created_at' => $recordedAt,
        ':updated_at' => $recordedAt,
    ]);

    unset($_SESSION['staff_user_id']);
    audit_log('staff', $userId, 'clock_out', 'attendance_record', $id, null, [
        'recorded_at' => $recordedAt,
    ]);

    json_response(201, ['recorded_at' => $recordedAt]);
} catch (Throwable $error) {
    json_response(500, ['error' => '退勤記録を保存できませんでした']);
}
