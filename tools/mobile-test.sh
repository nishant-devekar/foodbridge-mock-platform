#!/usr/bin/env bash
# Mobile testing harness for the FoodBridge mock platform.
#
# Boots a real Android emulator (Chrome) and/or a real iOS Simulator (Safari),
# then points them at the local v3 server. Nothing here emulates a phone in a
# desktop browser -- both targets run the actual mobile OS and browser engine.
#
#   ./tools/mobile-test.sh android     # boot Pixel 8 + open Stock Audit in Chrome
#   ./tools/mobile-test.sh ios         # boot iPhone 16 Pro + open Stock Audit in Safari
#   ./tools/mobile-test.sh both
#   ./tools/mobile-test.sh shot        # screenshot whatever is currently booted
#   ./tools/mobile-test.sh stop
#
# Override the page under test:
#   PAGE=index.html ./tools/mobile-test.sh ios

set -euo pipefail

# --- config -----------------------------------------------------------------
ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export ANDROID_HOME
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

# Xcode.app is installed but xcode-select still points at CommandLineTools, so
# every xcrun call below is scoped with DEVELOPER_DIR rather than relying on it.
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"

AVD="FoodBridge_Pixel8"
SIM="FoodBridge_iPhone16Pro"
PORT=8001
PAGE="${PAGE:-modules/foodbridge-customer-mockup/v2/screens/customers/stock-audit.html}"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHOTS="$REPO/.mobile-shots"

# The Android emulator reaches the host loopback through 10.0.2.2; the iOS
# Simulator shares the host network stack, so plain localhost works there.
ANDROID_URL="http://10.0.2.2:$PORT/$PAGE"
IOS_URL="http://localhost:$PORT/$PAGE"

# --- local web server -------------------------------------------------------
start_server() {
  if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "server: already listening on $PORT"
  else
    echo "server: starting python http.server on $PORT (serving v3/)"
    (cd "$REPO" && nohup python3 -m http.server "$PORT" --bind 0.0.0.0 --directory v3 \
      >/tmp/foodbridge-http.log 2>&1 &)
    sleep 1
  fi
}

# --- android ----------------------------------------------------------------
start_android() {
  start_server
  if adb devices | grep -q "emulator-.*device"; then
    echo "android: emulator already running"
  else
    echo "android: booting $AVD"
    nohup emulator -avd "$AVD" -gpu host >/tmp/foodbridge-emulator.log 2>&1 &
    adb wait-for-device
    until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
      sleep 3
    done
  fi
  echo "android: opening $ANDROID_URL"
  adb shell am start -a android.intent.action.VIEW -d "$ANDROID_URL" com.android.chrome >/dev/null
  # Expose Chrome's DevTools Protocol on the host for console/network inspection.
  adb forward tcp:9222 localabstract:chrome_devtools_remote >/dev/null
  echo "android: DevTools at http://127.0.0.1:9222/json/list"
}

# --- ios --------------------------------------------------------------------
start_ios() {
  start_server
  local udid
  udid=$(xcrun simctl list devices | grep "$SIM" | sed -E 's/.*\(([-0-9A-F]{36})\).*/\1/' | head -1)
  if [ -z "${udid:-}" ]; then
    echo "ios: simulator '$SIM' not found -- create it with:"
    echo "  xcrun simctl create $SIM com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro com.apple.CoreSimulator.SimRuntime.iOS-26-5"
    return 1
  fi
  echo "ios: booting $SIM ($udid)"
  xcrun simctl boot "$udid" 2>/dev/null || echo "ios: already booted"
  open -a Simulator
  until xcrun simctl list devices | grep -q "$udid.*Booted"; do sleep 3; done
  echo "ios: opening $IOS_URL"
  # First openurl after a cold boot can time out while Safari is still starting.
  xcrun simctl openurl "$udid" "$IOS_URL" 2>/dev/null || {
    sleep 5; xcrun simctl openurl "$udid" "$IOS_URL"
  }
  echo "$udid" >/tmp/foodbridge-ios-udid
}

# --- screenshots ------------------------------------------------------------
shot() {
  mkdir -p "$SHOTS"
  local stamp; stamp=$(date +%H%M%S)
  if adb devices 2>/dev/null | grep -q "emulator-.*device"; then
    adb exec-out screencap -p >"$SHOTS/android-$stamp.png"
    echo "wrote $SHOTS/android-$stamp.png"
  fi
  if [ -f /tmp/foodbridge-ios-udid ]; then
    xcrun simctl io "$(cat /tmp/foodbridge-ios-udid)" screenshot --type=png \
      "$SHOTS/ios-$stamp.png" >/dev/null 2>&1 && echo "wrote $SHOTS/ios-$stamp.png"
  fi
}

stop_all() {
  adb emu kill 2>/dev/null || true
  xcrun simctl shutdown all 2>/dev/null || true
  pkill -f "http.server $PORT" 2>/dev/null || true
  echo "stopped emulator, simulators, and local server"
}

case "${1:-both}" in
  android) start_android ;;
  ios)     start_ios ;;
  both)    start_android; start_ios ;;
  shot)    shot ;;
  stop)    stop_all ;;
  *) echo "usage: $0 {android|ios|both|shot|stop}"; exit 1 ;;
esac
