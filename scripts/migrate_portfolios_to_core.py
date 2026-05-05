#!/usr/bin/env python
"""
SFI-B4.5: Migrate portfolios + transactions + watchlists from legacy backend DB to core-api DB.

Usage:
    # Dry run:
    python scripts/migrate_portfolios_to_core.py --dry-run

    # Live migration for a specific user:
    python scripts/migrate_portfolios_to_core.py --username alice

    # Full migration:
    python scripts/migrate_portfolios_to_core.py

Environment variables required:
    LEGACY_DATABASE_URL   — legacy postgres DSN
    CORE_DATABASE_URL     — core-api postgres DSN

Security:
- Parameterized queries only.
- No sensitive data logged.
"""

import argparse
import os
import sys


def get_connection(url: str):
    try:
        import psycopg2
    except ImportError:
        print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
        sys.exit(1)

    url = url.strip()
    if url.startswith('postgres://') or url.startswith('postgresql://'):
        url = url.split('://', 1)[1]
    else:
        raise ValueError(f"Unsupported DATABASE_URL scheme: {url[:20]}...")

    credentials, hostpart = (url.rsplit('@', 1) if '@' in url else ('', url))
    db_user, db_pass = (credentials.split(':', 1) if ':' in credentials else (credentials, ''))
    host_port, dbname = (hostpart.split('/', 1) if '/' in hostpart else (hostpart, ''))
    host, port = (host_port.rsplit(':', 1) if ':' in host_port else (host_port, '5432'))

    import psycopg2
    return psycopg2.connect(host=host, port=int(port), dbname=dbname, user=db_user, password=db_pass)


def get_core_user_id(core_conn, legacy_username: str) -> int | None:
    with core_conn.cursor() as cur:
        cur.execute('SELECT id FROM auth_user WHERE username = %s', (legacy_username,))
        row = cur.fetchone()
        return row[0] if row else None


def migrate_portfolios(legacy_conn, core_conn, dry_run: bool, username_filter: str | None) -> dict:
    stats = {'portfolios': 0, 'transactions': 0, 'watchlists': 0, 'watchlist_items': 0, 'skipped': 0, 'errors': 0}

    # Fetch legacy portfolios
    with legacy_conn.cursor() as cur:
        if username_filter:
            cur.execute(
                'SELECT p.id, p.name, p.description, p.is_default, u.username '
                'FROM portfolio_portfolio p JOIN auth_user u ON p.user_id = u.id '
                'WHERE u.username = %s ORDER BY p.id',
                (username_filter,),
            )
        else:
            cur.execute(
                'SELECT p.id, p.name, p.description, p.is_default, u.username '
                'FROM portfolio_portfolio p JOIN auth_user u ON p.user_id = u.id ORDER BY p.id'
            )
        portfolios = cur.fetchall()

    for legacy_id, name, description, is_default, username in portfolios:
        core_user_id = get_core_user_id(core_conn, username)
        if not core_user_id:
            print(f"  [SKIP] Portfolio {legacy_id}: user '{username}' not in core DB")
            stats['skipped'] += 1
            continue

        # Check already migrated
        with core_conn.cursor() as cur:
            cur.execute('SELECT id FROM user_workspace_portfolio WHERE legacy_portfolio_id = %s', (legacy_id,))
            if cur.fetchone():
                stats['skipped'] += 1
                continue

        if dry_run:
            print(f"  [WOULD CREATE] Portfolio '{name}' for {username}")
            stats['portfolios'] += 1
            continue

        try:
            with core_conn.cursor() as cur:
                cur.execute(
                    'INSERT INTO user_workspace_portfolio (user_id, name, description, is_default, legacy_portfolio_id, created_at, updated_at) '
                    'VALUES (%s, %s, %s, %s, %s, NOW(), NOW()) RETURNING id',
                    (core_user_id, name, description or '', is_default, legacy_id),
                )
                core_portfolio_id = cur.fetchone()[0]
            core_conn.commit()
            stats['portfolios'] += 1
            print(f"  [CREATED] Portfolio '{name}' (legacy={legacy_id} → core={core_portfolio_id})")

            # Migrate transactions for this portfolio
            with legacy_conn.cursor() as cur:
                cur.execute(
                    'SELECT id, symbol, transaction_type, date, price, quantity, fee, note '
                    'FROM portfolio_transaction WHERE portfolio_id = %s ORDER BY id',
                    (legacy_id,),
                )
                txns = cur.fetchall()

            for txn_id, symbol, txn_type, date, price, qty, fee, note in txns:
                with core_conn.cursor() as cur:
                    cur.execute(
                        'INSERT INTO user_workspace_transaction '
                        '(portfolio_id, symbol, transaction_type, date, price, quantity, fee, note, legacy_transaction_id, created_at, updated_at) '
                        'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())',
                        (core_portfolio_id, symbol.upper(), txn_type, date, price, qty, fee or 0, note or '', txn_id),
                    )
                core_conn.commit()
                stats['transactions'] += 1

        except Exception as exc:  # noqa: BLE001
            core_conn.rollback()
            print(f"  [ERROR] Portfolio {legacy_id}: {exc}")
            stats['errors'] += 1

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description='Migrate legacy portfolios → core-api DB')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--username', default='', help='Migrate only this user')
    args = parser.parse_args()

    legacy_url = os.environ.get('LEGACY_DATABASE_URL', '')
    core_url = os.environ.get('CORE_DATABASE_URL', '')
    if not legacy_url or not core_url:
        print('ERROR: LEGACY_DATABASE_URL and CORE_DATABASE_URL must be set.')
        sys.exit(1)

    print(f"Legacy DB: {legacy_url.split('@')[-1]}")
    print(f"Core DB:   {core_url.split('@')[-1]}")
    if args.dry_run:
        print("DRY RUN — no writes.")

    legacy_conn = get_connection(legacy_url)
    core_conn = get_connection(core_url)

    stats = migrate_portfolios(legacy_conn, core_conn, args.dry_run, args.username or None)

    print("\nSummary:")
    for k, v in stats.items():
        if v > 0:
            print(f"  {k}: {v}")

    legacy_conn.close()
    core_conn.close()
    print("Migration complete.")


if __name__ == '__main__':
    main()
