# Model eval (Astropods AI Gateway)

Compares models on the synthetic request fixtures with one Astropods key. The public app does not use Astropods.

1. One-time: Docker via Colima (`brew install colima docker docker-compose`, `colima start`) and register Compose in `~/.docker/config.json`:
   `"cliPluginsExtraDirs": ["/opt/homebrew/lib/docker/cli-plugins"]`
2. `ast login`
3. Pick models and cases in `eval/config.json` (start small: credit is limited). `runs` (default 3) repeats each case: the scorecard's pass^k counts a case only if every run passed, and lists flaky cases. Calls = models × cases × runs.
4. From the repo root: `DOCKER_HOST=unix://$HOME/.colima/default/docker.sock ast project start`
5. Read the scorecard in the logs; full results land in `data/eval/`. Real cost per model: `ast billing models`.

The container runs the eval once, then idles, so a restart can't re-run it and spend credits. Stop it with Ctrl+C or `ast project stop`.
