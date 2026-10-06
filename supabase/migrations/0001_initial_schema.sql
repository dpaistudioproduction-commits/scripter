-- Enable uuid-ossp extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table for user preferences and basic info
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Main script projects
CREATE TABLE script_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    script_type TEXT,
    language TEXT DEFAULT 'Malayalam',
    screenplay_style TEXT DEFAULT 'Standard Film Screenplay',
    status TEXT DEFAULT 'draft',
    google_doc_id TEXT,
    google_doc_url TEXT,
    active_revision_id UUID, -- Will be set once revisions are created
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audio recordings
CREATE TABLE audio_recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES script_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    mime_type TEXT,
    duration NUMERIC,
    processing_status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transcript segments (raw speech chunks)
CREATE TABLE transcript_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES script_projects(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    raw_text TEXT NOT NULL,
    clean_text TEXT,
    start_time NUMERIC,
    end_time NUMERIC,
    audio_chunk_id UUID REFERENCES audio_recordings(id) ON DELETE SET NULL,
    transcription_provider TEXT,
    confidence NUMERIC,
    verification_status TEXT DEFAULT 'unverified',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Script characters (project glossary)
CREATE TABLE script_characters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES script_projects(id) ON DELETE CASCADE,
    character_name TEXT NOT NULL,
    alternate_names TEXT[],
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, character_name)
);

-- Screenplay scenes
CREATE TABLE screenplay_scenes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES script_projects(id) ON DELETE CASCADE,
    scene_number INTEGER,
    heading TEXT,
    location TEXT,
    time_of_day TEXT,
    sequence_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Screenplay blocks (actual lines/paragraphs of the script)
CREATE TABLE screenplay_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES script_projects(id) ON DELETE CASCADE,
    scene_id UUID REFERENCES screenplay_scenes(id) ON DELETE CASCADE,
    block_type TEXT NOT NULL,
    character_id UUID REFERENCES script_characters(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    transcript_segment_ids UUID[],
    sequence_number INTEGER NOT NULL,
    confidence NUMERIC,
    verification_status TEXT DEFAULT 'unverified',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Script Revisions
CREATE TABLE script_revisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES script_projects(id) ON DELETE CASCADE,
    revision_number INTEGER NOT NULL,
    transcript_snapshot JSONB,
    screenplay_snapshot JSONB,
    revision_source TEXT DEFAULT 'auto',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add the FK for active_revision_id after script_revisions exists
ALTER TABLE script_projects 
ADD CONSTRAINT fk_active_revision 
FOREIGN KEY (active_revision_id) REFERENCES script_revisions(id) ON DELETE SET NULL;

-- Google Integrations
CREATE TABLE google_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    encrypted_token_reference TEXT NOT NULL,
    scopes TEXT[],
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Document sync jobs
CREATE TABLE document_sync_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES script_projects(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL,
    revision_number INTEGER,
    operation_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS)

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Projects
ALTER TABLE script_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own projects" ON script_projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON script_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON script_projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON script_projects FOR DELETE USING (auth.uid() = user_id);

-- Audio recordings
ALTER TABLE audio_recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own recordings" ON audio_recordings FOR ALL USING (auth.uid() = user_id);

-- Everything else needs to be joined to project for RLS, or we can use a subquery.
-- For performance, it's common to add user_id to these tables, but using a subquery is fine.

-- Transcript segments
ALTER TABLE transcript_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own transcript segments" ON transcript_segments FOR ALL USING (
    project_id IN (SELECT id FROM script_projects WHERE user_id = auth.uid())
);

-- Script characters
ALTER TABLE script_characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own characters" ON script_characters FOR ALL USING (
    project_id IN (SELECT id FROM script_projects WHERE user_id = auth.uid())
);

-- Screenplay scenes
ALTER TABLE screenplay_scenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own scenes" ON screenplay_scenes FOR ALL USING (
    project_id IN (SELECT id FROM script_projects WHERE user_id = auth.uid())
);

-- Screenplay blocks
ALTER TABLE screenplay_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own screenplay blocks" ON screenplay_blocks FOR ALL USING (
    project_id IN (SELECT id FROM script_projects WHERE user_id = auth.uid())
);

-- Script Revisions
ALTER TABLE script_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own revisions" ON script_revisions FOR ALL USING (
    project_id IN (SELECT id FROM script_projects WHERE user_id = auth.uid())
);

-- Google integrations
ALTER TABLE google_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own google integrations" ON google_integrations FOR ALL USING (auth.uid() = user_id);

-- Sync jobs
ALTER TABLE document_sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sync jobs" ON document_sync_jobs FOR SELECT USING (
    project_id IN (SELECT id FROM script_projects WHERE user_id = auth.uid())
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_script_projects_updated_at BEFORE UPDATE ON script_projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transcript_segments_updated_at BEFORE UPDATE ON transcript_segments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_script_characters_updated_at BEFORE UPDATE ON script_characters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_screenplay_scenes_updated_at BEFORE UPDATE ON screenplay_scenes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_screenplay_blocks_updated_at BEFORE UPDATE ON screenplay_blocks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_google_integrations_updated_at BEFORE UPDATE ON google_integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_document_sync_jobs_updated_at BEFORE UPDATE ON document_sync_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
