-- 31m-50m colossal squid: widen the fishing limits.
--   fishing:          score 0..80,000, length 1..50 m, weight 1..45,000 kg
--   butcher, cooking: score 0..50,000 (unchanged)
-- Apply after ikagetto-board-pagination-v3.sql. Existing rows and API names stay the same,
-- so the current client keeps working before and after this migration.
-- Run as a migration. For direct SQL Editor use, wrap the full script in a transaction.
-- Constraint names below are the ones PostgreSQL created for v1 / v2 (checked on the live project).

ALTER TABLE ikagetto_ranking_private.runs
  DROP CONSTRAINT runs_score_check,
  DROP CONSTRAINT ikagetto_run_catch_metrics;
ALTER TABLE ikagetto_ranking_private.runs
  ADD CONSTRAINT runs_score_check CHECK (
    score BETWEEN 0 AND CASE WHEN mode = 'fishing' THEN 80000 ELSE 50000 END
  ),
  ADD CONSTRAINT ikagetto_run_catch_metrics CHECK (
    (length_meters IS NULL AND weight_kg IS NULL AND elapsed_ms IS NULL)
    OR (mode = 'fishing' AND length_meters IS NOT NULL AND weight_kg IS NOT NULL
      AND elapsed_ms IS NOT NULL AND length_meters BETWEEN 1 AND 50
      AND weight_kg BETWEEN 1 AND 45000 AND elapsed_ms >= 0)
  );

ALTER TABLE ikagetto_ranking_private.best_scores
  DROP CONSTRAINT best_scores_score_check,
  DROP CONSTRAINT ikagetto_best_catch_metrics;
ALTER TABLE ikagetto_ranking_private.best_scores
  ADD CONSTRAINT best_scores_score_check CHECK (
    score BETWEEN 0 AND CASE WHEN mode = 'fishing' THEN 80000 ELSE 50000 END
  ),
  ADD CONSTRAINT ikagetto_best_catch_metrics CHECK (
    (length_meters IS NULL AND weight_kg IS NULL AND elapsed_ms IS NULL)
    OR (mode = 'fishing' AND length_meters IS NOT NULL AND weight_kg IS NOT NULL
      AND elapsed_ms IS NOT NULL AND length_meters BETWEEN 1 AND 50
      AND weight_kg BETWEEN 1 AND 45000 AND elapsed_ms >= 0)
  );

-- Same function and signature as v2; only the limits change. The owner stays
-- ikagetto_ranking_executor, and the public wrappers (ikagetto_finish_v1,
-- ikagetto_fishing_finish_v2) keep calling it unchanged.
GRANT CREATE ON SCHEMA ikagetto_ranking_private TO ikagetto_ranking_executor;

CREATE OR REPLACE FUNCTION ikagetto_ranking_private.finish_run_with_metrics(
  p_run_id uuid, p_score integer, p_length_meters integer, p_weight_kg integer, p_elapsed_ms integer,
  p_require_metrics boolean
)
RETURNS TABLE (rank bigint, play_count bigint) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_mode text;
  v_display_name text;
  v_normalized_name text;
  v_existing ikagetto_ranking_private.runs%ROWTYPE;
  v_run_mode text;
BEGIN
  IF p_run_id IS NULL OR p_score IS NULL OR p_score NOT BETWEEN 0 AND 80000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ikagetto_invalid_finish';
  END IF;
  IF p_require_metrics AND (p_length_meters IS NULL OR p_weight_kg IS NULL OR p_elapsed_ms IS NULL
      OR p_length_meters NOT BETWEEN 1 AND 50 OR p_weight_kg NOT BETWEEN 1 AND 45000 OR p_elapsed_ms < 0) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ikagetto_invalid_catch_metrics';
  END IF;
  -- Only fishing can go above 50,000. Answer with 22023 (not a CHECK error) so the
  -- client drops the bad request instead of retrying it.
  IF p_score > 50000 THEN
    SELECT r.mode INTO v_run_mode FROM ikagetto_ranking_private.runs AS r WHERE r.run_id = p_run_id;
    IF v_run_mode IS DISTINCT FROM 'fishing' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ikagetto_invalid_finish';
    END IF;
  END IF;

  UPDATE ikagetto_ranking_private.runs AS r
    SET score = p_score, finished_at = pg_catalog.clock_timestamp(),
        length_meters = p_length_meters, weight_kg = p_weight_kg, elapsed_ms = p_elapsed_ms
    WHERE r.run_id = p_run_id AND r.score IS NULL AND (NOT p_require_metrics OR r.mode = 'fishing')
    RETURNING r.mode, r.display_name, r.normalized_name INTO v_mode, v_display_name, v_normalized_name;

  IF FOUND THEN
    IF v_normalized_name IS NOT NULL THEN
      INSERT INTO ikagetto_ranking_private.best_scores AS b
        (mode, normalized_name, display_name, score, length_meters, weight_kg, elapsed_ms)
      VALUES (v_mode, v_normalized_name, v_display_name, p_score, p_length_meters, p_weight_kg, p_elapsed_ms)
      ON CONFLICT (mode, normalized_name) DO UPDATE
        SET display_name = EXCLUDED.display_name, score = EXCLUDED.score,
            length_meters = EXCLUDED.length_meters, weight_kg = EXCLUDED.weight_kg, elapsed_ms = EXCLUDED.elapsed_ms
        WHERE b.score < EXCLUDED.score OR (
          b.score = EXCLUDED.score AND b.length_meters IS NULL AND EXCLUDED.length_meters IS NOT NULL
        );
    END IF;
  ELSE
    SELECT r.* INTO v_existing FROM ikagetto_ranking_private.runs AS r WHERE r.run_id = p_run_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ikagetto_unknown_run';
    END IF;
    IF p_require_metrics AND v_existing.mode <> 'fishing' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ikagetto_invalid_catch_mode';
    END IF;
    IF v_existing.score IS DISTINCT FROM p_score OR (p_require_metrics AND
        (v_existing.length_meters, v_existing.weight_kg, v_existing.elapsed_ms)
        IS DISTINCT FROM (p_length_meters, p_weight_kg, p_elapsed_ms)) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ikagetto_finish_conflict';
    END IF;
    v_mode := v_existing.mode;
    v_normalized_name := v_existing.normalized_name;
  END IF;

  RETURN QUERY SELECT CASE WHEN v_normalized_name IS NOT NULL THEN 1 + (
    SELECT pg_catalog.count(*) FROM ikagetto_ranking_private.best_scores AS b
      WHERE b.mode = v_mode AND b.score > p_score
  ) END, m.play_count
    FROM ikagetto_ranking_private.modes AS m WHERE m.mode = v_mode;
END;
$$;

REVOKE CREATE ON SCHEMA ikagetto_ranking_private FROM ikagetto_ranking_executor;

-- CREATE OR REPLACE keeps the existing grants; restate them so the result does not depend on that.
REVOKE ALL ON FUNCTION
  ikagetto_ranking_private.finish_run_with_metrics(uuid, integer, integer, integer, integer, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  ikagetto_ranking_private.finish_run_with_metrics(uuid, integer, integer, integer, integer, boolean)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
