"""Offline regression tests for legacy production migration tooling.

Every executable that could contact Supabase or PostgreSQL is replaced by a
fixture, and the child receives a minimal environment with fake credentials.
"""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'database/migrations/production/deploy-migrations.sh'
MIGRATIONS = (
    '20250717000001_create_embedding_metrics_tables.sql',
    '20250719000001_enhance_embedding_queue_phase2.sql',
    '20250720000003_batch_upload_optimization.sql',
)


class MigrationToolTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.script = self.root / 'database/migrations/production/deploy-migrations.sh'
        self.script.parent.mkdir(parents=True)
        shutil.copyfile(SOURCE, self.script)
        migrations = self.root / 'supabase/migrations'
        migrations.mkdir(parents=True)
        for name in MIGRATIONS:
            (migrations / name).write_text('CREATE TABLE test_only (id int);\n')
        rollback = self.script.parent / 'rollback'
        rollback.mkdir()
        for phase in (1, 2, 3):
            (rollback / f'rollback_phase{phase}.sql').write_text('-- mock rollback\n')
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        for command in ('supabase', 'psql', 'pg_dump', 'jq'):
            executable = self.bin / command
            executable.write_text('''#!/usr/bin/python3
import json, os, sys
with open(os.environ['CALL_LOG'], 'a') as f:
    f.write(json.dumps([os.path.basename(sys.argv[0]), *sys.argv[1:]]) + '\\n')
if os.path.basename(sys.argv[0]) == 'psql':
    if os.environ.get('FAIL_PSQL') == '1': sys.exit(2)
    query = sys.argv[sys.argv.index('--command') + 1] if '--command' in sys.argv else ''
    if 'to_regclass' in query:
        print('f' if os.environ.get('MISSING_OBJECTS') == '1' else 't')
    elif 'schema_migrations' in query and (os.environ.get('APPLIED') == 'yes' or (os.environ.get('APPLIED') == 'phase2' and '20250719000001' in query)):
        print('1')
''')
            executable.chmod(0o755)
        self.call_log = self.root / 'calls'
        self.env = {'PATH': str(self.bin) + ':/usr/bin:/bin', 'HOME': str(self.root),
                    'TMPDIR': str(self.root), 'CALL_LOG': str(self.call_log),
                    'SUPABASE_PROJECT_ID': 'mock-only', 'SUPABASE_DB_PASSWORD': 'mock-only'}

    def run_script(self, *args, **extra_env):
        import json
        result = subprocess.run(['bash', str(self.script), *args],
                                env={**self.env, **extra_env}, text=True,
                                capture_output=True, timeout=20)
        calls = [json.loads(line) for line in self.call_log.read_text().splitlines()] if self.call_log.exists() else []
        return result, calls

    def external_calls(self, calls):
        return [c for c in calls if c[0] in ('supabase', 'psql', 'pg_dump', 'jq')]

    def test_validate_only_never_queries_or_executes_ddl_for_unapplied_migrations(self):
        result, calls = self.run_script('--validate-only', APPLIED='no')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.external_calls(calls), [])

    def test_validate_only_never_queries_applied_migrations(self):
        result, calls = self.run_script('--validate-only', APPLIED='yes')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.external_calls(calls), [])

    def test_dry_run_never_queries_database(self):
        result, calls = self.run_script('--dry-run')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.external_calls(calls), [])

    def test_validate_only_needs_no_database_password(self):
        result, calls = self.run_script('--validate-only', SUPABASE_DB_PASSWORD='')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.external_calls(calls), [])

    def test_probe_failure_aborts_without_migration_file_execution(self):
        result, calls = self.run_script(FAIL_PSQL='1')
        self.assertEqual(result.returncode, 3, result.stdout + result.stderr)
        self.assertFalse(any(c[0] == 'psql' and '--file' in c for c in calls))

    def test_validate_only_reports_missing_file(self):
        (self.root / 'supabase/migrations' / MIGRATIONS[0]).unlink()
        result, calls = self.run_script('--validate-only')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual([c for c in calls if c[0] == 'psql'], [])

    def test_non_production_environment_is_rejected(self):
        result, calls = self.run_script('--environment', 'staging')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.external_calls(calls), [])

    def test_backup_uses_explicit_pg_dump_not_linked_cli(self):
        result, calls = self.run_script('--backup-first', APPLIED='yes')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        pg = [c for c in calls if c[0] == 'pg_dump']
        self.assertTrue(pg)
        self.assertTrue(any('--host' in c and 'db.mock-only.supabase.co' in c for c in pg))
        self.assertTrue(any('--schema-only' in c for c in pg))
        self.assertTrue(any(any('public.embedding_performance_metrics' in arg for arg in c) for c in pg))
        self.assertFalse(any(c[0] == 'supabase' for c in calls))

    def test_rollback_skips_phase_absent_from_history(self):
        result, calls = self.run_script('--rollback', '1', APPLIED='phase2')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        writes = [c for c in calls if c[0] == 'psql' and '--single-transaction' in c]
        self.assertEqual(len(writes), 1)
        self.assertEqual(writes[0].count('--file'), 1)
        self.assertTrue(any('rollback_phase2.sql' in arg for arg in writes[0]))

    def test_rollback_probe_failure_aborts_without_transaction(self):
        result, calls = self.run_script('--rollback', '1', FAIL_PSQL='1')
        self.assertEqual(result.returncode, 3, result.stdout + result.stderr)
        self.assertFalse(any(c[0] == 'psql' and '--single-transaction' in c for c in calls))

    def test_rollback_skips_recorded_phase_with_missing_objects(self):
        result, calls = self.run_script('--rollback', '1', APPLIED='yes', MISSING_OBJECTS='1')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        writes = [c for c in calls if c[0] == 'psql' and '--single-transaction' in c]
        self.assertEqual(len(writes), 1)
        self.assertEqual(writes[0].count('--file'), 0)
        self.assertTrue(any(any('DELETE FROM supabase_migrations.schema_migrations' in arg for arg in c) for c in writes))

    def test_rollback_uses_one_transaction_for_recorded_phases(self):
        result, calls = self.run_script('--rollback', '1', APPLIED='yes')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        writes = [c for c in calls if c[0] == 'psql' and '--single-transaction' in c]
        self.assertEqual(len(writes), 1)
        self.assertEqual(writes[0].count('--file'), 2)
        self.assertTrue(any('rollback_phase3.sql' in arg for arg in writes[0]))
        self.assertTrue(any('rollback_phase2.sql' in arg for arg in writes[0]))


if __name__ == '__main__':
    unittest.main()
