#!/usr/bin/env python3
"""
RLS SQL isolation smoke — 7 scenarios from debt session item 5.
Runs each check via `supabase db query --linked` (Management API through CLI).

Usage (requires supabase CLI + SUPABASE_ACCESS_TOKEN in env):
  SUPABASE_ACCESS_TOKEN=sbp_xxx python3 sql_smoke_runner.py

Exit 0: all pass. Exit 1: one or more failures.
"""
import os, sys, json, subprocess, textwrap

COACH   = "dddddddd-0000-4000-8000-000000000001"
ATHLETE = "dddddddd-0000-4000-8000-000000000002"
OTHER   = "dddddddd-0000-4000-8000-000000000003"
SESSION = "eeeeeeee-0000-4000-8000-000000000001"
COMMENT = "ffffffff-0000-4000-8000-000000000001"
PROJECT = os.environ.get("SUPABASE_PROJECT_ID", "pvicqwapvvfempjdgwbm")


def run_sql(sql: str) -> dict:
    """Execute SQL via supabase CLI and return parsed JSON rows."""
    result = subprocess.run(
        ["npx", "supabase", "db", "query",
         "--linked",
         "--output", "json",
         sql],
        capture_output=True, text=True, timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    raw = result.stdout.strip()
    parsed = json.loads(raw)
    # supabase CLI wraps in {"rows": [...]}
    if isinstance(parsed, dict) and "rows" in parsed:
        return parsed["rows"]
    return parsed


def count_as(uid: str, table_filter: str) -> int:
    sql = textwrap.dedent(f"""
        SET ROLE authenticated;
        SET request.jwt.claims='{{"sub":"{uid}"}}';
        SELECT count(*)::int AS n {table_filter}
    """).strip()
    rows = run_sql(sql)
    if rows and isinstance(rows, list):
        return int(list(rows[0].values())[0])
    return -1


def insert_blocked(uid: str, insert_sql: str) -> bool:
    """Returns True if the insert is blocked by RLS (returns error containing 42501)."""
    sql = textwrap.dedent(f"""
        SET ROLE authenticated;
        SET request.jwt.claims='{{"sub":"{uid}"}}';
        {insert_sql}
    """).strip()
    result = subprocess.run(
        ["npx", "supabase", "db", "query",
         "--linked",
         sql],
        capture_output=True, text=True, timeout=30,
    )
    combined = result.stdout + result.stderr
    return "42501" in combined or "violates row-level security" in combined.lower()


SCENARIOS = [
    {
        "id": "1",
        "name": "athlete reads own session comment (expect 1)",
        "fn":   lambda: count_as(ATHLETE, f"FROM public.session_comments WHERE id='{COMMENT}'"),
        "expect": 1,
    },
    {
        "id": "2",
        "name": "coach reads linked athlete session comment (expect 1)",
        "fn":   lambda: count_as(COACH, f"FROM public.session_comments WHERE id='{COMMENT}'"),
        "expect": 1,
    },
    {
        "id": "3",
        "name": "unlinked user reads comment — isolation (expect 0)",
        "fn":   lambda: count_as(OTHER, f"FROM public.session_comments WHERE id='{COMMENT}'"),
        "expect": 0,
    },
    {
        "id": "4",
        "name": "unlinked user INSERT blocked — 42501",
        "fn":   lambda: insert_blocked(OTHER, f"INSERT INTO public.session_comments(session_id,author_id,body) VALUES('{SESSION}','{OTHER}','Intruder')"),
        "expect": True,
    },
    {
        "id": "5",
        "name": "spoofed author_id INSERT blocked — 42501",
        "fn":   lambda: insert_blocked(ATHLETE, f"INSERT INTO public.session_comments(session_id,author_id,body) VALUES('{SESSION}','{COACH}','FakeCoach')"),
        "expect": True,
    },
    {
        "id": "6",
        "name": "athlete sees coach presence in session_views (expect 1)",
        "fn":   lambda: count_as(ATHLETE, f"FROM public.session_views WHERE user_id='{COACH}' AND session_id='{SESSION}'"),
        "expect": 1,
    },
    {
        "id": "7",
        "name": "unlinked user sees no session_views — isolation (expect 0)",
        "fn":   lambda: count_as(OTHER, f"FROM public.session_views WHERE session_id='{SESSION}'"),
        "expect": 0,
    },
]


def main():
    failures = []
    print(f"RLS SQL smoke — {len(SCENARIOS)} scenarios\n")

    for s in SCENARIOS:
        try:
            actual = s["fn"]()
            ok = actual == s["expect"]
            print(f"  [{s['id']}] {'✅ PASS' if ok else '❌ FAIL'}: {s['name']}")
            if not ok:
                print(f"       expected={s['expect']!r}  got={actual!r}", file=sys.stderr)
                failures.append(s["name"])
        except Exception as e:
            print(f"  [{s['id']}] ❌ ERROR: {s['name']} — {e}", file=sys.stderr)
            failures.append(s["name"])

    print()
    if failures:
        print(f"FAIL: {len(failures)}/{len(SCENARIOS)} scenarios failed", file=sys.stderr)
        sys.exit(1)
    else:
        print(f"PASS: all {len(SCENARIOS)} scenarios")
        sys.exit(0)


if __name__ == "__main__":
    main()
