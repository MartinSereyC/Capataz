# Capataz Deployment to Oracle Cloud

This guide walks through deploying Capataz to an Oracle Cloud ARM VM once it becomes available.

## Prerequisites

- Oracle Cloud ARM VM instance running Ubuntu 22.04 (`comparador-arm`)
- VM public IP address
- SSH key at `~/.ssh/oracle_arm` with permissions 600
- Docker and Docker Compose installed on the VM
- Nginx Proxy Manager running on the VM (or Caddy/Traefik)
- `capataz.sereylab.com` DNS configured to point to the VM's public IP

## One-Command Deploy

```bash
cd /path/to/capataz-fase1
./scripts/deploy-oracle.sh <VM_PUBLIC_IP> <DB_PASSWORD>
```

Replace:
- `<VM_PUBLIC_IP>` with the actual public IP (e.g., `140.238.1.23`)
- `<DB_PASSWORD>` with a strong password for the Postgres database

This will:
1. Transfer the code to the VM
2. Create `.env.local` with placeholder Copernicus credentials
3. Print next steps

## Manual Steps (if script fails)

### 1. SSH into the VM

```bash
ssh -i ~/.ssh/oracle_arm ubuntu@<VM_PUBLIC_IP>
```

### 2. Set up directories

```bash
mkdir -p /home/ubuntu/capataz
cd /home/ubuntu/capataz
```

### 3. Transfer code (from your local machine)

```bash
rsync -avz \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.env.local' \
  /path/to/capataz-fase1/ \
  ubuntu@<VM_PUBLIC_IP>:/home/ubuntu/capataz/
```

### 4. Create `.env.local` on the VM

```bash
cat > /home/ubuntu/capataz/.env.local << 'EOF'
SENTINEL_HUB_CLIENT_ID=<get_from_https://dataspace.copernicus.eu>
SENTINEL_HUB_CLIENT_SECRET=<get_from_https://dataspace.copernicus.eu>
MOCK_SENTINEL=true
EOF
chmod 600 /home/ubuntu/capataz/.env.local
```

Change `MOCK_SENTINEL=false` and add real credentials when ready for live satellite imagery.

### 5. Create the proxy network (one-time)

```bash
docker network create proxy-net --driver bridge
```

### 6. Start the app

```bash
cd /home/ubuntu/capataz
DB_PASSWORD="your_secure_db_password" \
  docker compose -f docker-compose.oracle.yml up --build -d
```

Verify:
```bash
docker compose -f docker-compose.oracle.yml logs -f
```

### 7. Configure the reverse proxy

**Using Nginx Proxy Manager:**
- Access admin UI: http://<VM_PUBLIC_IP>:81
- Default credentials: `admin@example.com` / `changeme` (change immediately!)
- Add Proxy Host:
  - Domain: `capataz.sereylab.com`
  - Scheme: http
  - Forward Hostname: `capataz-app`
  - Forward Port: `3000`
  - Enable SSL (Let's Encrypt auto)

**Using Caddy (simpler):**
Create `/home/ubuntu/Caddyfile`:
```
capataz.sereylab.com {
  reverse_proxy capataz-app:3000
}
```

### 8. Point DNS to the VM

Update your DNS provider (`sereylab.com` registrar) to point `capataz` subdomain to the VM's public IP.

## Updating the app

To redeploy after code changes:

```bash
ssh -i ~/.ssh/oracle_arm ubuntu@<VM_PUBLIC_IP>
cd /home/ubuntu/capataz
git pull origin main  # or rsync again
DB_PASSWORD="..." docker compose -f docker-compose.oracle.yml up --build -d
```

## Monitoring

View logs:
```bash
ssh -i ~/.ssh/oracle_arm ubuntu@<VM_PUBLIC_IP>
cd /home/ubuntu/capataz
docker compose -f docker-compose.oracle.yml logs -f app
```

Check containers:
```bash
docker ps | grep capataz
```

## Database password

**Change the default immediately:**

The default password is `capataz`. To change it:

1. SSH to VM
2. `docker compose -f docker-compose.oracle.yml down`
3. Edit `docker-compose.oracle.yml`: change `${DB_PASSWORD:-capataz}` default
4. `DB_PASSWORD="new_password" docker compose -f docker-compose.oracle.yml up --build -d`

## Troubleshooting

**"Out of host capacity" on VM creation**
- Santiago region (sa-santiago-1) often runs out of Always Free capacity
- Solutions: wait and retry, use a different region, or deploy to Vercel instead

**App crashes, "cannot connect to database"**
- Ensure `capataz-db` container is healthy: `docker ps | grep capataz-db`
- Check healthcheck: `docker compose -f docker-compose.oracle.yml ps`
- Verify `DATABASE_URL` in `.env.local` matches compose config

**HTTPS not working**
- Wait ~5 minutes for Let's Encrypt certificate generation
- Check Nginx Proxy Manager logs for errors
- Verify DNS points to the correct IP

**Sentinel imagery not loading**
- Check `.env.local`: ensure `MOCK_SENTINEL=false` and credentials are correct
- Verify credentials at https://dataspace.copernicus.eu/ (may need to create/regenerate)
- Check logs: `docker logs capataz-app | grep -i sentinel`

## Cleanup

To remove the app:
```bash
ssh -i ~/.ssh/oracle_arm ubuntu@<VM_PUBLIC_IP>
cd /home/ubuntu/capataz
docker compose -f docker-compose.oracle.yml down -v  # -v removes data
```

To remove the proxy network:
```bash
docker network rm proxy-net
```
