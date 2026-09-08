<?php
declare(strict_types=1);

return [
    'db' => [
        'host' => 'mysql000.example.jp',
        'name' => 'example_db',
        'user' => 'example_user',
        'password' => 'example_password',
    ],
    'photo_dir' => 'storage/photos',
    'photo_url_base' => '/storage/photos',
    'correction_request_mail_to' => 'info@miwaya.site',
    'max_photo_bytes' => 8 * 1024 * 1024,
    'max_request_bytes' => 10 * 1024 * 1024,
];
