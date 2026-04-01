-- database/migrations/001_licenses.sql

CREATE TABLE licenses (
  id VARCHAR(255) PRIMARY KEY,
  license_key VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  product_name VARCHAR(500) NOT NULL,
  order_number INTEGER NOT NULL,
  sale_id VARCHAR(255) NOT NULL,
  purchase_date TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  activation_count INTEGER DEFAULT 0,
  max_activations INTEGER DEFAULT 3,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE license_activations (
  id VARCHAR(255) PRIMARY KEY,
  license_id VARCHAR(255) REFERENCES licenses(id),
  machine_id VARCHAR(500) NOT NULL,
  activated_at TIMESTAMP NOT NULL,
  deactivated_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  UNIQUE(license_id, machine_id)
);

CREATE TABLE license_verifications (
  id VARCHAR(255) PRIMARY KEY,
  license_id VARCHAR(255) REFERENCES licenses(id),
  verified_at TIMESTAMP NOT NULL,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_licenses_email ON licenses(email);
CREATE INDEX idx_licenses_key ON licenses(license_key);
CREATE INDEX idx_activations_license ON license_activations(license_id);
CREATE INDEX idx_activations_machine ON license_activations(machine_id);
CREATE INDEX idx_verifications_license ON license_verifications(license_id);