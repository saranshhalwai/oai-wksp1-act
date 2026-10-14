# Public release readiness

The repository now documents a complete local game and independent hosting and includes the Apache License 2.0 selected by the owner. Repository visibility has not been changed by this preparation.

Before changing visibility:

- Apache License 2.0 is included in `LICENSE`. Confirm the copyright holder's authority to release the code and verify redistribution rights and required notices for included assets and third-party material.
- Review the complete Git history, branches, tags, release artifacts, Actions logs/artifacts, and issue/PR attachments for credentials and private information. Reviewing the current checkout alone does not clear history. Revoke or rotate any exposed credentials before publishing; deleting a current file does not remove earlier copies.
- Confirm cloud project identifiers, domains, contact details, and operational runbooks are suitable for public distribution. Remove private player data and machine-specific artifacts from any release bundle.
- Run lint, tests, build, browser/network checks, and the local Docker path from a fresh clone. CI already defines these checks. Record failures or environment limitations honestly.
- Confirm the community and support information reflects the public workshop release, decide whether issues and pull requests will remain enabled, and make self-hosting instructions easy to find from any workshop deployment.

Do not publish `node_modules`, `.local-tools`, `.env` files, local LAN overrides, cloud release manifests, private logs, or player data. Existing reference ZIPs contain documentation/data only and are not standalone game installers.

The root package's `private: true` prevents accidental npm publication and should remain set when making the Git repository public.

## Preparation checks (2026-10-14)

- `npm run lint`: passed.
- `npm test`: all 32 tests passed, including real transport and physics-worker tests.
- `npm run build`: both browser themes and backend built successfully.
- `docker compose -f deploy/compose.local.yaml config --quiet`: passed; images were not built or run during this preparation.
- Browser checks were attempted but could not launch because the Playwright Chromium executable is absent. Install it and rerun before release.
- Limited current-tree credential-pattern checks found no matching common private-key or token patterns. This is not a full secret audit or a Git-history review.

- `npm run test:network`: passed at injected round-trip delays of 20, 60, 150, and 300 ms; clients converged with no reported errors.

Checks used the existing installed dependencies under Node 24.19.0. Bun was unavailable in this environment, so a clean frozen-lockfile installation still needs verification.
