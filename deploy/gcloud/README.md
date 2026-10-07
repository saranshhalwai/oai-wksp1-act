# Google Cloud operator runbook

Configuration is prepared; **no project, VM or public URL is implied**. The implementation session has not provisioned cloud resources. Get deployment/spend authorization for the exact plan below before running provision/build-push/deploy.

Supported operator environment: Bash on Linux, macOS, WSL2 or Cloud Shell; Node 22.20+, Bun 1.4.2, Docker Engine with Compose/Buildx, gcloud CLI (help verified with 586.0.0). Windows PowerShell is not Bash: install WSL2 and Docker Desktop's WSL integration, and run these scripts inside WSL. Cloud Shell can build small releases, but disk/CPU/session limits vary; a local authenticated Docker build is the primary path. No Cloud Build service account/staging bucket is required.

## Configure and review

```bash
cp deploy/gcloud/config.env.example deploy/gcloud/config.env
# Edit every empty value; use your real existing billing-enabled project.
gcloud auth login
bun install --frozen-lockfile
bash deploy/gcloud/preflight.sh
```

Preflight never changes the selected gcloud project. Every resource command has an explicit project and applicable region/zone. It checks billing, APIs, active account, provisioning permissions, machine and disk existence, OS image family, regional quotas and DNS inputs. Review quota headroom and zone capacity; a machine listing does not reserve capacity. IAM tests cannot guarantee organization policies allow creation.

Defaults: asia-south1 / asia-south1-a, `pocket-tank-server`, `c4d-standard-4` (4 vCPU, 15 GiB), 30 GB boot disk, Ubuntu `ubuntu-2404-lts-amd64` from `ubuntu-os-cloud`, one physics worker. **C4D cannot attach pd-balanced.** The runnable configuration corrects that incompatible prompt default to `hyperdisk-balanced`; choosing a different VM/disk pair is an explicit operator configuration change. Preflight resolves the current Ubuntu image using gcloud. Compare actual venue RTT to Mumbai and Delhi before freezing a region. No capacity guarantee is attached to these defaults.

Plan: a dedicated custom VPC/subnet; web ingress TCP 80/443 targeted only to this VM; SSH TCP 22 only from IAP 35.235.240.0/20; one regional static IPv4; a private immutable-tag Artifact Registry repository; a dedicated runtime service account; a standard non-Spot VM. Game 2567 and admin/metrics have no published host port. Caddy denies internal/admin/metrics HTTP paths.

Operator provisioning needs Compute instance/network/firewall/address/disk administration, service usage enablement, Artifact Registry repository administration/writer, service-account creation, ability to bind the limited runtime roles, and `iam.serviceAccounts.actAs`. Grant the operator IAP Tunnel Resource Accessor, Compute OS Admin Login and Service Account User on the runtime identity for IAP/sudo administration. Project Owner/Editor is not a runtime requirement. Organization administrators may need to grant external-user OS Login separately. Consult [IAP access](https://docs.cloud.google.com/iap/docs/using-tcp-forwarding).

Runtime identity gets Artifact Registry Reader **on this repository only**, Logs Writer and Monitoring Metric Writer. `cloud-platform` scope permits using those IAM grants; it does not grant broader privileges. No service-account JSON keys, developer login or access token is embedded. Root runs Compose through systemd, so root's Docker credential config is created by the standalone ADC helper; it resolves the attached service account through metadata. Credential verification discards token output.

## Build, provision and deploy after authorization

```bash
bash deploy/gcloud/provision.sh
bash deploy/gcloud/build-push.sh
# Create GAME_DOMAIN's DNS A record with the printed reserved IP at your DNS provider.
# Remove stale AAAA records unless IPv6 actually works.
bash deploy/gcloud/deploy.sh
bash deploy/gcloud/verify.sh
```

Build-push runs frozen install, typecheck/lint/tests, linux/amd64 Docker builds, `gcloud auth configure-docker REGION-docker.pkg.dev`, push and digest resolution. `release.env` and `release.json` bind both images to one release/protocol/rules/physics version. Use a new RELEASE_ID for every build; immutable tags cannot be overwritten. Never deploy `latest`.

Provisioning creates or validates named resources. Conflicting or unowned resources fail rather than being overwritten. Dedicated resources use `workshop=artillery-lab` labels where appropriate and the ownership description `artillery-lab-owned`. Existing unexpected VPC ingress rules stop provisioning. Review inherited organization firewall policies as well.

Deploy validates DNS, transfers only public config/release/service files over IAP, drains an existing release, preserves previous image manifests, installs Docker/Compose and Ops Agent on Ubuntu, verifies metadata credentials and pulls by digest. systemd brings up the pinned release at reboot. Caddy persists `/data` and `/config` volumes for certificate renewal. It serves the host demos at `/neon/` and `/paper/`, the documentation/data download `/downloads/artillery-lab-backend-reference.zip`, and proxies actual Colyseus routes with WebSocket upgrades. No attendee SDK or frontend template is published. Share the verified HTTPS backend origin and allow each attendee's own frontend origin before the workshop; attendees run no local backend.

Verification checks trusted HTTPS, health/ready/version, frontend paths, denial of private metrics and a real two-client WSS room/shot with equal checksums. Run the full browser suite against production separately:

```bash
NEON_URL=https://YOUR_GAME_DOMAIN/neon/ PAPER_URL=https://YOUR_GAME_DOMAIN/paper/ npm run test:e2e
```

No domain/DNS: finish local production-container checks; do not use self-signed public certificates or ask students to disable browser trust. An IAP/SSH tunnel may be used for private diagnostics. Do not silently switch hosting architecture.

## Operations

```bash
bash deploy/gcloud/status.sh
bash deploy/gcloud/logs.sh
bash deploy/gcloud/drain.sh
bash deploy/gcloud/rollback.sh
# Deliberate emergency abort of live rooms:
bash deploy/gcloud/drain.sh --force
bash deploy/gcloud/stop.sh
bash deploy/gcloud/cleanup.sh             # print exact deletion/retention plan
bash deploy/gcloud/cleanup.sh --execute   # destructive, after reviewing plan
```

Drain stops new rooms and waits up to 15 minutes, covering standard deadlines plus waiting-room expiration. SIGTERM separately waits 30 seconds then explicitly aborts remaining matches. Rollback deploys the matched previous digest pair and verifies it. It does not recover live rooms. Rehearse rollback and `gcloud compute instances reset ...` only between test matches; verify systemd and HTTPS afterward.

Cleanup deletes only the labelled VM/boot disk and ownership-marked address/firewall/subnet/network. It retains repository/images, runtime service account/role bindings, logs and DNS records for explicit review. It never deletes the project. See [cost and cleanup](../../docs/COST_AND_CLEANUP.md) for retained charges.

See [operations and monitoring](../../docs/GCLOUD_OPERATIONS.md) for log ingestion, uptime, alerts and recovery. Official checks used: [disk support](https://docs.cloud.google.com/compute/docs/disks/persistent-disks), [Docker Ubuntu installation](https://docs.docker.com/engine/install/ubuntu/), [Artifact Registry credentials](https://docs.cloud.google.com/artifact-registry/docs/docker/authentication), [Ops Agent configuration](https://docs.cloud.google.com/monitoring/agent/ops-agent/configuration).
