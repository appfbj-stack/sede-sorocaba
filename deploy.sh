#!/bin/bash
set -e

echo "[Kairos] Atualizando repositório..."
git pull origin main

echo "[Kairos] Construindo imagens..."
docker compose build --no-cache

echo "[Kairos] Subindo serviços..."
docker compose up -d

echo "[Kairos] Status:"
docker compose ps

echo "[Kairos] Deploy concluído!"
