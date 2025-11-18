#!/bin/bash

events=(
  "metadata/inside/undefined-target"
  "metadata/outside/undefined-target"
  "metadata/inside/defined-target"
  "metadata/outside/defined-target"
)

echo "Testing all events..."
echo "===================="

for event in "${events[@]}"; do
  echo -e "\n📤 $event"
  curl -s localhost:8288/e/eventkey -d "{\"name\": \"$event\"}"
  echo ""
done

echo -e "\n✅ All events sent"
