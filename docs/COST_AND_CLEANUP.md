# Cost and cleanup

No cloud spend has been authorized or incurred by this implementation. Estimate actual workshop dates/hours using [Google Cloud's pricing calculator](https://cloud.google.com/products/calculator): select Compute Engine in Mumbai/Delhi, the configured VM, 30 GB Hyperdisk Balanced, external IPv4, expected internet egress, Artifact Registry image storage and Cloud Logging ingestion/retention. Add optional DNS or Cloud Build only if you actually choose them. Prices and availability change; record the calculator date and exported estimate instead of a fixed cost promise.

In Billing → Budgets & alerts, choose the workshop project, date scope and your spending amount. Add actual and forecast thresholds (for example 50/90/100%) and tested email recipients. Billing account permissions may be needed. **Budgets notify; they do not cap spending or automatically stop services.** Budget alerts may be delayed.

Stopping the VM (`bash deploy/gcloud/stop.sh`) stops runtime compute but preserves boot disk, reserved IPv4, images and logs, which can remain billable. It ends in-memory matches. Static IP/certificate state remains for a later restart.

`bash deploy/gcloud/cleanup.sh` prints a plan without deleting. After reviewing, `bash deploy/gcloud/cleanup.sh --execute` removes the workshop-labelled VM and its boot disk, ownership-marked address, ingress rules, subnet and network. Boot-disk/certificate deletion is irreversible without a backup. It does not delete a project, shared network, registry images, service account or external DNS.

Review retained registry images/repository in Artifact Registry; delete only the workshop repository when no release needs retention. Remove the specific runtime role bindings/service account when no resource uses it. Remove DNS A records at the actual provider, uptime checks/alerts, and review log retention/buckets. List leftover disks/addresses by explicit project, and verify ownership before deletion. Keep a cleanup receipt and check the next billing view for lingering charges.
