#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR" || exit 1

PORT=3000
LOG="$DIR/server.log"
PIDFILE="$DIR/server.pid"
CONSOLE="$DIR/console.sh"

# Check if port is already in use and responding
if lsof -ti:"$PORT" >/dev/null 2>&1; then
  if curl -s "http://localhost:$PORT/api/status" >/dev/null 2>&1; then
    echo "Server already running on port $PORT"
    EXISTING_PID=$(lsof -ti:"$PORT")
  else
    echo "Port $PORT in use but not responding, killing..."
    kill $(lsof -ti:"$PORT") 2>/dev/null
    sleep 1
  fi
fi

# Kill previous instance if PID file exists
if [ -f "$PIDFILE" ]; then
  kill "$(cat "$PIDFILE")" 2>/dev/null || true
  rm -f "$PIDFILE"
fi

# Start server if not already running
if [ -z "$EXISTING_PID" ]; then
  export PATH="$HOME/.local/bin:$PATH"
  nohup uvicorn main:app --host 0.0.0.0 --port "$PORT" > "$LOG" 2>&1 &
  echo $! > "$PIDFILE"

  # Wait for it to be ready
  for i in $(seq 1 10); do
    if curl -s "http://localhost:$PORT/api/status" >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
fi

# URL — detect LAN IP
LAN_IP=$(ip -4 addr show | grep -oP 'inet \K192\.168\.[\d.]+' | head -1)
if [ -z "$LAN_IP" ]; then LAN_IP="localhost"; fi
URL="http://$LAN_IP:$PORT"

# Get terminal emulator
TERMINAL=""
for term in x-terminal-emulator gnome-terminal xfce4-terminal lxterminal xterm konsole; do
  if command -v "$term" &>/dev/null; then
    TERMINAL="$term"
    break
  fi
done

# Loop: dialog stays open until "Stop Server" is clicked
while true; do
  choice=$(zenity --list --radiolist \
    --title="MC Dashboard" \
    --text="<span size='x-large'><b>🎮 MC Dashboard is running!</b></span>\n\n<span size='small'>$URL</span>\n" \
    --column="" --column="Action" \
    TRUE "🌐 Open Website" \
    FALSE "🖥️ Open Console" \
    FALSE "⏹  Stop Server" \
    --width=380 --height=280 2>/dev/null)

  case "$choice" in
    "🌐 Open Website")
      xdg-open "$URL"
      ;;
    "🖥️ Open Console")
      if [ -n "$TERMINAL" ]; then
        if [ "$TERMINAL" = "gnome-terminal" ]; then
          gnome-terminal -- bash -c "$CONSOLE; read -p 'Press Enter...'"
        else
          "$TERMINAL" -e "bash $CONSOLE" &
        fi
      else
        # Fallback: just run in current terminal
        bash "$CONSOLE"
      fi
      ;;
    "⏹  Stop Server"|"")
      # Stop the server
      echo "Stopping MC server..."
      curl -s -X POST "http://localhost:$PORT/api/server/stop" > /dev/null
      echo "Stopping dashboard..."
      if [ -f "$PIDFILE" ]; then
        kill "$(cat "$PIDFILE")" 2>/dev/null || true
        rm -f "$PIDFILE"
      else
        kill $(lsof -ti:"$PORT") 2>/dev/null || true
      fi
      echo "Done. You can close this terminal."
      break
      ;;
  esac
done
