# -*- mode: Python -*-

# Tilt configuration for local development
# See: https://docs.tilt.dev/

# Load Docker Compose services
docker_compose('docker-compose.yml')

# Configure API service with live updates
docker_build('safeurl/api', '.',
  dockerfile = './apps/api/Dockerfile',
  live_update = [
    sync('./apps/api/src', '/app/apps/api/src'),
    sync('./packages/core/src', '/app/packages/core/src'),
    sync('./packages/db/src', '/app/packages/db/src'),
    run('bun install', trigger='package.json'),
    run('bun install', trigger='apps/api/package.json'),
    run('bun install', trigger='packages/core/package.json'),
    run('bun install', trigger='packages/db/package.json'),
    restart_container(),
  ])

