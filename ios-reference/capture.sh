#!/bin/bash
# capture.sh - Capture repeatable PNG screenshots from iOS Simulator
#
# Usage:
#   ./capture.sh [variant] [mode]
#     variant: "regular" or "clear" (default: "regular")
#     mode:    "light" or "dark"    (default: "light")
#     Special: ./capture.sh all    -- captures all 4 permutations
#
# IMPORTANT LIMITATION:
#   This script does NOT toggle the app's glass variant (regular vs clear).
#   It captures whatever variant the app is currently displaying.
#   You must manually toggle the variant in the app's UI before running
#   capture for that variant.
#
#   When using "all" mode, the script captures light and dark mode for the
#   CURRENT variant, then pauses and asks you to toggle the variant in-app
#   before capturing the second set. Phase 14 automation will address this.
#
#   The script DOES set light/dark mode via `xcrun simctl ui` because that
#   can be controlled externally without in-app interaction.
#
# Requirements:
#   - iOS Simulator booted with the GlassReference app running
#   - Xcode command-line tools installed
#   - Optional: exiftool (brew install exiftool) for thorough metadata stripping
#     Falls back to sips if exiftool is not available.

set -euo pipefail

# Ensure DEVELOPER_DIR is set for xcrun
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/screenshots"
DEVICE="booted"

# Cleanup function: always clear status bar overrides
cleanup() {
    xcrun simctl status_bar "$DEVICE" clear 2>/dev/null || true
}
trap cleanup EXIT

# --- "all" mode ---
if [[ "${1:-}" == "all" ]]; then
    echo "=== Capture All Permutations ==="
    echo ""
    echo "NOTE: This script cannot toggle the glass variant in-app." >&2
    echo "  1. First, ensure the app shows the REGULAR variant." >&2
    echo "  2. The script will capture regular_light and regular_dark." >&2
    echo "  3. Then toggle the app to CLEAR variant when prompted." >&2
    echo "  4. The script will capture clear_light and clear_dark." >&2
    echo "" >&2

    PASS_COUNT=0
    FAIL_COUNT=0

    # Capture current variant (assumed regular) in both modes
    for variant in regular clear; do
        if [[ "$variant" == "clear" ]]; then
            echo "" >&2
            echo ">>> Please toggle the app to CLEAR variant now. <<<" >&2
            echo ">>> Press Enter when ready... <<<" >&2
            read -r
        fi
        for mode in light dark; do
            echo "=== Capturing: ${variant} ${mode} ==="
            if "$0" "$variant" "$mode"; then
                ((PASS_COUNT++))
            else
                ((FAIL_COUNT++))
            fi
        done
    done

    echo ""
    echo "=== Results: ${PASS_COUNT} passed, ${FAIL_COUNT} failed ==="
    if [[ "$FAIL_COUNT" -gt 0 ]]; then
        exit 1
    fi
    exit 0
fi

# --- Single permutation mode ---
VARIANT="${1:-regular}"
MODE="${2:-light}"

# Validate arguments
if [[ "$VARIANT" != "regular" && "$VARIANT" != "clear" ]]; then
    echo "ERROR: variant must be 'regular' or 'clear', got '$VARIANT'" >&2
    exit 1
fi
if [[ "$MODE" != "light" && "$MODE" != "dark" ]]; then
    echo "ERROR: mode must be 'light' or 'dark', got '$MODE'" >&2
    exit 1
fi

BASENAME="${VARIANT}_${MODE}"
mkdir -p "$OUTPUT_DIR"

echo "Capturing: variant=$VARIANT mode=$MODE -> ${BASENAME}.png"

# 1. Override status bar for clean, consistent captures
echo "  Setting status bar overrides..."
xcrun simctl status_bar "$DEVICE" override \
    --time "9:41" \
    --batteryState charged \
    --batteryLevel 100 \
    --wifiBars 3 \
    --operatorName ""

# 2. Set simulator appearance (light/dark)
echo "  Setting appearance to $MODE..."
xcrun simctl ui "$DEVICE" appearance "$MODE"

# Wait for glass rendering to settle after appearance change
echo "  Waiting 3s for rendering to settle..."
sleep 3

# 3. Capture 3 consecutive screenshots
echo "  Capturing 3 screenshots..."
for i in 1 2 3; do
    xcrun simctl io "$DEVICE" screenshot \
        --type=png \
        --mask=ignored \
        "$OUTPUT_DIR/${BASENAME}_${i}.png"
    sleep 1
done

# 4. Strip PNG metadata for clean comparison
echo "  Stripping PNG metadata..."
if command -v exiftool &>/dev/null; then
    for i in 1 2 3; do
        exiftool -all= -overwrite_original "$OUTPUT_DIR/${BASENAME}_${i}.png"
    done
else
    echo "  WARNING: exiftool not found. Install via 'brew install exiftool' for metadata stripping."
    echo "  Falling back to sips re-export (may not strip all metadata)."
    for i in 1 2 3; do
        sips -s format png "$OUTPUT_DIR/${BASENAME}_${i}.png" --out "$OUTPUT_DIR/${BASENAME}_${i}.png" 2>/dev/null
    done
fi

# 5. Verify pixel-identical reproducibility
echo "  Verifying pixel-identity across 3 captures..."
if cmp -s "$OUTPUT_DIR/${BASENAME}_1.png" "$OUTPUT_DIR/${BASENAME}_2.png" && \
   cmp -s "$OUTPUT_DIR/${BASENAME}_2.png" "$OUTPUT_DIR/${BASENAME}_3.png"; then
    echo "PASS: ${BASENAME} - 3 captures are pixel-identical"
    # Keep only the first as the canonical reference
    cp "$OUTPUT_DIR/${BASENAME}_1.png" "$OUTPUT_DIR/${BASENAME}.png"
    rm -f "$OUTPUT_DIR/${BASENAME}_1.png" "$OUTPUT_DIR/${BASENAME}_2.png" "$OUTPUT_DIR/${BASENAME}_3.png"
    echo "  -> Saved: $OUTPUT_DIR/${BASENAME}.png"
else
    echo "FAIL: ${BASENAME} - captures differ!"
    echo "  Keeping all 3 for inspection:"
    echo "    $OUTPUT_DIR/${BASENAME}_1.png"
    echo "    $OUTPUT_DIR/${BASENAME}_2.png"
    echo "    $OUTPUT_DIR/${BASENAME}_3.png"
    # Show which files differ
    cmp "$OUTPUT_DIR/${BASENAME}_1.png" "$OUTPUT_DIR/${BASENAME}_2.png" 2>&1 || true
    cmp "$OUTPUT_DIR/${BASENAME}_2.png" "$OUTPUT_DIR/${BASENAME}_3.png" 2>&1 || true
    exit 1
fi
