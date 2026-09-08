<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

$admin = require_admin();

function normalize_shift_role(string $role): string
{
    return $role === 'kitchen' ? 'kitchen' : 'hall';
}

function normalize_shift_days($days): string
{
    if (!is_array($days)) {
        return '';
    }

    $normalized = [];
    foreach ($days as $day) {
        $value = (int) $day;
        if ($value >= 0 && $value <= 6) {
            $normalized[(string) $value] = true;
        }
    }

    return implode(',', array_keys($normalized));
}

function valid_shift_time(string $time): bool
{
    if ($time === '24:00') {
        return true;
    }

    return (bool) preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $time);
}

function shift_time_to_minutes(string $time): int
{
    [$hour, $minute] = array_map('intval', explode(':', $time));
    return $hour * 60 + $minute;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $stmt = db()->query(
        "SELECT u.id, u.name, u.display_order, u.active,
                COALESCE(sp.role, CASE WHEN u.name LIKE '%高田%' THEN 'kitchen' ELSE 'hall' END) AS role,
                COALESCE(sp.available_days, '0,1,2,3,4,5,6') AS available_days,
                COALESCE(TIME_FORMAT(sp.available_start, '%H:%i'), '17:30') AS available_start,
                COALESCE(TIME_FORMAT(sp.available_end, '%H:%i'), '24:00') AS available_end,
                COALESCE(sp.priority, CASE WHEN u.name LIKE '%高田%' OR u.name LIKE '%柴谷%' THEN 1 ELSE 0 END) AS priority
         FROM users u
         LEFT JOIN shift_preferences sp ON sp.user_id = u.id
         ORDER BY u.display_order ASC, u.name ASC"
    );

    json_response(200, ['preferences' => $stmt->fetchAll()]);
}

require_method('POST');

$payload = read_json_body();
$items = $payload['preferences'] ?? null;
if (!is_array($items)) {
    json_response(400, ['error' => 'シフト条件が正しくありません']);
}

$activeUsers = [];
$stmt = db()->query('SELECT id FROM users WHERE active = 1');
foreach ($stmt->fetchAll() as $user) {
    $activeUsers[(string) $user['id']] = true;
}

$now = date('Y-m-d H:i:s');
$save = db()->prepare(
    "INSERT INTO shift_preferences
      (user_id, role, available_days, available_start, available_end, priority, created_at, updated_at)
     VALUES
      (:user_id, :role, :available_days, :available_start, :available_end, :priority, :created_at, :updated_at)
     ON DUPLICATE KEY UPDATE
      role = VALUES(role),
      available_days = VALUES(available_days),
      available_start = VALUES(available_start),
      available_end = VALUES(available_end),
      priority = VALUES(priority),
      updated_at = VALUES(updated_at)"
);

db()->beginTransaction();
try {
    foreach ($items as $item) {
        if (!is_array($item)) {
            throw new InvalidArgumentException('シフト条件が正しくありません');
        }

        $userId = (string) ($item['user_id'] ?? '');
        if ($userId === '' || !isset($activeUsers[$userId])) {
            throw new InvalidArgumentException('スタッフが正しくありません');
        }

        $start = (string) ($item['available_start'] ?? '17:30');
        $end = (string) ($item['available_end'] ?? '24:00');
        if (!valid_shift_time($start) || !valid_shift_time($end) || shift_time_to_minutes($end) <= shift_time_to_minutes($start)) {
            throw new InvalidArgumentException('出勤可能時間が正しくありません');
        }

        $save->execute([
            ':user_id' => $userId,
            ':role' => normalize_shift_role((string) ($item['role'] ?? 'hall')),
            ':available_days' => normalize_shift_days($item['available_days'] ?? []),
            ':available_start' => $start . ':00',
            ':available_end' => $end . ':00',
            ':priority' => !empty($item['priority']) ? 1 : 0,
            ':created_at' => $now,
            ':updated_at' => $now,
        ]);
    }

    db()->commit();
} catch (Throwable $error) {
    db()->rollBack();
    json_response(400, ['error' => $error->getMessage()]);
}

audit_log('admin', $admin['id'], 'shift_preferences_update', 'shift_preferences', null, null, ['count' => count($items)]);
json_response(200, ['ok' => true]);
