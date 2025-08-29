#!/bin/bash

cd /home/mobilint/aries-vlm-demo

# Start the server
docker compose up

# Wait indefinitely. The cleanup function will handle interruption and cleanup.
wait