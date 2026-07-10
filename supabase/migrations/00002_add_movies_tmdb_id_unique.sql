-- ─── Add unique constraint on movies.tmdb_id ───
-- Allows the Discover "Add to library" flow to use onConflict: 'tmdb_id'
            
-- Drop the existing non-unique index first
DROP INDEX IF EXISTS idx_movies_tmdb_id;

-- Create a unique index (NULLs remain distinct — multiple NULL tmdb_ids are allowed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_movies_tmdb_id ON movies (tmdb_id);
