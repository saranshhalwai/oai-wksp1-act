# Cloudflare Tunnel deployment variant

This variant keeps the production web routing and game service, but leaves public TLS at Cloudflare. Caddy serves HTTP on the VM's loopback address only; `cloudflared` connects to `http://localhost:80`. No inbound 80/443 firewall rule is required. Cloudflare Tunnel supports the WebSocket upgrades used by the game.

The standard Google Cloud deployment is unchanged and continues to use `deploy/Caddyfile` and `deploy/compose.yaml` with direct public HTTPS. For a Tunnel deployment:

1. Put the domain's DNS zone on Cloudflare and create a named Tunnel for the VM. Publish the hostname `GAME_DOMAIN` to `http://localhost:80`.
2. Build the web image with `--build-arg CADDYFILE=deploy/Caddyfile.tunnel`. Keep the server image and release manifest digest-pinned as in the standard deployment.
3. On the VM, use `deploy/compose.tunnel.yaml` instead of `deploy/compose.yaml`. It binds the web origin to `127.0.0.1:80` and publishes neither the game port nor 443.
4. Keep the VM's inbound web ports closed. `cloudflared` needs outbound connectivity to Cloudflare; Docker needs outbound connectivity to pull images.

Cloudflare terminates attendee HTTPS/WSS. Set `ALLOWED_ORIGINS` to the exact attendee frontend origins (for example, the workshop's chosen localhost development ports) and the HTTPS game origin. Do not add broad wildcards.
