#!/bin/bash
cd "$(dirname "$0")"
./scripts/stop.sh
echo ""
echo "All services stopped."
read -p "Press Enter to close..."
