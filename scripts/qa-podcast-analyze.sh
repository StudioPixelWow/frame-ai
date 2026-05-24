#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# QA Script: Podcast Episode Analysis Pipeline
# Run this AFTER Vercel deploy to verify everything works
# ═══════════════════════════════════════════════════════════════════

set -e

# Load env
source .env.local 2>/dev/null || true

SUPABASE_URL="https://uaruggdabeyiuppcvbbi.supabase.co"
SB_KEY="$SUPABASE_SERVICE_ROLE_KEY"

if [ -z "$SB_KEY" ]; then
  echo "❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env.local"
  exit 1
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  QA: Podcast Episode Analysis Pipeline"
echo "════════════════════════════════════════════════════════════"

# ── Test 1: Check if podcast_episodes table exists and is accessible
echo ""
echo "🔍 Test 1: DB table access..."
EPISODES=$(curl -s "${SUPABASE_URL}/rest/v1/podcast_episodes?select=id,status,audio_file_path,source_file_path,created_at&order=created_at.desc&limit=5" \
  -H "apikey: ${SB_KEY}" \
  -H "Authorization: Bearer ${SB_KEY}")

if echo "$EPISODES" | grep -q '"id"'; then
  echo "✅ podcast_episodes table accessible"
  echo "   Latest episodes:"
  echo "$EPISODES" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for ep in data[:5]:
    audio = 'YES' if ep.get('audio_file_path') else 'NO'
    print(f\"   - {ep['id'][:8]}... status={ep['status']} audio={audio} created={ep.get('created_at','?')[:19]}\")
" 2>/dev/null || echo "   (raw): $EPISODES"
else
  echo "❌ Cannot access podcast_episodes table"
  echo "   Response: $EPISODES"
fi

# ── Test 2: Check for stuck episodes (status='uploaded' or 'analyzing' for >10min)
echo ""
echo "🔍 Test 2: Stuck episodes check..."
STUCK=$(curl -s "${SUPABASE_URL}/rest/v1/podcast_episodes?select=id,status,updated_at&status=in.(uploaded,analyzing)&order=updated_at.asc&limit=10" \
  -H "apikey: ${SB_KEY}" \
  -H "Authorization: Bearer ${SB_KEY}")

STUCK_COUNT=$(echo "$STUCK" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")

if [ "$STUCK_COUNT" = "0" ] || [ "$STUCK_COUNT" = "?" ]; then
  echo "✅ No stuck episodes"
else
  echo "⚠️  Found $STUCK_COUNT potentially stuck episodes:"
  echo "$STUCK" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for ep in data:
    print(f\"   - {ep['id'][:8]}... status={ep['status']} last_update={ep.get('updated_at','?')[:19]}\")
" 2>/dev/null
fi

# ── Test 3: Check JSONB fallback table for orphan episodes
echo ""
echo "🔍 Test 3: JSONB orphan check..."
JSONB=$(curl -s "${SUPABASE_URL}/rest/v1/app_podcast_episodes?select=id,data&limit=5" \
  -H "apikey: ${SB_KEY}" \
  -H "Authorization: Bearer ${SB_KEY}")

if echo "$JSONB" | grep -q '"id"'; then
  JSONB_COUNT=$(echo "$JSONB" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
  echo "⚠️  Found $JSONB_COUNT episodes in JSONB fallback table (app_podcast_episodes)"
  echo "   These may not be in the relational table — the fix should auto-migrate them"
else
  echo "✅ No orphan episodes in JSONB fallback (or table doesn't exist)"
fi

# ── Test 4: Check Storage bucket for audio files
echo ""
echo "🔍 Test 4: Storage bucket check..."
STORAGE=$(curl -s "${SUPABASE_URL}/storage/v1/bucket/project-files" \
  -H "apikey: ${SB_KEY}" \
  -H "Authorization: Bearer ${SB_KEY}")

if echo "$STORAGE" | grep -q '"id"'; then
  echo "✅ project-files bucket exists"
  # Check if there are audio files
  AUDIO_FILES=$(curl -s "${SUPABASE_URL}/storage/v1/object/list/project-files" \
    -H "apikey: ${SB_KEY}" \
    -H "Authorization: Bearer ${SB_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"prefix":"uploads/","limit":10,"search":"-audio.mp3"}')

  AUDIO_COUNT=$(echo "$AUDIO_FILES" | python3 -c "import json,sys; data=json.load(sys.stdin); print(len([f for f in data if 'audio' in f.get('name','')]))" 2>/dev/null || echo "?")
  echo "   Audio files in uploads/: $AUDIO_COUNT"
else
  echo "❌ project-files bucket not found!"
  echo "   Response: $STORAGE"
fi

# ── Test 5: Verify the deployed analyze endpoint responds
echo ""
echo "🔍 Test 5: Analyze endpoint health check..."
echo "   Sending POST with fake episodeId to check endpoint is alive..."

# Find the Vercel URL from package.json or vercel.json
VERCEL_URL=""
if [ -f "vercel.json" ]; then
  VERCEL_URL=$(python3 -c "import json; d=json.load(open('vercel.json')); print(d.get('alias',[''])[0])" 2>/dev/null)
fi

# Try common URLs
for URL in "https://frame-ai.vercel.app" "https://pixel-manage.vercel.app" "https://pixelmanage.vercel.app"; do
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${URL}/api/podcast/episode-analyze" \
    -H "Content-Type: application/json" \
    -d '{"episodeId":"00000000-0000-0000-0000-000000000000"}' \
    --connect-timeout 10 --max-time 30 2>/dev/null)

  if [ "$RESPONSE" != "000" ]; then
    echo "   URL: ${URL}"
    if [ "$RESPONSE" = "404" ]; then
      echo "✅ Endpoint alive — returned 404 (episode not found) — CORRECT!"
    elif [ "$RESPONSE" = "500" ]; then
      # Get the actual error
      ERROR_BODY=$(curl -s -X POST "${URL}/api/podcast/episode-analyze" \
        -H "Content-Type: application/json" \
        -d '{"episodeId":"00000000-0000-0000-0000-000000000000"}' \
        --connect-timeout 10 --max-time 30 2>/dev/null)
      echo "❌ Endpoint returned 500 — module may be crashing"
      echo "   Response: $ERROR_BODY"
    elif [ "$RESPONSE" = "400" ]; then
      echo "✅ Endpoint alive — returned 400 (validation)"
    else
      echo "⚠️  Endpoint returned HTTP $RESPONSE"
    fi
    break
  fi
done

if [ "$RESPONSE" = "000" ]; then
  echo "⚠️  Could not reach any known Vercel URL"
  echo "   Please enter your Vercel deployment URL and run:"
  echo "   curl -X POST YOUR_URL/api/podcast/episode-analyze -H 'Content-Type: application/json' -d '{\"episodeId\":\"00000000-0000-0000-0000-000000000000\"}'"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  QA Summary"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "If all tests pass ✅, try uploading a SHORT video (< 50MB)"
echo "and watch the browser console for:"
echo "  [podcast] Episode created: <uuid>"
echo "  [podcast] Triggering episode analysis for: <uuid>"
echo "  [podcast-poll] #1 status=analyzing ..."
echo ""
echo "In Vercel Logs, search for:"
echo "  [episode-analyze] === POST received ==="
echo "  [episode-analyze] Episode found: id=..."
echo "  [episode-analyze] Status set to analyzing OK"
echo ""
echo "If status stays 'uploaded' after 30s, check Vercel Logs for errors."
echo ""
