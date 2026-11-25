-- Apply after ikagetto-fishing-metrics-v2.sql. Existing boards and catch data stay in place.
-- Run as a migration. For direct SQL Editor use, wrap the full script in a transaction.

CREATE ROLE ikagetto_ranking_reader NOLOGIN NOINHERIT NOBYPASSRLS;
GRANT ikagetto_ranking_reader TO postgres;
GRANT USAGE, CREATE ON SCHEMA ikagetto_ranking_private TO ikagetto_ranking_reader;
GRANT SELECT (mode, normalized_name, display_name, score, length_meters, weight_kg, elapsed_ms)
  ON ikagetto_ranking_private.best_scores TO ikagetto_ranking_reader;
CREATE POLICY reader_board ON ikagetto_ranking_private.best_scores
  FOR SELECT TO ikagetto_ranking_reader USING (true);

CREATE FUNCTION ikagetto_ranking_private.board_page(p_mode text, p_offset integer, p_limit integer)
RETURNS TABLE (
  rank bigint, display_name text, score integer, length_meters integer,
  weight_kg integer, elapsed_ms integer, has_more boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_mode IS NULL OR p_mode NOT IN ('fishing', 'butcher', 'cooking')
     OR p_offset IS NULL OR p_offset < 0 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ikagetto_invalid_board';
  END IF;

  -- Rank all preceding scores before skipping rows. A single extra row detects the next page.
  RETURN QUERY
    SELECT page.board_rank, page.display_name, page.score, page.length_meters, page.weight_kg,
           page.elapsed_ms, pg_catalog.count(*) OVER () > p_limit
    FROM (
      SELECT pg_catalog.rank() OVER (ORDER BY b.score DESC) AS board_rank,
             b.normalized_name, b.display_name, b.score, b.length_meters, b.weight_kg, b.elapsed_ms
      FROM ikagetto_ranking_private.best_scores AS b
      WHERE b.mode = p_mode
      ORDER BY b.score DESC, b.normalized_name
      LIMIT (p_limit + 1) OFFSET p_offset
    ) AS page
    ORDER BY page.score DESC, page.normalized_name
    LIMIT p_limit;
END;
$$;

ALTER FUNCTION ikagetto_ranking_private.board_page(text, integer, integer) OWNER TO ikagetto_ranking_reader;
REVOKE CREATE ON SCHEMA ikagetto_ranking_private FROM ikagetto_ranking_reader;
REVOKE ALL ON FUNCTION ikagetto_ranking_private.board_page(text, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION ikagetto_ranking_private.board_page(text, integer, integer) TO anon, authenticated;

-- Resolve the private function when creating the wrapper. Public roles need no private schema access.
CREATE FUNCTION public.ikagetto_board_page_v3(p_mode text, p_offset integer, p_limit integer)
RETURNS TABLE (
  rank bigint, display_name text, score integer, length_meters integer,
  weight_kg integer, elapsed_ms integer, has_more boolean
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
BEGIN ATOMIC
  SELECT * FROM ikagetto_ranking_private.board_page(p_mode, p_offset, p_limit);
END;

REVOKE ALL ON FUNCTION public.ikagetto_board_page_v3(text, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ikagetto_board_page_v3(text, integer, integer) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
