#!/bin/bash
set -e

# Deploy Capataz to Oracle Cloud VM
# Usage: ./scripts/deploy-oracle.sh <VM_PUBLIC_IP> <DB_PASSWORD>

VM_IP=${1:-}
DB_PASSWORD=${2:-}

if [ -z "$VM_IP" ]; then
  echo "Usage: $0 <VM_PUBLIC_IP> <DB_PASSWORD>"
  echo "Example: $0 140.238.1.23 my_secure_password"
  exit 1
fi

if [ -z "$DB_PASSWORD" ]; then
  echo "Error: DB_PASSWORD is required (use a strong password)"
  exit 1
fi

echo "📦 Deploying Capataz to Oracle VM at $VM_IP..."

# Copy code to VM
echo "📤 Transferring code to VM..."
rsync -avz \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.env.local' \
  --exclude 'dist' \
  . ubuntu@$VM_IP:/home/ubuntu/capataz/

echo "✅ Code transferred"

# Create .env.local on VM with sensible defaults
echo "⚙️  Creating .env.local on VM..."
ssh -i ~/.ssh/oracle_arm ubuntu@$VM_IP bash << 'EOF'
cat > /home/ubuntu/capataz/.env.local << 'ENVEOF'
# Copernicus Sentinel Hub credentials
# Get these from https://dataspace.copernicus.eu/
SENTINEL_HUB_CLIENT_ID=your_client_id_here
SENTINEL_HUB_CLIENT_SECRET=your_client_secret_here
MOCK_SENTINEL=true
ENVEOF
chmod 600 /home/ubuntu/capataz/.env.local
echo "✅ .env.local created (edit with real Copernicus credentials)"
EOF

echo ""
echo "📋 Next steps:"
echo "1. SSH to the VM: ssh -i ~/.ssh/oracle_arm ubuntu@$VM_IP"
echo "2. Update .env.local with real Copernicus credentials:"
echo "   - Get client_id/secret from https://dataspace.copernicus.eu/"
echo "   - Set MOCK_SENTINEL=false when ready to use real satellite data"
echo "3. Create proxy-net network (run once on VM):"
echo "   docker network create proxy-net --driver bridge"
echo "4. Start the app:"
echo "   cd /home/ubuntu/capataz"
echo "   DB_PASSWORD='$DB_PASSWORD' docker compose -f docker-compose.oracle.yml up --build -d"
echo "5. Set up Nginx Proxy Manager:"
echo "   - Admin UI at http://$VM_IP:81"
echo "   - Default: admin@example.com / changeme"
echo "   - Add proxy host for capataz.sereylab.com → capataz-app:3000"
echo "6. Update DNS for capataz.sereylab.com to point to $VM_IP"
echo ""
