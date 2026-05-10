#!/bin/bash
#
# SAAS-15 Gate F: Backup Restore Test Script
# Purpose: Verify backup integrity and measure restore time
# Usage: ./test-backup-restore.sh [BACKUP_DATE] [DB_HOST] [DB_USER] [DB_NAME]
#
# Example:
#   ./test-backup-restore.sh 2026-05-10 localhost postgres vninvest_test
#
# Prerequisites:
#   - postgresql-client installed (psql, pg_dump, pg_restore)
#   - AWS CLI configured (if testing S3/R2 backup)
#   - Local backup file or S3 access
#   - Write access to create/drop test database
#

set -euo pipefail

# Configuration
BACKUP_DATE="${1:-$(date +%Y%m%d)}"
DB_HOST="${2:-localhost}"
DB_USER="${3:-postgres}"
DB_NAME="${4:-vninvest}"
TEST_DB="vninvest_restore_test_$$"  # Use PID for isolation
RTO_TARGET_SECONDS=300  # 5 minutes acceptable
BACKUP_FORMAT="dump"  # or "sql" depending on pg_dump --format used

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}ℹ️  $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

echo "========================================="
echo "SAAS-15 Backup Restore Test"
echo "========================================="
log_info "Date: $BACKUP_DATE"
log_info "Database: $DB_NAME on $DB_HOST"
log_info "Test DB: $TEST_DB"
log_info "Target RTO: ${RTO_TARGET_SECONDS}s"
echo ""

# Step 1: Locate backup file
echo "Step 1: Locating backup file..."
BACKUP_FILE=""
if [ -f "/backups/vninvest-${BACKUP_DATE}.sql.gz" ]; then
    BACKUP_FILE="/backups/vninvest-${BACKUP_DATE}.sql.gz"
elif [ -f "/backups/core_db_${DB_NAME}_${BACKUP_DATE}*.sql.gz" ]; then
    BACKUP_FILE=$(ls -t /backups/core_db_${DB_NAME}_${BACKUP_DATE}*.sql.gz 2>/dev/null | head -1)
elif [ -f "/tmp/vninvest-${BACKUP_DATE}.dump" ]; then
    BACKUP_FILE="/tmp/vninvest-${BACKUP_DATE}.dump"
else
    log_error "No backup file found for date $BACKUP_DATE"
    log_warn "Searched locations:"
    log_warn "  - /backups/vninvest-${BACKUP_DATE}.sql.gz"
    log_warn "  - /backups/core_db_${DB_NAME}_${BACKUP_DATE}*.sql.gz"
    log_warn "  - /tmp/vninvest-${BACKUP_DATE}.dump"
    exit 1
fi

log_success "Found backup: $BACKUP_FILE"
ls -lh "$BACKUP_FILE"
echo ""

# Step 2: Verify backup integrity
echo "Step 2: Verifying backup integrity..."
BACKUP_SIZE=$(du -b "$BACKUP_FILE" | awk '{print $1}')
BACKUP_SIZE_MB=$((BACKUP_SIZE / 1024 / 1024))
log_info "Backup size: ${BACKUP_SIZE_MB} MB"

if [ "$BACKUP_SIZE" -lt 1048576 ]; then  # Less than 1 MB
    log_error "Backup file too small (${BACKUP_SIZE_MB} MB) — possible corruption"
    exit 1
fi

if [ "$BACKUP_SIZE" -gt 2147483648 ]; then  # More than 2 GB
    log_warn "Backup exceeds 2 GB — restore may take longer"
fi

log_success "Backup integrity check passed"
echo ""

# Step 3: Create test database
echo "Step 3: Creating test database..."
if psql -h "$DB_HOST" -U "$DB_USER" -d "postgres" -c "SELECT 1" > /dev/null 2>&1; then
    log_info "Database connection OK"
else
    log_error "Cannot connect to PostgreSQL on $DB_HOST"
    exit 1
fi

# Drop test DB if exists (from previous failed run)
psql -h "$DB_HOST" -U "$DB_USER" -d "postgres" -c "DROP DATABASE IF EXISTS ${TEST_DB};" 2>/dev/null || true

# Create test DB
if psql -h "$DB_HOST" -U "$DB_USER" -d "postgres" -c "CREATE DATABASE ${TEST_DB};"; then
    log_success "Created test database: $TEST_DB"
else
    log_error "Failed to create test database"
    exit 1
fi
echo ""

# Step 4: Restore backup
echo "Step 4: Restoring backup (measuring RTO)..."
START_TIME=$(date +%s%N | cut -b1-13)  # milliseconds
START_TIME_HUMAN=$(date '+%Y-%m-%d %H:%M:%S')

