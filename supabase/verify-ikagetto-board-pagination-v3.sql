-- Run on an empty disposable database after all three Ikagetto migrations.
BEGIN;

INSERT INTO ikagetto_ranking_private.best_scores
  (mode, normalized_name, display_name, score, length_meters, weight_kg, elapsed_ms)
SELECT 'fishing', 'angler' || lpad(i::text, 4, '0'), 'Angler ' || lpad(i::text, 4, '0'),
  50000 - CASE WHEN i IN (101, 501, 1001) THEN i - 1 ELSE i END,
  CASE WHEN i % 2 = 0 THEN 12 END, CASE WHEN i % 2 = 0 THEN 1500 END,
  CASE WHEN i % 2 = 0 THEN 60000 + i END
FROM generate_series(1, 1203) AS i
ORDER BY i DESC;

INSERT INTO ikagetto_ranking_private.best_scores (mode, normalized_name, display_name, score)
VALUES ('butcher', 'chef', 'Chef', 35000);

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_catalog.pg_roles
    WHERE rolname = 'ikagetto_ranking_reader'
      AND (rolcanlogin OR rolbypassrls OR rolinherit OR rolsuper)
  ) OR pg_catalog.has_schema_privilege('ikagetto_ranking_reader', 'ikagetto_ranking_private', 'CREATE')
    OR pg_catalog.has_any_column_privilege('ikagetto_ranking_reader', 'ikagetto_ranking_private.best_scores', 'INSERT, UPDATE')
    OR pg_catalog.has_table_privilege('ikagetto_ranking_reader', 'ikagetto_ranking_private.best_scores', 'DELETE, TRUNCATE')
    OR pg_catalog.has_any_column_privilege('ikagetto_ranking_reader', 'ikagetto_ranking_private.runs', 'SELECT')
    OR pg_catalog.has_any_column_privilege('ikagetto_ranking_reader', 'ikagetto_ranking_private.modes', 'SELECT') THEN
    RAISE EXCEPTION 'The board reader must have limited read-only access';
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_catalog.pg_proc
    WHERE oid = 'ikagetto_ranking_private.board_page(text,integer,integer)'::regprocedure
      AND prosecdef AND provolatile = 's' AND proowner = 'ikagetto_ranking_reader'::regrole
  ) OR NOT EXISTS (
    SELECT FROM pg_catalog.pg_proc
    WHERE oid = 'public.ikagetto_board_page_v3(text,integer,integer)'::regprocedure
      AND NOT prosecdef AND provolatile = 's'
  ) OR pg_catalog.has_function_privilege('service_role', 'public.ikagetto_board_page_v3(text,integer,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'The public invoker, private reader and role grants must match the API boundary';
  END IF;
END;
$$;

SET LOCAL ROLE anon;
DO $$
DECLARE
  v_page record;
  v_bad_request record;
  v_row record;
  v_previous record;
BEGIN
  IF EXISTS (SELECT FROM public.ikagetto_board_page_v3('cooking', 0, 500))
     OR EXISTS (SELECT FROM public.ikagetto_board_page_v3('fishing', 1203, 500))
     OR EXISTS (SELECT FROM public.ikagetto_board_page_v3('fishing', 2147483647, 500)) THEN
    RAISE EXCEPTION 'Empty and exhausted boards must return no rows';
  END IF;

  FOR v_page IN
    SELECT * FROM (VALUES
      (0, 100, 100, true), (100, 100, 100, true), (400, 100, 100, true),
      (0, 500, 500, true), (500, 500, 500, true), (1000, 500, 203, false),
      (703, 500, 500, false), (1202, 1, 1, false)
    ) AS cases(page_offset, page_limit, page_size, has_next)
  LOOP
    IF NOT EXISTS (
      SELECT FROM public.ikagetto_board_page_v3('fishing', v_page.page_offset, v_page.page_limit)
      HAVING count(*) = v_page.page_size AND bool_and(has_more = v_page.has_next)
    ) THEN
      RAISE EXCEPTION 'Wrong continuation flag or page size: %', v_page;
    END IF;
  END LOOP;

  FOR v_page IN
    SELECT * FROM (VALUES (99, 100), (499, 500), (999, 1000)) AS cases(tie_offset, tie_rank)
  LOOP
    SELECT p.* INTO STRICT v_previous FROM public.ikagetto_board_page_v3('fishing', v_page.tie_offset, 1) AS p;
    SELECT p.* INTO STRICT v_row FROM public.ikagetto_board_page_v3('fishing', v_page.tie_offset + 1, 1) AS p;
    IF v_row.rank IS DISTINCT FROM v_page.tie_rank::bigint OR v_previous.rank IS DISTINCT FROM v_row.rank
       OR v_previous.display_name IS DISTINCT FROM 'Angler ' || lpad(v_page.tie_rank::text, 4, '0')
       OR v_row.display_name IS DISTINCT FROM 'Angler ' || lpad((v_page.tie_rank + 1)::text, 4, '0')
       OR (v_row.length_meters, v_row.weight_kg, v_row.elapsed_ms) IS DISTINCT FROM (NULL::integer, NULL::integer, NULL::integer)
       OR (v_previous.length_meters, v_previous.weight_kg, v_previous.elapsed_ms)
          IS DISTINCT FROM (12, 1500, 60000 + v_page.tie_rank) THEN
      RAISE EXCEPTION 'A page boundary must preserve rank, order and catch measurements: %, %', v_previous, v_row;
    END IF;
    IF (SELECT rank FROM public.ikagetto_board_page_v3('fishing', v_page.tie_offset + 2, 1))
       IS DISTINCT FROM (v_page.tie_rank + 2)::bigint THEN
      RAISE EXCEPTION 'Rank after a tie must skip the tied position: %', v_page;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT FROM public.ikagetto_board_page_v3('fishing', 500, 500) WITH ORDINALITY AS p
    WHERE p.display_name IS DISTINCT FROM 'Angler ' || lpad((500 + p.ordinality)::text, 4, '0')
  ) THEN
    RAISE EXCEPTION 'Every displayed row must follow the deterministic score/name order';
  END IF;

  SELECT p.* INTO STRICT v_row FROM public.ikagetto_board_page_v3('butcher', 0, 500) AS p;
  IF (v_row.rank, v_row.display_name, v_row.score, v_row.length_meters, v_row.weight_kg, v_row.elapsed_ms, v_row.has_more)
     IS DISTINCT FROM (1::bigint, 'Chef'::text, 35000, NULL::integer, NULL::integer, NULL::integer, false) THEN
    RAISE EXCEPTION 'Each mode has its own board, with null measurements outside fishing: %', v_row;
  END IF;

  FOR v_bad_request IN
    SELECT * FROM (VALUES ('bad', 0, 500), (NULL, 0, 500), ('fishing', NULL, 500), ('fishing', -1, 500),
      ('fishing', 0, NULL), ('fishing', 0, 0), ('fishing', 0, 501)) AS cases(mode, page_offset, page_limit)
  LOOP
    BEGIN
      PERFORM public.ikagetto_board_page_v3(v_bad_request.mode, v_bad_request.page_offset, v_bad_request.page_limit);
      RAISE EXCEPTION 'Invalid page request was accepted: %', v_bad_request;
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM <> 'ikagetto_invalid_board' THEN RAISE; END IF;
    END;
  END LOOP;

  IF (SELECT count(*) FROM public.ikagetto_fishing_board_v2(100)) <> 100
     OR (SELECT display_name FROM public.ikagetto_board_v1('butcher', 1)) IS DISTINCT FROM 'Chef' THEN
    RAISE EXCEPTION 'The previous board versions must remain usable';
  END IF;

  BEGIN
    PERFORM ikagetto_ranking_private.board_page('fishing', 0, 1);
    RAISE EXCEPTION 'Anonymous callers must use the public wrapper';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM normalized_name FROM ikagetto_ranking_private.best_scores;
    RAISE EXCEPTION 'Anonymous callers must not read private names';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;

SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF (SELECT display_name FROM public.ikagetto_board_page_v3('fishing', 1000, 1)) IS DISTINCT FROM 'Angler 1001' THEN
    RAISE EXCEPTION 'Logged-in callers must also be able to use the public wrapper';
  END IF;
END;
$$;

ROLLBACK;
