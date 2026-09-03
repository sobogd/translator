-- Analytics events/visits have been migrated to the standalone iq-metrix
-- service (prod backup /root/translator_analytics_backup_20260903.dump
-- taken right before this ran; historical rows already imported into
-- iq-metrix's Visit/Event tables). Removed from schema.prisma earlier;
-- kept physically as a rollback safety net until the new pipeline was
-- confirmed working end to end — it now is.
DROP TABLE IF EXISTS "events_new";
DROP TABLE IF EXISTS "sessions_new";
DROP TABLE IF EXISTS "analytics_salt";
