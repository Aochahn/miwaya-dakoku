CREATE TABLE IF NOT EXISTS shift_preferences (
  user_id VARCHAR(64) PRIMARY KEY,
  role ENUM('hall', 'kitchen') NOT NULL DEFAULT 'hall',
  available_days VARCHAR(32) NOT NULL DEFAULT '',
  available_start TIME NOT NULL DEFAULT '17:30:00',
  available_end TIME NOT NULL DEFAULT '24:00:00',
  priority TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_shift_preferences_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
