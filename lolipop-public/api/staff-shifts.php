<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

$userId = (string) ($_GET['user_id'] ?? '');
require_staff_user($userId);

$stmt = db()->prepare(
    "SELECT id, user_id, shift_date, start_time, end_time, break_minutes, note
     FROM member_shifts
     WHERE user_id = :user_id
       AND shift_date >= CURDATE()
     ORDER BY shift_date ASC
     LIMIT 14"
);
$stmt->execute([':user_id' => $userId]);

json_response(200, ['shifts' => $stmt->fetchAll()]);
