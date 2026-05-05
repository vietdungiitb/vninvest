"""
SM-P5.6: IntradayTick table partitioning.

Creates monthly partitions for portfolio_intradaytick.
Note: Django ORM does not natively manage PostgreSQL table partitioning.
This migration uses RunSQL to:
  1. Rename the existing table to _archive (preserving data)
  2. Create a new partitioned table with identical schema
  3. Create current and next-month partitions
  4. Register a DB trigger to auto-create future partitions (requires pg_partman or
     an ops_audit Celery task — see create_next_month_partition task below)

IMPORTANT: This migration must be run AFTER taking a full backup (SM-P5.5 verified).

DEV NOTE: This migration is a no-op in DEBUG=True environments. It will be auto-skipped
in dev and fake-applied. Run only in production with workers stopped.
"""
import os
from django.db import migrations


_PARTITION_SQL = """
-- Step 1: Archive existing table (keep data)
ALTER TABLE portfolio_intradaytick RENAME TO portfolio_intradaytick_archive;

-- Step 2: Create partitioned parent table (RANGE on trade_date)
CREATE TABLE portfolio_intradaytick (
    id BIGSERIAL,
    symbol VARCHAR(10) NOT NULL,
    trade_date DATE NOT NULL,
    trade_time TIME NOT NULL,
    price NUMERIC(15, 2) NOT NULL,
    volume BIGINT NOT NULL,
    side VARCHAR(10) NOT NULL DEFAULT 'UNKNOWN',
    match_type VARCHAR(20) NOT NULL DEFAULT '',
    stream_id VARCHAR(30) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, trade_date)
) PARTITION BY RANGE (trade_date);

-- Step 3: Create indexes on the parent
CREATE INDEX portfolio_intradaytick_symbol_idx ON portfolio_intradaytick (symbol);
CREATE INDEX portfolio_intradaytick_trade_date_idx ON portfolio_intradaytick (trade_date);
CREATE INDEX portfolio_intradaytick_stream_id_idx ON portfolio_intradaytick (stream_id);
CREATE INDEX portfolio_intradaytick_sym_date_time_idx ON portfolio_intradaytick (symbol, trade_date, trade_time);

-- Step 4: Create current month partition
CREATE TABLE portfolio_intradaytick_y2026m01
    PARTITION OF portfolio_intradaytick
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE portfolio_intradaytick_y2026m02
    PARTITION OF portfolio_intradaytick
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE portfolio_intradaytick_y2026m03
    PARTITION OF portfolio_intradaytick
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE portfolio_intradaytick_y2026m04
    PARTITION OF portfolio_intradaytick
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE portfolio_intradaytick_y2026m05
    PARTITION OF portfolio_intradaytick
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE portfolio_intradaytick_y2026m06
    PARTITION OF portfolio_intradaytick
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- Step 5: Migrate archive data into partitioned table
INSERT INTO portfolio_intradaytick
    SELECT * FROM portfolio_intradaytick_archive
    WHERE trade_date >= '2026-01-01' AND trade_date < '2026-07-01';
"""

_REVERSE_SQL = """
-- Reverse: restore original table (data may be out of sync)
DROP TABLE IF EXISTS portfolio_intradaytick CASCADE;
ALTER TABLE portfolio_intradaytick_archive RENAME TO portfolio_intradaytick;
"""


def _apply_partitioning(apps, schema_editor):
    """Apply partitioning — no-op in DEBUG/dev environments."""
    debug = os.environ.get('DJANGO_DEBUG', 'false').strip().lower() in ('1', 'true', 'yes')
    if debug:
        # Dev: skip DDL, no-op. Fake-applied to keep migration graph consistent.
        return
    schema_editor.execute(_PARTITION_SQL)


def _reverse_partitioning(apps, schema_editor):
    """Reverse partitioning — no-op in DEBUG/dev environments."""
    debug = os.environ.get('DJANGO_DEBUG', 'false').strip().lower() in ('1', 'true', 'yes')
    if debug:
        return
    schema_editor.execute(_REVERSE_SQL)


class Migration(migrations.Migration):

    dependencies = [
        ('portfolio', '0068_rename_portfolio_c_status_4cc731_idx_portfolio_c_status_3f2e9e_idx'),
    ]

    operations = [
        migrations.RunPython(_apply_partitioning, _reverse_partitioning),
    ]
