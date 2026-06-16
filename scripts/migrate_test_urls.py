#!/usr/bin/env python3
"""
Script migrate test URLs từ `/api/...` sang `/core/v1/...` cho VNInvest Core API.

Usage:
    python scripts/migrate_test_urls.py --dry-run          # Xem trước thay đổi
    python scripts/migrate_test_urls.py --apply            # Thực hiện ghi file
    python scripts/migrate_test_urls.py --apply --backup   # Ghi file + tạo backup .bak
"""

import re
import sys
import argparse
from pathlib import Path
from typing import List, Tuple, Dict

# ============================================================
# CẤU HÌNH MIGRATION PATTERNS
# ============================================================
# Mỗi pattern: (regex_pattern, replacement, description)
# Sử dụng named groups để giữ nguyên phần path sau prefix
MIGRATION_PATTERNS: List[Tuple[str, str, str]] = [
    # 1. Standard API mounts: /api/market/... -> /core/v1/market/...
    (
        r'(["\'])/?api/(market|signals|workspace|commercial|advertising|ops-audit|support|identity|auth|tenant|billing|subscription|invoice|sso)/?',
        r'\1/core/v1/\2/',
        "Standard API module mounts"
    ),
    # 2. Versioned API: /api/v1/... -> /core/v1/... (giữ nguyên path sau v1)
    (
        r'(["\'])/?api/v1/(market|signals|workspace|commercial|advertising|ops-audit|support|identity|auth|tenant|billing|subscription|invoice|sso)/?',
        r'\1/core/v1/\2/',
        "Versioned API v1 mounts"
    ),
    # 3. DRF reverse() calls: reverse('api:market:...') -> reverse('core:v1:market:...')
    # Lưu ý: namespace thường là 'api' hoặc 'api:v1'
    (
        r"reverse\((['\"])api(:v1)?(:)",
        r"reverse(\1core:v1\3",
        "DRF reverse() namespace migration"
    ),
    # 4. Hardcoded URL trong f-string / format: f"/api/market/{id}/" -> f"/core/v1/market/{id}/"
    # Pattern này đã được cover bởi pattern 1 nhờ quote group.
    # 5. Client.get/post/put/delete calls với URL string: client.get("/api/market/...")
    # Pattern 1 đã cover.
]

# File extensions to process
TARGET_EXTENSIONS = {'.py'}

# Directories to skip
SKIP_DIRS = {'__pycache__', '.git', '.venv', 'venv', 'env', 'migrations', 'node_modules', 'dist', 'build'}

# ============================================================
# CORE LOGIC
# ============================================================

def find_test_files(root: Path) -> List[Path]:
    """Tìm tất cả file test Python trong thư mục backend/tests."""
    test_files = []
    for ext in TARGET_EXTENSIONS:
        for file in root.rglob(f'test_*{ext}'):
            if not any(skip in file.parts for skip in SKIP_DIRS):
                test_files.append(file)
        # Cũng bắt file *_test.py
        for file in root.rglob(f'*_test{ext}'):
            if not any(skip in file.parts for skip in SKIP_DIRS):
                test_files.append(file)
    return sorted(set(test_files))


def apply_patterns(content: str) -> Tuple[str, Dict[str, int]]:
    """Áp dụng tất cả migration patterns, trả về content mới và stats."""
    stats = {desc: 0 for _, _, desc in MIGRATION_PATTERNS}
    new_content = content
    
    for pattern, repl, desc in MIGRATION_PATTERNS:
        # Count matches before replacement
        matches = len(re.findall(pattern, new_content))
        if matches > 0:
            new_content = re.sub(pattern, repl, new_content)
            stats[desc] = matches
    
    return new_content, stats


def process_file(filepath: Path, dry_run: bool, backup: bool) -> Dict:
    """Xử lý một file, trả về dict kết quả."""
    try:
        original = filepath.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        return {'file': str(filepath), 'status': 'SKIP', 'reason': 'Binary/Encoding error'}
    
    new_content, stats = apply_patterns(original)
    total_changes = sum(stats.values())
    
    if total_changes == 0:
        return {'file': str(filepath), 'status': 'OK', 'changes': 0, 'details': stats}
    
    if dry_run:
        return {'file': str(filepath), 'status': 'WOULD_CHANGE', 'changes': total_changes, 'details': stats}
    
    # Backup
    if backup:
        backup_path = filepath.with_suffix(filepath.suffix + '.bak')
        backup_path.write_text(original, encoding='utf-8')
    
    # Write
    try:
        filepath.write_text(new_content, encoding='utf-8')
        return {'file': str(filepath), 'status': 'CHANGED', 'changes': total_changes, 'details': stats, 'backup': backup}
    except Exception as e:
        return {'file': str(filepath), 'status': 'ERROR', 'reason': str(e)}


def main():
    parser = argparse.ArgumentParser(description='Migrate test URLs from /api/ to /core/v1/')
    parser.add_argument('--root', type=Path, default=Path('packages/core/backend'), help='Root directory to scan')
    parser.add_argument('--dry-run', action='store_true', help='Show changes without writing')
    parser.add_argument('--apply', action='store_true', help='Apply changes (required to write)')
    parser.add_argument('--backup', action='store_true', help='Create .bak backup files')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    args = parser.parse_args()
    
    if not args.dry_run and not args.apply:
        parser.error('Must specify either --dry-run or --apply')
    
    print(f"🔍 Scanning for test files in: {args.root.resolve()}")
    test_files = find_test_files(args.root)
    print(f"📁 Found {len(test_files)} test files")
    
    if not test_files:
        print("⚠️  No test files found. Check --root path.")
        return 0
    
    results = []
    total_changes = 0
    files_changed = 0
    
    for f in test_files:
        result = process_file(f, args.dry_run, args.backup)
        results.append(result)
        total_changes += result.get('changes', 0)
        if result['status'] in ('CHANGED', 'WOULD_CHANGE'):
            files_changed += 1
            if args.verbose or args.dry_run:
                print(f"  📝 {result['file']}: {result['changes']} changes {result['details']}")
        elif args.verbose and result['status'] == 'OK':
            print(f"  ✅ {result['file']}: No changes needed")
        elif result['status'] == 'ERROR':
            print(f"  ❌ {result['file']}: {result['reason']}")
    
    # Summary
    action = "WOULD BE" if args.dry_run else "APPLIED"
    print(f"\n📊 SUMMARY ({action}):")
    print(f"   Files processed: {len(test_files)}")
    print(f"   Files with changes: {files_changed}")
    print(f"   Total pattern replacements: {total_changes}")
    
    if args.dry_run:
        print("\n💡 Run with --apply to execute changes. Add --backup to create .bak files.")
    
    return 0 if all(r['status'] != 'ERROR' for r in results) else 1


if __name__ == '__main__':
    sys.exit(main())