<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

require_admin();

$stmt = db()->query(
    "SELECT id, actor_type, actor_id, action, target_type, target_id, ip_address, user_agent, created_at
     FROM audit_logs
     ORDER BY created_at DESC
     LIMIT 200"
);

json_response(200, ['logs' => $stmt->fetchAll()]);
