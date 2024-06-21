CREATE DATABASE IF NOT EXISTS inventory_db;

USE inventory_db;

CREATE TABLE IF NOT EXISTS inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item VARCHAR(255) NOT NULL,
  quantity INT NOT NULL
);

INSERT INTO inventory (item, quantity) VALUES
('apple', 50),
('banana', 100),
('orange', 75);
