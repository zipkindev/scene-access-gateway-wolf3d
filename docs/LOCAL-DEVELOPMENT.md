# Local development and Git synchronization

The tracked repository contains the reusable GPL extension. Imported game
data under `runtime/` is a local input: it remains ignored while source,
integration, tests, manifests, and documentation are versioned normally.

Start each improvement on a branch based on the latest public source:

```sh
git switch main
git pull --ff-only origin main
git switch -c feature/short-description
```

After editing, run `./scripts/test.sh`, stage only the intended source files,
and commit. `./scripts/sync-branch.sh` then checks for an accidental dirty or
detached worktree, fetches GitHub, rebases the current branch onto
`origin/main`, runs the tests again, and performs a normal push. Open a pull
request and merge after CI passes.

Do not use `git add -f` for imported `.WL*`, `.SOD`, or `.SD*` files. Normal
fetch, rebase, pull, and push operations do not upload or remove ignored game
data. If the main gateway and extension change together, use matching feature
branches and test their two Compose files together before merging either pull
request.
