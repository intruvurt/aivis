CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS analyze_jobs (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID REFERENCES users(id) ON DELETE SET NULL,
	workspace_id UUID,
	source_type TEXT NOT NULL CHECK (source_type IN ('domain', 'url', 'keyword')),
	source_input TEXT NOT NULL,
	mode TEXT NOT NULL CHECK (mode IN ('visibility', 'content', 'audit')),
	depth TEXT NOT NULL CHECK (depth IN ('light', 'deep', 'recursive')),
	state TEXT NOT NULL CHECK (
		state IN (
			'SCAN_INIT',
			'ENTITY_MAPPING',
			'VISIBILITY_GAP_ANALYSIS',
			'PAGE_SPEC_GENERATION',
			'CONTENT_COMPILATION',
			'SCHEMA_BINDING',
			'GRAPH_LINKING',
			'READY',
			'PUBLISHED',
			'FAILED'
		)
	),
	attempt_count INT NOT NULL DEFAULT 0,
	idempotency_key TEXT,
	request_hash TEXT NOT NULL,
	current_stage_started_at TIMESTAMPTZ,
	completed_at TIMESTAMPTZ,
	failure_reason TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analyze_jobs_state_created ON analyze_jobs(state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyze_jobs_user_created ON analyze_jobs(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_analyze_jobs_idempotency ON analyze_jobs(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS analyze_job_events (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	job_id UUID NOT NULL REFERENCES analyze_jobs(id) ON DELETE CASCADE,
	sequence BIGINT NOT NULL,
	stage TEXT NOT NULL,
	event_type TEXT NOT NULL CHECK (event_type IN (
		'SCAN_CREATED',
		'ENTITIES_RESOLVED',
		'GAP_ANALYZED',
		'PAGE_SPEC_CREATED',
		'PAGE_COMPILED',
		'SCHEMA_BOUND',
		'GRAPH_LINKED',
		'READY_REACHED',
		'PAGE_PUBLISHED',
		'RESCAN_COMPLETED',
		'STAGE_FAILED'
	)),
	payload JSONB NOT NULL DEFAULT '{}'::jsonb,
	state_delta JSONB NOT NULL DEFAULT '{}'::jsonb,
	parent_hash TEXT,
	event_hash TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (job_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_analyze_job_events_job_seq ON analyze_job_events(job_id, sequence ASC);

CREATE TABLE IF NOT EXISTS entity_nodes (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	job_id UUID NOT NULL REFERENCES analyze_jobs(id) ON DELETE CASCADE,
	entity_key TEXT NOT NULL,
	name TEXT NOT NULL,
	entity_type TEXT NOT NULL,
	confidence DOUBLE PRECISION NOT NULL,
	metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (job_id, entity_key)
);

CREATE TABLE IF NOT EXISTS entity_edges (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	job_id UUID NOT NULL REFERENCES analyze_jobs(id) ON DELETE CASCADE,
	from_entity_key TEXT NOT NULL,
	to_entity_key TEXT NOT NULL,
	edge_type TEXT NOT NULL CHECK (edge_type IN ('ENTITY_ENTITY', 'ENTITY_TOPIC', 'ENTITY_QUERY')),
	confidence DOUBLE PRECISION NOT NULL,
	metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (job_id, from_entity_key, to_entity_key, edge_type)
);

CREATE TABLE IF NOT EXISTS entity_gap_models (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	job_id UUID NOT NULL REFERENCES analyze_jobs(id) ON DELETE CASCADE,
	entity_key TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('represented', 'underrepresented', 'uncited')),
	opportunity_score DOUBLE PRECISION NOT NULL,
	citation_presence BOOLEAN NOT NULL,
	semantic_saturation DOUBLE PRECISION,
	authority_gap DOUBLE PRECISION,
	structural_absence JSONB NOT NULL DEFAULT '[]'::jsonb,
	missing_page_types JSONB NOT NULL DEFAULT '[]'::jsonb,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (job_id, entity_key)
);

CREATE TABLE IF NOT EXISTS page_specs (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	job_id UUID NOT NULL REFERENCES analyze_jobs(id) ON DELETE CASCADE,
	entity_key TEXT NOT NULL,
	intent TEXT NOT NULL CHECK (intent IN ('define', 'compare', 'explain', 'prove', 'demonstrate')),
	title TEXT NOT NULL,
	slug TEXT NOT NULL,
	target_query_cluster JSONB NOT NULL DEFAULT '[]'::jsonb,
	required_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
	schema_type TEXT NOT NULL,
	priority DOUBLE PRECISION NOT NULL,
	internal_links JSONB NOT NULL DEFAULT '[]'::jsonb,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (job_id, slug)
);

CREATE TABLE IF NOT EXISTS page_builds (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	job_id UUID NOT NULL REFERENCES analyze_jobs(id) ON DELETE CASCADE,
	page_spec_id UUID NOT NULL REFERENCES page_specs(id) ON DELETE CASCADE,
	title TEXT NOT NULL,
	slug TEXT NOT NULL,
	sections JSONB NOT NULL,
	claims JSONB NOT NULL DEFAULT '[]'::jsonb,
	internal_links JSONB NOT NULL DEFAULT '[]'::jsonb,
	render_markdown TEXT,
	render_html TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (job_id, page_spec_id)
);

CREATE TABLE IF NOT EXISTS page_schema_bindings (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	job_id UUID NOT NULL REFERENCES analyze_jobs(id) ON DELETE CASCADE,
	page_build_id UUID NOT NULL REFERENCES page_builds(id) ON DELETE CASCADE,
	schema_payload JSONB NOT NULL,
	entity_mentions JSONB NOT NULL DEFAULT '[]'::jsonb,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (page_build_id)
);

CREATE TABLE IF NOT EXISTS page_link_graph (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	job_id UUID NOT NULL REFERENCES analyze_jobs(id) ON DELETE CASCADE,
	from_page_build_id UUID NOT NULL REFERENCES page_builds(id) ON DELETE CASCADE,
	to_page_build_id UUID NOT NULL REFERENCES page_builds(id) ON DELETE CASCADE,
	reason TEXT NOT NULL CHECK (reason IN ('entity_overlap', 'shared_topic_cluster', 'reinforcement_gap')),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (job_id, from_page_build_id, to_page_build_id, reason)
);

CREATE TABLE IF NOT EXISTS publish_artifacts (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	job_id UUID NOT NULL REFERENCES analyze_jobs(id) ON DELETE CASCADE,
	page_build_id UUID NOT NULL REFERENCES page_builds(id) ON DELETE CASCADE,
	format TEXT NOT NULL CHECK (format IN ('html', 'markdown', 'jsonld', 'api')),
	artifact_path TEXT NOT NULL,
	artifact_hash TEXT NOT NULL,
	is_indexable BOOLEAN NOT NULL DEFAULT true,
	published_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (page_build_id, format)
);

CREATE TABLE IF NOT EXISTS analyze_rescan_results (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	job_id UUID NOT NULL REFERENCES analyze_jobs(id) ON DELETE CASCADE,
	page_build_id UUID REFERENCES page_builds(id) ON DELETE SET NULL,
	pre_visibility DOUBLE PRECISION,
	post_visibility DOUBLE PRECISION,
	delta DOUBLE PRECISION,
	citations_found INT,
	ai_answer_presence BOOLEAN,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE analyze_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyze_job_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_gap_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_schema_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_link_graph ENABLE ROW LEVEL SECURITY;
ALTER TABLE publish_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyze_rescan_results ENABLE ROW LEVEL SECURITY;
