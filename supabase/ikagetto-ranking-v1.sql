-- イカゲット専用の開始回数・スコア・ランキング。
-- Supabase のマイグレーションとして postgres で一度だけ適用する。
-- SQL Editor で直接適用する場合は、全体を BEGIN; と COMMIT; で囲んで実行する。
-- ikagetto_ranking_private は Data API の公開スキーマに追加しない。
-- 開始番号とスコアの範囲を検査する。ゲームの操作自体はサーバーでは検証しない。

CREATE SCHEMA ikagetto_ranking_private;
CREATE ROLE ikagetto_ranking_executor NOLOGIN NOINHERIT NOBYPASSRLS;
GRANT ikagetto_ranking_executor TO postgres;
REVOKE ALL ON SCHEMA ikagetto_ranking_private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE, CREATE ON SCHEMA ikagetto_ranking_private TO ikagetto_ranking_executor;

CREATE TABLE ikagetto_ranking_private.modes (
  mode text PRIMARY KEY CHECK (mode IN ('fishing', 'butcher', 'cooking')),
  play_count bigint NOT NULL DEFAULT 0 CHECK (play_count >= 0),
  rate_minute timestamptz,
  starts_in_minute integer NOT NULL DEFAULT 0 CHECK (starts_in_minute BETWEEN 0 AND 600)
);

INSERT INTO ikagetto_ranking_private.modes (mode) VALUES ('fishing'), ('butcher'), ('cooking');

CREATE TABLE ikagetto_ranking_private.runs (
  run_id uuid PRIMARY KEY,
  mode text NOT NULL REFERENCES ikagetto_ranking_private.modes (mode),
  display_name text CHECK (pg_catalog.char_length(display_name) BETWEEN 1 AND 20),
  normalized_name text COLLATE pg_catalog."C" CHECK (pg_catalog.char_length(normalized_name) BETWEEN 1 AND 20),
  started_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  score integer CHECK (score BETWEEN 0 AND 50000),
  finished_at timestamptz,
  CHECK ((display_name IS NULL) = (normalized_name IS NULL)),
  CHECK ((score IS NULL) = (finished_at IS NULL))
);

CREATE TABLE ikagetto_ranking_private.best_scores (
  mode text NOT NULL REFERENCES ikagetto_ranking_private.modes (mode),
  normalized_name text COLLATE pg_catalog."C" NOT NULL CHECK (pg_catalog.char_length(normalized_name) BETWEEN 1 AND 20),
  display_name text NOT NULL CHECK (pg_catalog.char_length(display_name) BETWEEN 1 AND 20),
  score integer NOT NULL CHECK (score BETWEEN 0 AND 50000),
  PRIMARY KEY (mode, normalized_name)
);

CREATE INDEX ikagetto_best_scores_order ON ikagetto_ranking_private.best_scores (mode, score DESC, normalized_name);

ALTER TABLE ikagetto_ranking_private.modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ikagetto_ranking_private.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ikagetto_ranking_private.best_scores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA ikagetto_ranking_private FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, UPDATE (play_count, rate_minute, starts_in_minute)
  ON ikagetto_ranking_private.modes TO ikagetto_ranking_executor;
GRANT SELECT, INSERT (run_id, mode, display_name, normalized_name), UPDATE (score, finished_at)
  ON ikagetto_ranking_private.runs TO ikagetto_ranking_executor;
GRANT SELECT, INSERT, UPDATE (score, display_name)
  ON ikagetto_ranking_private.best_scores TO ikagetto_ranking_executor;

CREATE POLICY executor_read ON ikagetto_ranking_private.modes
  FOR SELECT TO ikagetto_ranking_executor USING (true);
CREATE POLICY executor_count ON ikagetto_ranking_private.modes
  FOR UPDATE TO ikagetto_ranking_executor USING (true) WITH CHECK (true);
CREATE POLICY executor_read ON ikagetto_ranking_private.runs
  FOR SELECT TO ikagetto_ranking_executor USING (true);
CREATE POLICY executor_start ON ikagetto_ranking_private.runs
  FOR INSERT TO ikagetto_ranking_executor WITH CHECK (score IS NULL AND finished_at IS NULL);
CREATE POLICY executor_finish ON ikagetto_ranking_private.runs
  FOR UPDATE TO ikagetto_ranking_executor USING (score IS NULL) WITH CHECK (score IS NOT NULL);
CREATE POLICY executor_read ON ikagetto_ranking_private.best_scores
  FOR SELECT TO ikagetto_ranking_executor USING (true);
CREATE POLICY executor_first_score ON ikagetto_ranking_private.best_scores
  FOR INSERT TO ikagetto_ranking_executor WITH CHECK (true);
