#!/bin/bash

echo "Updating: ARIES VLM Demo"

git checkout master
before_hash=$(git rev-parse HEAD)
git pull
after_hash=$(git rev-parse HEAD)

if [ "$before_hash" == "$after_hash" ]; then
    echo "No new changes. Docker build is not required."

else
    echo "Changes detected. Starting Docker build..."
    docker compose build
     if [ $? -eq 0 ]; then
        echo "Docker build completed successfully."
    else
        echo "Docker build failed."
        exit 1 
    fi
fi

exit 0