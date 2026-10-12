# GitHub Actions workflow instructions

This file applies to `.github/workflows/` together with the root `AGENTS.md`.

## CI contract

- `ci.yml` runs `npm run check` on **Node 20** and **Node 24**.
- The checks include syntax validation of `scripts/evolve.mjs` and `scripts/harnesses.mjs`, plus the real `node:test` suite.
- Keep all supported Node versions in the test matrix when changing workflows.

## Security and reviews

- Keep workflow `permissions` at least privilege; current CI uses `contents: read`.
- Follow the existing practice of pinning third-party GitHub actions to complete commit SHAs.
- Do not print secrets, tokens, raw traces, or sensitive environment values in logs or artifacts.
- Do not add unnecessary write tokens, privileged triggers, unreviewed external scripts, or network-dependent test steps.
- Never suppress failing tests or remove security checks merely to make CI green.
- Verify YAML/workflow changes with GitHub Actions runs on a branch or pull request, and report actual conclusions before claiming success.
