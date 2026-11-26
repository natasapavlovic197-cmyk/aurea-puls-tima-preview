#!/usr/bin/env bash
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=$1
RC=$2
OUT=$3
test "$(git -C "$SRC" rev-parse HEAD)" = 7e2908e4e8c234a4bb8056f2017f02c70cfdb7c5
W=$(mktemp -d)
DB="aurea-closure-db-$$"; NET="aurea-closure-net-$$"; REST="aurea-closure-rest-$"; PROBE="aurea-closure-probe-$"
cleanup(){ docker rm -f "$PROBE" "$REST" "$DB" >/dev/null 2>&1 || true; docker network rm "$NET" >/dev/null 2>&1 || true; rm -rf "$W"; }
trap cleanup EXIT
python3 "$HERE/prepare.py" "$RC"
npm install --prefix "$W/deps" --no-save --ignore-scripts --no-audit --no-fund esbuild@0.25.5 @supabase/supabase-js@2.49.4 playwright-core@1.51.1
ln -s "$W/deps/node_modules" "$SRC/node_modules"
exclude=$(git -C "$SRC" rev-parse --path-format=absolute --git-path info/exclude)
printf '\n/node_modules\n' >> "$exclude"
node "$HERE/build.cjs" "$SRC" "$RC" "$OUT"
docker pull postgres:17
docker pull postgrest/postgrest:v12.2.3
docker pull curlimages/curl:8.12.1
docker network create --internal "$NET" >/dev/null
docker run -d --name "$DB" --network "$NET" -e POSTGRES_PASSWORD=disposable_qa_only -e POSTGRES_DB=aurea_fixture postgres:17 >/dev/null
for i in $(seq 1 60); do if docker exec "$DB" pg_isready -U postgres -d aurea_fixture >/dev/null 2>&1;then break;fi;sleep 1;done
sql(){ docker exec -i "$DB" psql -X -v ON_ERROR_STOP=1 -U postgres -d aurea_fixture "$@"; }
test "$(sql -Atc "select current_setting('server_version_num')::int/10000")" = 17
sql < "$RC/qa/disposable-baseline.sql"
sql < "$RC/qa/disposable-access-baseline.sql"
for f in step6-candidate.sql step5-lifecycle.review.sql billing.review.sql;do sql < "$SRC/architecture/commercial/$f";done
sql -At < "$RC/database/history.readonly.sql" > "$W/history.before"
sql < "$RC/database/micro.review.sql"
sql < "$HERE/stage-seed.sql"
export QA_DB="$DB" QA_JWT_SECRET="$(openssl rand -hex 32)" QA_CHROME="$(command -v google-chrome || command -v chromium)" NODE_PATH="$W/deps/node_modules"
docker run -d --name "$REST" --network "$NET" -e "PGRST_DB_URI=postgres://authenticator:qa-only-no-real-credential@$DB:5432/aurea_fixture" -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e "PGRST_JWT_SECRET=$QA_JWT_SECRET" -e PGRST_JWT_AUD=authenticated postgrest/postgrest:v12.2.3 >/dev/null
docker run -d --name "$PROBE" --network "$NET" --entrypoint sh curlimages/curl:8.12.1 -c 'sleep 900' >/dev/null
export QA_REST="$REST" QA_PROBE="$PROBE"
ready=false
for i in $(seq 1 40);do if docker exec "$PROBE" curl -fsS --max-time 2 "http://$REST:3000/" >/dev/null 2>&1;then ready=true;break;fi;sleep 1;done
if [[ "$ready" != true ]];then docker logs "$REST" 2>&1|tail -40;exit 1;fi
node "$HERE/test.cjs" "$OUT"
sql -c "DELETE FROM aurea_admin.education_stage_grants_v1; DELETE FROM aurea_private.memberships WHERE organization_id='00000000-0000-4000-8000-000000000011'; DELETE FROM aurea_delivery_rpc.active_recipients WHERE organization_id='00000000-0000-4000-8000-000000000011'; DELETE FROM auth.sessions WHERE user_id IN ('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000022'); DELETE FROM auth.users WHERE id IN ('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000022'); DELETE FROM aurea_commercial.accounts WHERE organization_id IN ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000012'); DELETE FROM aurea_private.organizations WHERE id IN ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000012');"
sql -At < "$RC/database/history.readonly.sql" > "$W/history.after";cmp "$W/history.before" "$W/history.after"
sql < "$RC/database/micro.rollback.sql"
test "$(sql -Atc "select to_regclass('aurea_admin.education_stage_grants_v1') is null and to_regprocedure('public.aurea_education_access_v1(uuid)') is null")" = t
sql -At < "$RC/database/history.readonly.sql" > "$W/history.rollback";cmp "$W/history.before" "$W/history.rollback"
echo 'PASS new staging grant rollback and synthetic history parity'
(cd "$OUT";find . -type f -print0|sort -z|xargs -0 sha256sum > "$W/sums";cp "$W/sums" SHA256SUMS)
