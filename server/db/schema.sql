CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID,
  type TEXT,
  payload JSONB,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  type TEXT,
  confidence FLOAT
);

CREATE TABLE pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT,
  entity_id UUID,
  content JSONB,
  published_at TIMESTAMP
);
