<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

$admin = require_admin();

function valid_shift_clock(string $time): bool
{
    if ($time === '') {
        return true;
    }
    if ($time === '24:00') {
        return true;
    }

    return (bool) preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $time);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $from = trim((string) ($_GET['from'] ?? date('Y-m-d')));
    $to = trim((string) ($_GET['to'] ?? date('Y-m-d', strtotime('+14 days'))));

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) {
        json_response(400, ['error' => '日付範囲が正しくありません']);
    }

    $stmt = db()->prepare(
        "SELECT ms.id, ms.user_id, u.name AS staff_name, ms.shift_date, ms.start_time,
                ms.end_time, ms.break_minutes, ms.note, ms.created_at, ms.updated_at
         FROM member_shifts ms
         INNER JOIN users u ON u.id = ms.user_id
         WHERE ms.shift_date BETWEEN :from_date AND :to_date
         ORDER BY ms.shift_date ASC, u.display_order ASC, u.name ASC"
    );
    $stmt->execute([':from_date' => $from, ':to_date' => $to]);

    json_response(200, ['shifts' => $stmt->fetchAll()]);
}

require_method('POST');

$payload = read_json_body();
$action = (string) ($payload['action'] ?? 'save');

if ($action === 'delete') {
    $shiftId = (string) ($payload['shift_id'] ?? '');
    if ($shiftId === '') {
        json_response(400, ['error' => '削除するシフトが指定されていません']);
    }

    $stmt = db()->prepare('SELECT * FROM member_shifts WHERE id = :id');
    $stmt->execute([':id' => $shiftId]);
    $before = $stmt->fetch();
    if (!is_array($before)) {
        json_response(404, ['error' => 'シフトが見つかりません']);
    }

    $delete = db()->prepare('DELETE FROM member_shifts WHERE id = :id');
    $delete->execute([':id' => $shiftId]);

    audit_log('admin', $admin['id'], 'shift_delete', 'member_shift', $shiftId, $before);
    json_response(200, ['ok' => true]);
}

if ($action === 'bulk_save') {
    $shifts = $payload['shifts'] ?? null;
    if (!is_array($shifts) || count($shifts) === 0) {
        json_response(400, ['error' => '保存するシフトがありません']);
    }
    if (count($shifts) > 200) {
        json_response(400, ['error' => '一度に保存できるシフトは200件までです']);
    }

    $now = date('Y-m-d H:i:s');
    $lookup = db()->prepare('SELECT * FROM member_shifts WHERE user_id = :user_id AND shift_date = :shift_date');
    $save = db()->prepare(
        "INSERT INTO member_shifts
          (id, user_id, shift_date, start_time, end_time, break_minutes, note, created_at, updated_at)
         VALUES
          (:id, :user_id, :shift_date, :start_time, :end_time, :break_minutes, :note, :created_at, :updated_at)
         ON DUPLICATE KEY UPDATE
          start_time = VALUES(start_time),
          end_time = VALUES(end_time),
          break_minutes = VALUES(break_minutes),
          note = VALUES(note),
          updated_at = VALUES(updated_at)"
    );

    $saved = 0;
    db()->beginTransaction();
    try {
        foreach ($shifts as $shift) {
            if (!is_array($shift)) {
                throw new InvalidArgumentException('シフト形式が正しくありません');
            }

            $userId = (string) ($shift['user_id'] ?? '');
            $shiftDate = trim((string) ($shift['shift_date'] ?? ''));
            $startTime = trim((string) ($shift['start_time'] ?? ''));
            $endTime = trim((string) ($shift['end_time'] ?? ''));
            $breakMinutes = (int) ($shift['break_minutes'] ?? 0);
            $note = trim((string) ($shift['note'] ?? ''));

            if ($userId === '' || find_active_user($userId) === null) {
                throw new InvalidArgumentException('スタッフが正しくありません');
            }
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $shiftDate)) {
                throw new InvalidArgumentException('シフト日が正しくありません');
            }
            if (!valid_shift_clock($startTime) || !valid_shift_clock($endTime)) {
                throw new InvalidArgumentException('シフト時刻が正しくありません');
            }
            if ($breakMinutes < 0 || $breakMinutes > 1440) {
                throw new InvalidArgumentException('休憩時間が正しくありません');
            }

            $lookup->execute([':user_id' => $userId, ':shift_date' => $shiftDate]);
            $before = $lookup->fetch();
            $shiftId = is_array($before) ? $before['id'] : 'shift_' . bin2hex(random_bytes(16));

            $save->execute([
                ':id' => $shiftId,
                ':user_id' => $userId,
                ':shift_date' => $shiftDate,
                ':start_time' => $startTime === '' ? null : $startTime,
                ':end_time' => $endTime === '' ? null : $endTime,
                ':break_minutes' => $breakMinutes,
                ':note' => $note === '' ? null : $note,
                ':created_at' => $now,
                ':updated_at' => $now,
            ]);

            audit_log('admin', $admin['id'], is_array($before) ? 'shift_bulk_update' : 'shift_bulk_create', 'member_shift', $shiftId, is_array($before) ? $before : null, [
                'user_id' => $userId,
                'shift_date' => $shiftDate,
                'start_time' => $startTime,
                'end_time' => $endTime,
                'break_minutes' => $breakMinutes,
                'note' => $note,
            ]);
            $saved++;
        }

        db()->commit();
    } catch (Throwable $error) {
        db()->rollBack();
        json_response(400, ['error' => $error->getMessage()]);
    }

    json_response(200, ['ok' => true, 'saved' => $saved]);
}

