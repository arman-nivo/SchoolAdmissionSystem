#!/bin/sh
# Runs when the container starts (nginx image runs everything in /docker-entrypoint.d).
# Writes the API_URL environment variable into config.js, which index.html loads
# before the app. So the backend URL can change without rebuilding the image.
set -e
cat > /usr/share/nginx/html/config.js <<CONFIG
window.__APP_CONFIG__ = { apiUrl: "${API_URL}" };
CONFIG
echo "Frontend will call the API at ${API_URL}"
