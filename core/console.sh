#!/usr/bin/env bash
# Desktop MC Server Console — tail -f logs/latest.log
DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_PATH="./pmsh"
LOG="$SERVER_PATH/logs/latest.log"

# Colors
BOLD=$(tput bold)
CYAN=$(tput setaf 6)
GREEN=$(tput setaf 2)
YELLOW=$(tput setaf 3)
RESET=$(tput sgr0)

clear
echo ""
echo "${BOLD}${CYAN}  ╔═══════════════════════════════════════════╗${RESET}"
echo "${BOLD}${CYAN}  ║      🎮 MC Server Live Console           ║${RESET}"
echo "${BOLD}${CYAN}  ║   Press Ctrl+C to exit                    ║${RESET}"
echo "${BOLD}${CYAN}  ╚═══════════════════════════════════════════╝${RESET}"
echo ""

if [ ! -f "$LOG" ]; then
  echo "${YELLOW}⚠ Server log not found at:${RESET}"
  echo "  $LOG"
  echo ""
  echo "${YELLOW}Start the server from the Dashboard first:${RESET}"
  echo "  http://0.0.0.0:3000"
  echo ""
  echo "${BOLD}Waiting for log file to appear...${RESET}"
  echo ""

  # Wait for log file to appear
  for i in $(seq 1 60); do
    if [ -f "$LOG" ]; then
      echo "${GREEN}✓ Log file found! Tailing...${RESET}"
      echo ""
      sleep 0.5
      break
    fi
    sleep 1
  done

  if [ ! -f "$LOG" ]; then
    echo "${BOLD}${YELLOW}Timed out waiting for log file. Make sure the server is running.${RESET}"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
  fi
fi

echo "${BOLD}${GREEN}── Live console output ────────────────────────${RESET}"
echo ""
tail -f "$LOG" 2>/dev/null || {
  echo "${BOLD}${YELLOW}Failed to tail log. Server may not be running.${RESET}"
  read -p "Press Enter to exit..."
  exit 1
}
