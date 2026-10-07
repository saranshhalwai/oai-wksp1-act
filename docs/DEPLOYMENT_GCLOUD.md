# Deployment design and status

The authoritative deployment target is one standard Compute Engine VM, a private regional Artifact Registry repository, one Node game process with bounded worker threads, Caddy and Ops Agent. Built frontend assets are inside the web image. There is no Cloud Run, Functions, GKE, MIG, database or Redis requirement.

Cloud Run supports WebSockets, but request timeouts and best-effort affinity do not solve authoritative placement for rooms held in process memory. That is why this baseline uses Compute Engine. Horizontal scaling is future design work, not an implemented feature.

See [the operator runbook](../deploy/gcloud/README.md) for exact commands. Default region/zone: Mumbai asia-south1/asia-south1-a. Machine: c4d-standard-4. Corrected disk: 30 GB hyperdisk-balanced because C4D does not support Persistent Disk. Both cloud image digests, project ID, actual machine availability/quota, DNS ownership, public TLS and deployed metrics are **pending operator inputs and authorized execution**.

Local production routes use `deploy/compose.local.yaml` at http://localhost:8080. Public production uses the same Caddy routing with a real domain for automated trusted certificates. CORS and WS origins must include the actual secure origin plus exact participant origins. Neither a room code nor a browser credential grants administration.

Build sources use pinned package versions and bun.lock; CI uses frozen installs. The Node container runs as UID 1000, with a readonly root filesystem and a dedicated writable log mount. Compose health checks detect unhealthy containers but Docker does not automatically restart solely because health changes; restart policy covers exited processes. Monitor health, diagnose and deliberately restart/drain when needed.

No runtime secret is required. Public URLs are not secrets; Secret Manager is unnecessary until genuine deployment secrets are introduced. Do not bake developer credentials or tokens into images.
