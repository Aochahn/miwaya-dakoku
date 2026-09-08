<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

require_admin();

try {
    $stmt = db()->query(
        "SELECT
            DATE(ar.recorded_at) AS date,
            ar.user_id,
            u.name AS staff_name,
            MIN(CASE WHEN ar.type = 'clock_in' THEN ar.recorded_at END) AS clock_in,
            MAX(CASE WHEN ar.type = 'clock_out' THEN ar.recorded_at END) AS clock_out,
            SUBSTRING_INDEX(
              GROUP_CONCAT(CASE WHEN ar.type = 'clock_in' THEN ar.photo_url END ORDER BY ar.recorded_at ASC SEPARATOR ','),
              ',',
              1
            ) AS photo_url
         FROM attendance_records ar
         INNER JOIN users u ON u.id = ar.user_id
         GROUP BY DATE(ar.recorded_at), ar.user_id, u.name
         ORDER BY date DESC, clock_in DESC"
    );

    json_response(200, ['rows' => $stmt->fetchAll()]);
} catch (Throwable $error) {
    json_response(500, ['error' => '勤怠一覧を取得できませんでした']);
}
