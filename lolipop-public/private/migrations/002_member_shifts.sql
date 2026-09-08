CREATE TABLE IF NOT EXISTS member_shifts (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  shift_date DATE NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  break_minutes INT NOT NULL DEFAULT 0,
  note TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uniq_member_shift_user_date (user_id, shift_date),
  INDEX idx_member_shifts_date (shift_date),
  CONSTRAINT fk_member_shifts_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
