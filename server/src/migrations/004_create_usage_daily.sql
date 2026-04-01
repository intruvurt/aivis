CREATE TABLE usage_daily (
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  requests INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);
