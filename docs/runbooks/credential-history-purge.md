# Credential history purge — PR #234

Redaction removed the values from the current tree; they remain in every commit
that touched them. This runbook rewrites all branches and tags, then force-pushes
GitHub and the GitLab mirror.

Do this **after** rotation/revocation, with collaborators notified. Rewriting
history changes every hash, invalidates existing clones, and detaches inline PR
comments from their commits.

## 1. Backup

```bash
git clone --mirror git@github.com:noa10/mataresit.git /tmp/mataresit-backup.git
tar -czf ~/mataresit-history-backup-$(date +%F).tar.gz -C /tmp mataresit-backup.git
```

## 2. Build the replacement list without printing values

The values must never appear in a terminal, a log, or a committed file. This
writes literal-to-placeholder pairs directly to a temp file:

```bash
python3 - <<'PY' > /tmp/pr234-replacements.txt
import re, subprocess, base64, json

jwt = re.compile(rb'[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}')
found = set()

# Every blob reachable from any ref.
objects = subprocess.run(['git', 'rev-list', '--objects', '--all'],
                         capture_output=True).stdout.split(b'\n')
for line in objects:
    parts = line.split(b' ', 1)
    if len(parts) != 2:
        continue
    try:
        blob = subprocess.run(['git', 'cat-file', '-p', parts[0]],
                              capture_output=True).stdout
    except Exception:
        continue
    for m in jwt.finditer(blob):
        seg = m.group().split(b'.')[1]
        seg += b'=' * ((4 - len(seg) % 4) % 4)
        try:
            payload = json.loads(base64.urlsafe_b64decode(seg))
        except Exception:
            continue
        if isinstance(payload, dict) and payload.get('role') == 'service_role':
            found.add(m.group())
    for m in re.finditer(rb'sb_secret_[A-Za-z0-9_-]{16,}', blob):
        found.add(m.group())

for value in sorted(found):
    print(value.decode() + '==>***REMOVED***')
PY
wc -l /tmp/pr234-replacements.txt
```

## 3. Rewrite a fresh clone

`git filter-repo` refuses to run on a non-fresh clone; use a new one.

```bash
python3 -m venv /tmp/fr-venv && /tmp/fr-venv/bin/pip install git-filter-repo
git clone --no-local git@github.com:noa10/mataresit.git /tmp/mataresit-purge
cd /tmp/mataresit-purge
# filter-repo removes the origin remote; re-add both after the rewrite.
/tmp/fr-venv/bin/git-filter-repo --replace-text /tmp/pr234-replacements.txt --force
git remote add origin git@github.com:noa10/mataresit.git
git remote add gitlab https://gitlab.com/noa102/mataresit.git
git remote -v   # confirm both remotes before any push
```

## 4. Verify before pushing

Run the same scan from step 2 against the clone; it must print `0`.

```bash
git log --all --oneline | wc -l          # history is present, hashes changed
git status                                # clean
```

Spot-check that the redacted files still exist with placeholders:

```bash
git show HEAD:docs/troubleshooting/WEBHOOK_DEBUGGING_GUIDE.md | grep -n 'SERVICE_ROLE_KEY'
```

## 5. Force-push

```bash
cd /tmp/mataresit-purge
git push --force --all origin
git push --force --tags origin
git push --force --all gitlab
git push --force --tags gitlab
rm -f /tmp/pr234-replacements.txt
```

Then:

- Re-clone locally; the working copy's history is now unrelated.
- Tell every collaborator to re-clone (not pull).
- Re-check the PR: GitHub keeps the PR open but rewrites its commit list;
  inline review threads may show as outdated.
- Re-run CI on the rewritten branch.
- Confirm secret scanning shows no remaining alerts for these values.

## Notes

- Force-pushing `main` on a public repository is visible and disruptive. If the
  repository policy forbids it, the alternative is to leave history as-is and
  rely on revocation plus the inventory in `docs/BILLING_DEPLOYMENT_GUIDE.md`.
- `anon` JWTs in test fixtures are public by design and are not part of this
  purge.