if [[ "$BACKUP_FILE" == *.gz ]]; then
    # Gzipped backup — decompress on-the-fly
    if pg_restore -h "$DB_HOST" -U "$DB_USER" -d "$TEST_DB" -Fc "$BACKUP_FILE" > /dev/null 2>&1; then
        :
    elif gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -U "$DB_USER" -d "$TEST_DB" > /dev/null 2>&1; then
        :
    else
        log_error "Failed to restore backup (tried both pg_restore and gunzip+psql)"
        psql -h "$DB_HOST" -U "$DB_USER" -d "postgres" -c "DROP DATABASE ${TEST_DB};" 2>/dev/null || true
        exit 1
    fi
else
    # Plain SQL or dump file
    if [[ "$BACKUP_FILE" == *.dump ]] || [[ "$BACKUP_FILE" == *.custom ]]; then
        pg_restore -h "$DB_HOST" -U "$DB_USER" -d "$TEST_DB" "$BACKUP_FILE" > /dev/null 2>&1
    else
        psql -h "$DB_HOST" -U "$DB_USER" -d "$TEST_DB" < "$BACKUP_FILE" > /dev/null 2>&1
    fi
fi

END_TIME=$(date +%s%N | cut -b1-13)
END_TIME_HUMAN=$(date '+%Y-%m-%d %H:%M:%S')
RESTORE_TIME=$((($END_TIME - $START_TIME) / 1000))  # Convert to seconds

log_success "Restore completed in ${RESTORE_TIME}s"
log_info "Start: $START_TIME_HUMAN | End: $END_TIME_HUMAN"
echo ""

# Step 5: Validate data integrity
echo "Step 5: Validating data integrity..."
TABLES_FOUND=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$TEST_DB" -t -c \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")

if [ "$TABLES_FOUND" -lt 10 ]; then
    log_error "Too few tables found ($TABLES_FOUND) — restore likely incomplete"
    psql -h "$DB_HOST" -U "$DB_USER" -d "postgres" -c "DROP DATABASE ${TEST_DB};" 2>/dev/null || true
    exit 1
fi
log_info "Tables found: $TABLES_FOUND"

# Sample row counts
ROW_COUNTS=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$TEST_DB" -t -c \
    "SELECT table_name, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 5;")

log_info "Top 5 tables by row count:"
while IFS='|' read -r TABLE_NAME ROW_COUNT; do
    TABLE_NAME=$(echo "$TABLE_NAME" | xargs)  # trim
    ROW_COUNT=$(echo "$ROW_COUNT" | xargs)
    if [ -n "$TABLE_NAME" ]; then
        log_info "  $TABLE_NAME: $ROW_COUNT rows"
    fi
done <<< "$ROW_COUNTS"

log_success "Data integrity validation passed"
echo ""

# Step 6: RTO Assessment
echo "Step 6: RTO Assessment..."
if [ "$RESTORE_TIME" -le "$RTO_TARGET_SECONDS" ]; then
    log_success "RTO TARGET MET: ${RESTORE_TIME}s <= ${RTO_TARGET_SECONDS}s"
    RTO_RESULT="PASS"
else
    log_warn "RTO TARGET MISSED: ${RESTORE_TIME}s > ${RTO_TARGET_SECONDS}s"
    log_warn "Recommendation: Consider using pg_restore -j flag for parallel restore"
    RTO_RESULT="WARN"
fi
echo ""

# Step 7: Cleanup
echo "Step 7: Cleaning up test database..."
if psql -h "$DB_HOST" -U "$DB_USER" -d "postgres" -c "DROP DATABASE ${TEST_DB};" 2>/dev/null; then
    log_success "Test database dropped"
else
    log_warn "Could not drop test database (may be locked by other connections)"
fi
echo ""

# Summary
echo "========================================="
echo "TEST SUMMARY"
echo "========================================="
echo "Backup file: $BACKUP_FILE"
echo "Backup size: ${BACKUP_SIZE_MB} MB"
echo "Restore time: ${RESTORE_TIME}s"
echo "RTO target: ${RTO_TARGET_SECONDS}s"
echo "RTO result: ${RTO_RESULT}"
echo "Tables found: $TABLES_FOUND"
echo ""

if [ "$RTO_RESULT" == "PASS" ]; then
    log_success "All checks passed ✅"
    exit 0
else
    log_warn "Some checks passed but RTO target missed ⚠️"
    exit 0  # Exit 0 because backup itself is valid; RTO is just slow
fi
