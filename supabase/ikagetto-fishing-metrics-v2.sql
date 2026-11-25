-- Save the measurements from the same catch as the published personal best.
-- Apply after ikagetto-ranking-v1.sql. Existing scores can have no measurements.

ALTER TABLE ikagetto_ranking_private.runs
  ADD COLUMN length_meters integer,
  ADD COLUMN weight_kg integer,
  ADD COLUMN elapsed_ms integer,
  ADD CONSTRAINT ikagetto_run_catch_metrics CHECK (
    (length_meters IS NULL AND weight_kg IS NULL AND elapsed_ms IS NULL)
    OR (mode = 'fishing' AND length_meters IS NOT NULL AND weight_kg IS NOT NULL
      AND elapsed_ms IS NOT NULL AND length_meters BETWEEN 1 AND 30
      AND weight_kg BETWEEN 1 AND 10000 AND elapsed_ms >= 0)
  );

ALTER TABLE ikagetto_ranking_private.best_scores
  ADD COLUMN length_meters integer,
  ADD COLUMN weight_kg integer,
  ADD COLUMN elapsed_ms integer,
  ADD CONSTRAINT ikagetto_best_catch_metrics CHECK (
    (length_meters IS NULL AND weight_kg IS NULL AND elapsed_ms IS NULL)
    OR (mode = 'fishing' AND length_meters IS NOT NULL AND weight_kg IS NOT NULL
      AND elapsed_ms IS NOT NULL AND length_meters BETWEEN 1 AND 30
      AND weight_kg BETWEEN 1 AND 10000 AND elapsed_ms >= 0)
  );

GRANT UPDATE (length_meters, weight_kg, elapsed_ms)
  ON ikagetto_ranking_private.runs, ikagetto_ranking_private.best_scores
  TO ikagetto_ranking_executor;

CREATE FUNCTION ikagetto_ranking_private.finish_run_with_metrics(
  p_run_id uuid, p_score integer, p_length_meters integer, p_weight_kg integer, p_elapsed_ms integer,
  p_require_metrics boolean
)
RETURNS TABLE (rank bigint, play_count bigint) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_mode text;
  v_display_name text;
  v_normalized_name text;
  v_existing ikagetto_ranking_private.runs%ROWTYPE;
BEGIN
  IF p_run_id IS NULL OR p_score IS NULL OR p_score NOT BETWEEN 0 AND 50000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ikagetto_invalid_finish';
  END IF;
  IF p_require_metrics AND (p_length_meters IS NULL OR p_weight_kg IS NULL OR p_elapsed_ms IS NULL
      OR p_length_meters NOT BETWEEN 1 AND 30 OR p_weight_kg NOT BETWEEN 1 AND 10000 OR p_elapsed_ms < 0) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ikagetto_invalid_catch_metrics';
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

CREATE FUNCTION ikagetto_ranking_private.fishing_board_with_metrics(p_limit integer)
RETURNS TABLE (rank bigint, display_name text, score integer, length_meters integer, weight_kg integer, elapsed_ms integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ikagetto_invalid_board';
  END IF;

  RETURN QUERY SELECT pg_catalog.rank() OVER (ORDER BY b.score DESC),
      b.display_name, b.score, b.length_meters, b.weight_kg, b.elapsed_ms
    FROM ikagetto_ranking_private.best_scores AS b
    WHERE b.mode = 'fishing'
    ORDER BY b.score DESC, b.normalized_name
    LIMIT p_limit;
END;
$$;

GRANT CREATE ON SCHEMA ikagetto_ranking_private TO ikagetto_ranking_executor;
ALTER FUNCTION ikagetto_ranking_private.finish_run_with_metrics(uuid, integer, integer, integer, integer, boolean)
  OWNER TO ikagetto_ranking_executor;
ALTER FUNCTION ikagetto_ranking_private.fishing_board_with_metrics(integer) OWNER TO ikagetto_ranking_executor;
REVOKE CREATE ON SCHEMA ikagetto_ranking_private FROM ikagetto_ranking_executor;

REVOKE ALL ON FUNCTION
  ikagetto_ranking_private.finish_run_with_metrics(uuid, integer, integer, integer, integer, boolean),
  ikagetto_ranking_private.fishing_board_with_metrics(integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  ikagetto_ranking_private.finish_run_with_metrics(uuid, integer, integer, integer, integer, boolean),
  ikagetto_ranking_private.fishing_board_with_metrics(integer) TO anon, authenticated;

-- Older pending submissions continue to work. If one sets a higher best score,
-- its unmeasured values replace the previous catch's measurements with NULLs.
CREATE OR REPLACE FUNCTION ikagetto_ranking_private.finish_run(p_run_id uuid, p_score integer)
RETURNS TABLE (rank bigint, play_count bigint) LANGUAGE sql SECURITY DEFINER SET search_path = ''
BEGIN ATOMIC
  SELECT * FROM ikagetto_ranking_private.finish_run_with_metrics(p_run_id, p_score, NULL, NULL, NULL, false);
END;

CREATE FUNCTION public.ikagetto_fishing_finish_v2(
  p_run_id uuid, p_score integer, p_length_meters integer, p_weight_kg integer, p_elapsed_ms integer
)
RETURNS TABLE (rank bigint, play_count bigint) LANGUAGE sql SECURITY INVOKER SET search_path = ''
BEGIN ATOMIC
  SELECT * FROM ikagetto_ranking_private.finish_run_with_metrics(
    p_run_id, p_score, p_length_meters, p_weight_kg, p_elapsed_ms, true
  );
END;

CREATE FUNCTION public.ikagetto_fishing_board_v2(p_limit integer)
RETURNS TABLE (rank bigint, display_name text, score integer, length_meters integer, weight_kg integer, elapsed_ms integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
BEGIN ATOMIC
  SELECT * FROM ikagetto_ranking_private.fishing_board_with_metrics(p_limit);
END;

REVOKE ALL ON FUNCTION public.ikagetto_fishing_finish_v2(uuid, integer, integer, integer, integer),
  public.ikagetto_fishing_board_v2(integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ikagetto_fishing_finish_v2(uuid, integer, integer, integer, integer),
  public.ikagetto_fishing_board_v2(integer) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
