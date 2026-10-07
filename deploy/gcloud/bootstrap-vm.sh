#!/usr/bin/env bash
set -euo pipefail
# Run as root on the dedicated Ubuntu 24.04 VM. No developer credentials.
[[ $(id -u) == 0 ]] || { echo 'Run bootstrap with sudo.' >&2; exit 1; }
source /etc/os-release
[[ "$ID" == ubuntu && "$VERSION_ID" == 24.04 ]] || { echo 'Expected Ubuntu 24.04.' >&2; exit 1; }
apt-get update
apt-get install -y ca-certificates curl gnupg logrotate
install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc; chmod a+r /etc/apt/keyrings/docker.asc; fi
printf '%s\n' 'deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable' > /etc/apt/sources.list.d/artillery-docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
if ! command -v docker-credential-gcr >/dev/null; then
  artillery_tmp=$(mktemp -d)
  curl -fsSL https://github.com/GoogleCloudPlatform/docker-credential-gcr/releases/download/v2.1.29/docker-credential-gcr_linux_amd64-2.1.29.tar.gz -o "$artillery_tmp/helper.tar.gz"
  tar -xzf "$artillery_tmp/helper.tar.gz" -C "$artillery_tmp" docker-credential-gcr
  install -m 0755 "$artillery_tmp/docker-credential-gcr" /usr/local/bin/docker-credential-gcr
fi
# env means ADC, which resolves the attached VM service account via metadata.
docker-credential-gcr config --token-source=env
if ! dpkg-query -W google-cloud-ops-agent >/dev/null 2>&1; then
  artillery_ops=$(mktemp)
  curl -fsSL https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh -o "$artillery_ops"
  bash "$artillery_ops" --also-install
fi
install -d -m 0755 /opt/artillery
install -d -m 0755 -o 1000 -g 1000 /var/log/artillery
if [[ -f /opt/artillery/artillery.service ]]; then
  install -m 0644 /opt/artillery/artillery.service /etc/systemd/system/artillery.service
  systemctl daemon-reload
  systemctl enable artillery.service
fi
if [[ -f /opt/artillery/ops-agent.yaml ]]; then
  install -m 0644 /opt/artillery/ops-agent.yaml /etc/google-cloud-ops-agent/config.yaml
  systemctl restart google-cloud-ops-agent
fi
if [[ -f /opt/artillery/artillery.logrotate ]]; then install -m 0644 /opt/artillery/artillery.logrotate /etc/logrotate.d/artillery; fi
