# Operations and monitoring

Public probes: `/healthz`, `/readyz`, `/version`. Private `/internal/metrics` and `/internal/drain` accept container-loopback requests only; Caddy returns 404 and the game has no published host port. Use `status.sh` via IAP to execute the metric request inside the game container. Metrics include room/player counts, active/queued workers, bounded calculation/queue samples, error count, outgoing bytes, reconnect count, event-loop delay and process memory.

The game writes JSON lines to `/var/log/artillery/game.jsonl` on the host mount and also stdout. Ops Agent explicitly tails that file, parses JSON/time/severity, and exports host CPU/RAM/disk. Docker's local log driver separately rotates stdout at 10 MB × 3 files; logrotate bounds the application file at 20 MB/daily with seven compressed archives. Stdout alone is not assumed to arrive in Cloud Logging. Avoid IDs as metric labels; room IDs may appear in logs, reconnect tokens must not.

After actual deployment, prove a tagged log arrived:

```bash
set -a
source deploy/gcloud/config.env
set +a
gcloud logging read "resource.type=\"gce_instance\" AND jsonPayload.event=\"server-ready\" AND jsonPayload.build=\"$RELEASE_ID\"" --project="$GCLOUD_PROJECT_ID" --freshness=1h --limit=10
gcloud logging read 'resource.type="gce_instance" AND jsonPayload.room="ROOMCODE"' --project="$GCLOUD_PROJECT_ID" --freshness=1h --limit=50
gcloud logging read 'resource.type="gce_instance" AND (severity>=ERROR OR jsonPayload.workerErrors>0)' --project="$GCLOUD_PROJECT_ID" --freshness=1h --limit=50
```

If ingestion is absent, inspect `sudo systemctl status google-cloud-ops-agent`, its journal, runtime IAM/scopes and the host file. `logs.sh` also provides container logs via IAP. Do not report successful ingestion before a matching query result exists.

Create the public uptime check after DNS/TLS works (CLI help verified with gcloud 586):

```bash
gcloud monitoring uptime create artillery-ready --project="$GCLOUD_PROJECT_ID" \
  --resource-type=uptime-url --resource-labels="host=$GAME_DOMAIN,project_id=$GCLOUD_PROJECT_ID" \
  --protocol=https --port=443 --path=/readyz --validate-ssl=true --period=60 --timeout=10
```

In Monitoring → Alerting, choose an operator notification channel and create: uptime failed from two regions for 2 minutes; host CPU >80% for 5 minutes; memory used >85% for 5 minutes; disk used >80% for 10 minutes. Create log-based metrics from `event="metrics"`: queue depth, worker error increases, calculation and queue-wait quantiles. Alert on any shot-job failure and sustained queue growth. Confirm thresholds against rehearsal evidence; defaults are starting recommendations. No notification destination is invented by scripts.

Before workshop: record host/application metrics during separate-machine load, check denied private paths and external ports, test graceful drain, matched-pair rollback and VM reboot. Freeze images/config and avoid proxy reload/redeploy while games run. systemd restarts the existing digest pair after boot; Caddy volumes persist. Live matches are lost on restart or VM loss. Recovery means healthy new room admission.

Operational limits: 15-minute drain bound; waiting rooms expire after 10 minutes; forced drain explicitly aborts active matches. SIGTERM waits 30 seconds before aborting remaining rooms and releases all workers. If a process is alive but unhealthy, health status alone does not restart it; alert and investigate before a controlled restart.
