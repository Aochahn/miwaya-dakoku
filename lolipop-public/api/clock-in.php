<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

require_method('POST');

try {
    $payload = read_json_body();
    $userId = (string) ($payload['user_id'] ?? '');
    $photoDataUrl = (string) ($payload['photo_data_url'] ?? '');
    require_staff_user($userId);

    if ($userId === '' || !active_user_exists($userId)) {
        json_response(400, ['error' => 'スタッフが見つかりません']);
    }

    $lockedUntil = clock_in_lock_until($userId);
    if ($lockedUntil !== null) {
        json_response(429, ['error' => '出勤後3時間は追加の打刻ができません', 'locked_until' => $lockedUntil]);
    }

    if (user_status($userId) !== 'not_clocked_in') {
        json_response(400, ['error' => '本日の出勤はすでに記録されています']);
    }

    $photoUrl = save_photo($photoDataUrl);
    $recordedAt = date('Y-m-d H:i:s');
    $id = 'att_' . bin2hex(random_bytes(16));

    $stmt = db()->prepare(
        "INSERT INTO attendance_records
          (id, user_id, type, recorded_at, photo_url, created_at, updated_at)
         VALUES
          (:id, :user_id, 'clock_in', :recorded_at, :photo_url, :created_at, :updated_at)"
    );
    $stmt->execute([
        ':id' => $id,
        ':user_id' => $userId,
        ':recorded_at' => $recordedAt,
        ':photo_url' => $photoUrl,
        ':created_at' => $recordedAt,
        ':updated_at' => $recordedAt,
    ]);

    unset($_SESSION['staff_user_id']);
    audit_log('staff', $userId, 'clock_in', 'attendance_record', $id, null, [
        'recorded_at' => $recordedAt,
        'photo_url' => $photoUrl,
    ]);

    json_response(201, ['recorded_at' => $recordedAt, 'photo_url' => $photoUrl]);
} catch (Throwable $error) {
    json_response(500, ['error' => '出勤記録を保存できませんでした']);
}
