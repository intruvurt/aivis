/**
 * CITE LEDGER MIGRATION
 * Adds the constitutional truth layer tables to the database
 */

export default async function migrateCiteLedger(db: any) {
  console.log('[Migration] Creating CITE LEDGER tables...');

  // Main cite ledger table - immutable evidence entries
  await db.query(`
    CREATE TABLE IF NOT EXISTS cite_ledger_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      url TEXT NOT NULL,
      audit_id UUID,
      
      -- Source tracking
      source_type VARCHAR(50) NOT NULL,
      source_metadata JSONB DEFAULT '{}',
      
      -- Raw evidence (immutable)
      raw_evidence TEXT NOT NULL,
      raw_evidence_hash VARCHAR(64) NOT NULL,
      
      -- Interpretation
      extracted_signal TEXT NOT NULL,
      entity_refs JSONB[] DEFAULT '{}',
      
      -- Credibility
      confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
      confidence_basis TEXT,
      
      -- Context
      interpretation TEXT,
      related_findings TEXT[] DEFAULT '{}',
      related_fixes TEXT[] DEFAULT '{}',
      
      -- Tamper detection
      ledger_hash VARCHAR(64) NOT NULL UNIQUE,
      previous_hash VARCHAR(64),
      
      -- Temporal
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      expires_at BIGINT,
      
      -- Metadata
      tags TEXT[] DEFAULT '{}',
      
      -- Indexing
      created_at_idx TIMESTAMP GENERATED ALWAYS AS (to_timestamp(created_at::double precision / 1000)) STORED,
      
      FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_cite_url ON cite_ledger_entries(url);
    CREATE INDEX IF NOT EXISTS idx_cite_audit_id ON cite_ledger_entries(audit_id);
    CREATE INDEX IF NOT EXISTS idx_cite_source_type ON cite_ledger_entries(source_type);
    CREATE INDEX IF NOT EXISTS idx_cite_confidence ON cite_ledger_entries(confidence_score);
    CREATE INDEX IF NOT EXISTS idx_cite_created ON cite_ledger_entries(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_cite_tags ON cite_ledger_entries USING GIN(tags);
  `, console.error);

  // Registry patterns table - learned from cite entries
  await db.query(`
    CREATE TABLE IF NOT EXISTS cite_registry_patterns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      fingerprint VARCHAR(64) UNIQUE NOT NULL,
      detected_pattern TEXT NOT NULL,
      
      -- Evidence lineage (back to cites)
      related_cite_ids TEXT[] NOT NULL,
      cite_count INT NOT NULL DEFAULT 0,
      
      -- Temporal
      first_seen BIGINT NOT NULL,
      last_seen BIGINT NOT NULL,
      recency_decay DECIMAL(3,2) DEFAULT 1.0,
      
      -- Effectiveness
      success_rate DECIMAL(3,2) DEFAULT 0.5,
      avg_confidence DECIMAL(3,2) DEFAULT 0.5,
      
      -- Scope
      urls TEXT[] DEFAULT '{}',
      entity_refs JSONB[] DEFAULT '{}',
      
      -- Metadata
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      
      INDEX idx_pattern_fingerprint (fingerprint),
      INDEX idx_pattern_detection (detected_pattern),
      INDEX idx_pattern_success (success_rate DESC)
    );
    
    CREATE INDEX IF NOT EXISTS idx_registry_fingerprint ON cite_registry_patterns(fingerprint);
    CREATE INDEX IF NOT EXISTS idx_registry_pattern ON cite_registry_patterns(detected_pattern);
    CREATE INDEX IF NOT EXISTS idx_registry_success ON cite_registry_patterns(success_rate DESC);
  `, console.error);

  // Fixes table - remediation backed by cite evidence
  await db.query(`
    CREATE TABLE IF NOT EXISTS cite_fixes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      registry_fingerprint VARCHAR(64),
      
      -- Evidence supporting fix
      cite_ids TEXT[] NOT NULL,
      
      -- Fix specification
      category VARCHAR(50) NOT NULL,
      finding_type TEXT NOT NULL,
      description TEXT NOT NULL,
      
      -- Implementation
      action_type VARCHAR(20) NOT NULL,
      target_selector TEXT,
      before_value TEXT,
      after_value TEXT,
      implementation_code TEXT,
      
      -- Expected outcome
      expected_effect TEXT,
      confidence_in_effect DECIMAL(3,2),
      
      -- Status
      status VARCHAR(20) NOT NULL DEFAULT 'proposed',
      result_cite_ids TEXT[] DEFAULT '{}',
      
      -- Timeline
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      
      FOREIGN KEY (registry_fingerprint) REFERENCES cite_registry_patterns(fingerprint) ON DELETE SET NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_fixes_status ON cite_fixes(status);
    CREATE INDEX IF NOT EXISTS idx_fixes_registry ON cite_fixes(registry_fingerprint);
    CREATE INDEX IF NOT EXISTS idx_fixes_created ON cite_fixes(created_at DESC);
  `, console.error);

  // Audit cite summary table - materialized view for performance
  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_cite_summary (
      audit_id UUID PRIMARY KEY,
      total_cites INT NOT NULL DEFAULT 0,
      avg_confidence DECIMAL(3,2),
      source_breakdown JSONB DEFAULT '{}',
      detected_patterns TEXT[] DEFAULT '{}',
      proposed_fixes INT DEFAULT 0,
      last_updated BIGINT,
      
      FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_audit_cite_summary ON audit_cite_summary(audit_id);
  `, console.error);

  console.log('[Migration] CITE LEDGER tables created successfully');
}