CREATE POLICY executor_new_best ON ikagetto_ranking_private.best_scores
  FOR UPDATE TO ikagetto_ranking_executor USING (true) WITH CHECK (true);

CREATE FUNCTION ikagetto_ranking_private.start_run(p_run_id uuid, p_mode text, p_display_name text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_display_name text;
  v_normalized_name text COLLATE pg_catalog."C";
  v_existing_mode text;
  v_existing_name text COLLATE pg_catalog."C";
  v_rate_minute timestamptz;
  v_starts_in_minute integer;
  v_now_minute timestamptz;
  v_spaces CONSTANT text := U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+';
BEGIN
  IF p_run_id IS NULL OR p_mode IS NULL OR p_mode NOT IN ('fishing', 'butcher', 'cooking') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ikagetto_invalid_start';
  END IF;

  IF p_display_name IS NOT NULL THEN
    IF pg_catalog.octet_length(p_display_name) > 256 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ikagetto_invalid_name';
    END IF;
    v_display_name := pg_catalog.btrim(pg_catalog.regexp_replace(p_display_name, v_spaces, ' ', 'g'));
    v_normalized_name := pg_catalog.btrim(pg_catalog.regexp_replace(
      pg_catalog.lower(pg_catalog.normalize(v_display_name, 'NFKC')), v_spaces, ' ', 'g'
    ));
    IF pg_catalog.char_length(v_display_name) NOT BETWEEN 1 AND 20
       OR pg_catalog.char_length(v_normalized_name) NOT BETWEEN 1 AND 20
       OR v_display_name ~ U&'[[:cntrl:]\061C\200B\200E\200F\202A-\202E\2060\2066-\2069]' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ikagetto_invalid_name';
    END IF;
  END IF;

  INSERT INTO ikagetto_ranking_private.runs (run_id, mode, display_name, normalized_name)
    VALUES (p_run_id, p_mode, v_display_name, v_normalized_name)
    ON CONFLICT (run_id) DO NOTHING;

  IF NOT FOUND THEN
    SELECT r.mode, r.normalized_name INTO v_existing_mode, v_existing_name
      FROM ikagetto_ranking_private.runs AS r WHERE r.run_id = p_run_id;
    IF v_existing_mode IS DISTINCT FROM p_mode OR v_existing_name IS DISTINCT FROM v_normalized_name THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ikagetto_start_conflict';
    END IF;
    RETURN 'duplicate';
  END IF;

  -- 1モードにつき1分600件。上限に達した場合は上の挿入も同じ取引で取り消す。
  SELECT m.rate_minute, m.starts_in_minute INTO v_rate_minute, v_starts_in_minute
    FROM ikagetto_ranking_private.modes AS m WHERE m.mode = p_mode FOR NO KEY UPDATE;
  v_now_minute := pg_catalog.date_trunc('minute', pg_catalog.clock_timestamp(), 'UTC');
  IF v_rate_minute IS NULL OR v_now_minute > v_rate_minute THEN
    v_rate_minute := v_now_minute;
    v_starts_in_minute := 0;
  END IF;
  IF v_starts_in_minute >= 600 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ikagetto_start_limit';
  END IF;
  UPDATE ikagetto_ranking_private.modes AS m
    SET play_count = m.play_count + 1, rate_minute = v_rate_minute, starts_in_minute = v_starts_in_minute + 1
    WHERE m.mode = p_mode;

  RETURN 'accepted';
END;
$$;

CREATE FUNCTION ikagetto_ranking_private.finish_run(p_run_id uuid, p_score integer)
RETURNS TABLE (rank bigint, play_count bigint) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_mode text;
  v_display_name text;
  v_normalized_name text;
  v_existing_score integer;
BEGIN
  IF p_run_id IS NULL OR p_score IS NULL OR p_score NOT BETWEEN 0 AND 50000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ikagetto_invalid_finish';
  END IF;

  UPDATE ikagetto_ranking_private.runs AS r
    SET score = p_score, finished_at = pg_catalog.clock_timestamp()
    WHERE r.run_id = p_run_id AND r.score IS NULL
    RETURNING r.mode, r.display_name, r.normalized_name INTO v_mode, v_display_name, v_normalized_name;

  IF FOUND THEN
    IF v_normalized_name IS NOT NULL THEN
      INSERT INTO ikagetto_ranking_private.best_scores AS b (mode, normalized_name, display_name, score)
        VALUES (v_mode, v_normalized_name, v_display_name, p_score)
        ON CONFLICT (mode, normalized_name) DO UPDATE
          SET display_name = EXCLUDED.display_name, score = EXCLUDED.score
          WHERE b.score < EXCLUDED.score;
    END IF;
  ELSE
    SELECT r.mode, r.normalized_name, r.score INTO v_mode, v_normalized_name, v_existing_score
      FROM ikagetto_ranking_private.runs AS r WHERE r.run_id = p_run_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ikagetto_unknown_run';
    END IF;
    IF v_existing_score IS DISTINCT FROM p_score THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ikagetto_finish_conflict';
    END IF;
  END IF;

  -- 今回の点より高い自己ベストの人数に1を足す。同点は同じ順位。
  RETURN QUERY SELECT CASE WHEN v_normalized_name IS NOT NULL THEN 1 + (
    SELECT pg_catalog.count(*) FROM ikagetto_ranking_private.best_scores AS b
      WHERE b.mode = v_mode AND b.score > p_score
  ) END, m.play_count
    FROM ikagetto_ranking_private.modes AS m WHERE m.mode = v_mode;
END;
$$;

CREATE FUNCTION ikagetto_ranking_private.board(p_mode text, p_limit integer)
RETURNS TABLE (rank bigint, display_name text, score integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_mode IS NULL OR p_mode NOT IN ('fishing', 'butcher', 'cooking')
     OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ikagetto_invalid_board';
  END IF;

  RETURN QUERY SELECT pg_catalog.rank() OVER (ORDER BY b.score DESC), b.display_name, b.score
    FROM ikagetto_ranking_private.best_scores AS b
    WHERE b.mode = p_mode
    ORDER BY b.score DESC, b.normalized_name
    LIMIT p_limit;
END;
$$;

CREATE FUNCTION ikagetto_ranking_private.stats()
RETURNS TABLE (total_play_count bigint, player_count bigint, fishing bigint, butcher bigint, cooking bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT f.play_count,
    (SELECT pg_catalog.count(DISTINCT b.normalized_name) FROM ikagetto_ranking_private.best_scores AS b),
    f.play_count, b.play_count, c.play_count
  FROM ikagetto_ranking_private.modes AS f, ikagetto_ranking_private.modes AS b, ikagetto_ranking_private.modes AS c
  WHERE f.mode = 'fishing' AND b.mode = 'butcher' AND c.mode = 'cooking';
$$;

ALTER FUNCTION ikagetto_ranking_private.start_run(uuid, text, text) OWNER TO ikagetto_ranking_executor;
ALTER FUNCTION ikagetto_ranking_private.finish_run(uuid, integer) OWNER TO ikagetto_ranking_executor;
ALTER FUNCTION ikagetto_ranking_private.board(text, integer) OWNER TO ikagetto_ranking_executor;
ALTER FUNCTION ikagetto_ranking_private.stats() OWNER TO ikagetto_ranking_executor;
REVOKE CREATE ON SCHEMA ikagetto_ranking_private FROM ikagetto_ranking_executor;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ikagetto_ranking_private FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ikagetto_ranking_private TO anon, authenticated;

-- 作成時に内部関数を解決する。API の役割には内部スキーマの USAGE を渡さない。
CREATE FUNCTION public.ikagetto_start_v1(p_run_id uuid, p_mode text, p_display_name text)
RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path = ''
RETURN ikagetto_ranking_private.start_run(p_run_id, p_mode, p_display_name);

CREATE FUNCTION public.ikagetto_finish_v1(p_run_id uuid, p_score integer)
RETURNS TABLE (rank bigint, play_count bigint) LANGUAGE sql SECURITY INVOKER SET search_path = ''
BEGIN ATOMIC
  SELECT * FROM ikagetto_ranking_private.finish_run(p_run_id, p_score);
END;

CREATE FUNCTION public.ikagetto_board_v1(p_mode text, p_limit integer)
RETURNS TABLE (rank bigint, display_name text, score integer) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
BEGIN ATOMIC
  SELECT * FROM ikagetto_ranking_private.board(p_mode, p_limit);
END;

CREATE FUNCTION public.ikagetto_stats_v1()
RETURNS TABLE (total_play_count bigint, player_count bigint, fishing bigint, butcher bigint, cooking bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
BEGIN ATOMIC
  SELECT * FROM ikagetto_ranking_private.stats();
END;

REVOKE ALL ON FUNCTION public.ikagetto_start_v1(uuid, text, text), public.ikagetto_finish_v1(uuid, integer),
  public.ikagetto_board_v1(text, integer), public.ikagetto_stats_v1() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ikagetto_start_v1(uuid, text, text), public.ikagetto_finish_v1(uuid, integer),
  public.ikagetto_board_v1(text, integer), public.ikagetto_stats_v1() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