$userId = (string) ($payload['user_id'] ?? '');
$shiftDate = trim((string) ($payload['shift_date'] ?? ''));
$startTime = trim((string) ($payload['start_time'] ?? ''));
$endTime = trim((string) ($payload['end_time'] ?? ''));
$breakMinutes = (int) ($payload['break_minutes'] ?? 0);
$note = trim((string) ($payload['note'] ?? ''));

if ($userId === '' || find_active_user($userId) === null) {
    json_response(400, ['error' => 'スタッフが正しくありません']);
}
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $shiftDate)) {
    json_response(400, ['error' => 'シフト日が正しくありません']);
}
if (!valid_shift_clock($startTime)) {
    json_response(400, ['error' => '開始時刻が正しくありません']);
}
if (!valid_shift_clock($endTime)) {
    json_response(400, ['error' => '終了時刻が正しくありません']);
}
if ($breakMinutes < 0 || $breakMinutes > 1440) {
    json_response(400, ['error' => '休憩時間が正しくありません']);
}

$now = date('Y-m-d H:i:s');
$stmt = db()->prepare('SELECT * FROM member_shifts WHERE user_id = :user_id AND shift_date = :shift_date');
$stmt->execute([':user_id' => $userId, ':shift_date' => $shiftDate]);
$before = $stmt->fetch();
$shiftId = is_array($before) ? $before['id'] : 'shift_' . bin2hex(random_bytes(16));

$save = db()->prepare(
    "INSERT INTO member_shifts
      (id, user_id, shift_date, start_time, end_time, break_minutes, note, created_at, updated_at)
     VALUES
      (:id, :user_id, :shift_date, :start_time, :end_time, :break_minutes, :note, :created_at, :updated_at)
     ON DUPLICATE KEY UPDATE
      start_time = VALUES(start_time),
      end_time = VALUES(end_time),
      break_minutes = VALUES(break_minutes),
      note = VALUES(note),
      updated_at = VALUES(updated_at)"
);
$save->execute([
    ':id' => $shiftId,
    ':user_id' => $userId,
    ':shift_date' => $shiftDate,
    ':start_time' => $startTime === '' ? null : $startTime,
    ':end_time' => $endTime === '' ? null : $endTime,
    ':break_minutes' => $breakMinutes,
    ':note' => $note === '' ? null : $note,
    ':created_at' => $now,
    ':updated_at' => $now,
]);

audit_log('admin', $admin['id'], is_array($before) ? 'shift_update' : 'shift_create', 'member_shift', $shiftId, is_array($before) ? $before : null, [
    'user_id' => $userId,
    'shift_date' => $shiftDate,
    'start_time' => $startTime,
    'end_time' => $endTime,
    'break_minutes' => $breakMinutes,
    'note' => $note,
]);

json_response(200, ['ok' => true, 'shift_id' => $shiftId]);
