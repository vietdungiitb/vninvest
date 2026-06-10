import os

def count_lines(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            return sum(1 for _ in f)
    except Exception:
        return 0

def scan_dir(directory, min_lines=400):
    results = []
    for root, dirs, files in os.walk(directory):
        # Prune large directories in-place
        dirs[:] = [d for d in dirs if d not in ['.git', 'node_modules', '.pytest_cache', '__pycache__', 'migrations', 'dist', 'build', '.venv', '.gemini', '.copilot']]
        for file in files:
            ext = os.path.splitext(file)[1]
            if ext in ['.py', '.js', '.jsx', '.ts', '.tsx', '.css', '.html']:
                filepath = os.path.join(root, file)
                lines = count_lines(filepath)
                if lines >= min_lines:
                    relative_path = os.path.relpath(filepath, 'c:\\Mujoco Projects\\vninvest')
                    results.append((relative_path, lines))
    return sorted(results, key=lambda x: x[1], reverse=True)

if __name__ == '__main__':
    print("Scanning packages/core...")
    core_files = scan_dir('c:\\Mujoco Projects\\vninvest\\packages\\core')
    for path, lines in core_files:
        print(f"{path}: {lines} lines")
        
    print("\nScanning packages/web...")
    web_files = scan_dir('c:\\Mujoco Projects\\vninvest\\packages\\web')
    for path, lines in web_files:
        print(f"{path}: {lines} lines")
