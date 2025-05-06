#!/bin/bash

# Get current IP address
IP_ADDRESS=$(ipconfig getifaddr en0)

# Update .env file
sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=\"postgresql://postgres:shah@${IP_ADDRESS}:5432/dvdrental?schema=public\"|" .env

echo "Updated DATABASE_URL with IP: ${IP_ADDRESS}" 