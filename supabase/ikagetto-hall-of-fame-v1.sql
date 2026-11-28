-- Apply after ikagetto-colossal-metrics-v4.sql.
GRANT USAGE, CREATE ON SCHEMA ikagetto_ranking_private TO ikagetto_ranking_reader;
GRANT SELECT (run_id, mode, normalized_name, display_name, score, finished_at,
  length_meters, weight_kg, elapsed_ms)
  ON ikagetto_ranking_private.runs TO ikagetto_ranking_reader;

CREATE POLICY reader_hall_of_fame ON ikagetto_ranking_private.runs
  FOR SELECT TO ikagetto_ranking_reader USING (
    mode = 'fishing' AND length_meters = 50 AND normalized_name IS NOT NULL AND finished_at IS NOT NULL
  );

CREATE FUNCTION ikagetto_ranking_private.hall_of_fame(p_offset integer, p_limit integer)
RETURNS TABLE (
  rank bigint, display_name text, score integer, length_meters integer,
  weight_kg integer, elapsed_ms integer, has_more boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_offset IS NULL OR p_offset < 0 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ikagetto_invalid_hall_page';
  END IF;

  RETURN QUERY
    WITH eligible AS (
      SELECT r.run_id, r.normalized_name, r.display_name, r.score,
             r.length_meters, r.weight_kg, r.elapsed_ms, r.finished_at
        FROM ikagetto_ranking_private.runs AS r
        WHERE r.mode = 'fishing' AND r.length_meters = 50 AND r.finished_at IS NOT NULL
          AND r.normalized_name IS NOT NULL
    ), first_catches AS (
      SELECT DISTINCT ON (e.normalized_name) e.normalized_name, e.finished_at, e.run_id
        FROM eligible AS e ORDER BY e.normalized_name, e.finished_at, e.run_id
    ), best_catches AS (
      SELECT DISTINCT ON (e.normalized_name) e.normalized_name, e.display_name, e.score,
             e.length_meters, e.weight_kg, e.elapsed_ms
        FROM eligible AS e ORDER BY e.normalized_name, e.score DESC, e.finished_at, e.run_id
    ), numbered AS (
      SELECT pg_catalog.row_number() OVER (ORDER BY f.finished_at, f.run_id) AS ordinal,
             b.display_name, b.score, b.length_meters, b.weight_kg, b.elapsed_ms
        FROM first_catches AS f JOIN best_catches AS b USING (normalized_name)
    ), page AS (
      SELECT * FROM numbered ORDER BY ordinal LIMIT (p_limit + 1) OFFSET p_offset
    )
    SELECT page.ordinal, page.display_name, page.score, page.length_meters, page.weight_kg,
           page.elapsed_ms, pg_catalog.count(*) OVER () > p_limit
      FROM page ORDER BY page.ordinal LIMIT p_limit;
END;
$$;

ALTER FUNCTION ikagetto_ranking_private.hall_of_fame(integer, integer) OWNER TO ikagetto_ranking_reader;
REVOKE CREATE ON SCHEMA ikagetto_ranking_private FROM ikagetto_ranking_reader;
REVOKE ALL ON FUNCTION ikagetto_ranking_private.hall_of_fame(integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION ikagetto_ranking_private.hall_of_fame(integer, integer) TO anon, authenticated;

CREATE FUNCTION public.ikagetto_hall_of_fame_v1(p_offset integer, p_limit integer)
RETURNS TABLE (
  rank bigint, display_name text, score integer, length_meters integer,
  weight_kg integer, elapsed_ms integer, has_more boolean
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
BEGIN ATOMIC
  SELECT * FROM ikagetto_ranking_private.hall_of_fame(p_offset, p_limit);
END;

REVOKE ALL ON FUNCTION public.ikagetto_hall_of_fame_v1(integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ikagetto_hall_of_fame_v1(integer, integer) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
