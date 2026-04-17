#!/usr/bin/env python3
"""
Batch-instruments all edge functions with withTelemetry().

For each function:
  1. Adds import { withTelemetry } from '../_shared/telemetry.ts'
  2. Changes serve(async (req) => {  →  serve(withTelemetry('fn-name', async (req) => {
  3. Finds the matching closing }) using brace-depth and changes it to  }))
"""

import re, sys, pathlib

FUNCTIONS_DIR = pathlib.Path(__file__).parent.parent / 'supabase' / 'functions'

# Long-running workers that also need telemetryHeartbeat
HEARTBEAT_WORKERS = {'ai-batch-worker', 'push-worker', 'strava-backfill-worker'}

# Functions that already have withTelemetry (skip)
ALREADY_DONE = set()

results = {'ok': [], 'skipped': [], 'failed': []}

for fn_dir in sorted(FUNCTIONS_DIR.iterdir()):
    if not fn_dir.is_dir():
        continue
    fn_name = fn_dir.name
    index_ts = fn_dir / 'index.ts'
    if not index_ts.exists():
        results['skipped'].append(fn_name + ' (no index.ts)')
        continue

    src = index_ts.read_text()

    # Already instrumented?
    if 'withTelemetry' in src:
        results['skipped'].append(fn_name + ' (already has withTelemetry)')
        continue

    # ── 1. Find the serve( line ───────────────────────────────────────────────
    # Matches: serve(async (req) => {  or  serve(async (req: Request) => {
    serve_match = re.search(r'^(serve\(async \(req(?:: Request)?\) => \{)$', src, re.MULTILINE)
    if not serve_match:
        results['failed'].append(fn_name + ' (could not find serve line)')
        continue

    serve_line       = serve_match.group(1)
    serve_start      = serve_match.start()
    serve_line_end   = serve_match.end()

    # ── 2. Find matching }) using brace depth ─────────────────────────────────
    # The serve() body starts right after the opening { on the serve line.
    # We need to find where brace depth returns to 0 (the matching }).
    # Then the next character(s) should be )\n or )

    body_start = serve_line_end  # start after the opening {
    depth = 1
    i = body_start
    while i < len(src) and depth > 0:
        c = src[i]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
        i += 1
    # i now points one past the closing }
    closing_brace_pos = i - 1  # position of the }

    # Check that the next chars are )\n (i.e., the serve closing)
    after_close = src[closing_brace_pos: closing_brace_pos + 3]
    if not re.match(r'\}\)', after_close):
        results['failed'].append(fn_name + ' (closing brace not followed by ), got: ' + repr(after_close[:6]))
        continue

    # ── 3. Build the modified source ──────────────────────────────────────────

    # Determine import line to insert
    # Find the first import line and insert withTelemetry import right after it
    first_import = re.search(r'^import .+\n', src, re.MULTILINE)
    if not first_import:
        results['failed'].append(fn_name + ' (no import line found)')
        continue

    telemetry_import_line = "import { withTelemetry } from '../_shared/telemetry.ts'\n"
    if fn_name in HEARTBEAT_WORKERS:
        telemetry_import_line = "import { withTelemetry, telemetryHeartbeat } from '../_shared/telemetry.ts'\n"

    insert_after = first_import.end()

    # New serve line
    new_serve_line = "serve(withTelemetry('" + fn_name + "', async (req) => {"
    if ': Request' in serve_line:
        new_serve_line = "serve(withTelemetry('" + fn_name + "', async (req: Request) => {"

    # Build new source in three parts:
    #   part_a: up to serve_start
    #   part_b: new serve line
    #   part_c: the body (from after serve_line) ... closing }  →  }))
    part_a = src[:serve_start]
    part_b = new_serve_line
    # body from serve_line_end to closing_brace_pos (exclusive of the })
    body = src[serve_line_end:closing_brace_pos]
    # closing }) becomes }))
    part_c = body + '}))' + src[closing_brace_pos + 2:]

    new_src = part_a + part_b + part_c

    # Insert telemetry import after first import
    new_src = new_src[:insert_after] + telemetry_import_line + new_src[insert_after:]

    # ── 4. Heartbeat stub for workers ─────────────────────────────────────────
    if fn_name in HEARTBEAT_WORKERS:
        # Insert heartbeat start just after the serve() opening line
        # Find the new serve line in new_src
        # Match the new serve opening line (no closing ) on this line — it's a multi-line block)
        new_serve_match = re.search(
            r'^serve\(withTelemetry\(\'' + re.escape(fn_name) + r'\', async \(req(?:: Request)?\) => \{\n',
            new_src, re.MULTILINE
        )
        if new_serve_match:
            hb_code = (
                "\n"
                "  // ── Heartbeat: proves liveness every 60s ──────────────────────────────\n"
                "  const stopHeartbeat = telemetryHeartbeat('" + fn_name + "')\n"
                "  // stopHeartbeat() on graceful shutdown if needed\n"
            )
            ins = new_serve_match.end()
            new_src = new_src[:ins] + hb_code + new_src[ins:]

    # ── 5. Write ───────────────────────────────────────────────────────────────
    index_ts.write_text(new_src)
    results['ok'].append(fn_name)

# ── Report ─────────────────────────────────────────────────────────────────────
print('\n=== Telemetry instrumentation complete ===\n')
print(f"OK      ({len(results['ok'])}): " + ', '.join(results['ok']))
print(f"SKIPPED ({len(results['skipped'])}): " + ', '.join(results['skipped']))
print(f"FAILED  ({len(results['failed'])}): " + ', '.join(results['failed']))
