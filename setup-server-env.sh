#!/bin/bash

# This script sets up the .env.payroll file on the server

# Define environment variables
cat << EOF | ssh root@161.97.78.56 'cat > /root/.env.payroll'
# Database URL for connecting from the server during build and test
DATABASE_URL=postgresql://postgres:postgres@localhost:4003/postgres

# Database URL for connecting from inside Docker containers
DOCKER_DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:4003/postgres
EOF

# Make the script executable
chmod +x setup-server-env.sh

echo "Successfully created .env.payroll on the server!" 