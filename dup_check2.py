#!/usr/bin/env python3
import os, re, itertools

base = r'C:\Users\bryan\Documents\Hermes\Projects\tindahan-pos\src'
files = []
for root, dirs, names in os.walk(base):
    dirs[:] = [d for d in dirs if d not in ('__tests__', 'node_modules', 'dist')]
    for n in names:
        if n.endswith(('.tsx', '.ts')):
            files.append(os.path.join(root, n))

def norm_lines(lines):
    out = []
    for ln in lines:
        ln = re.sub(r'//.*', '', ln)
        ln = re.sub(r'/\*.*?\*/', '', ln, flags=re.S)
        ln = re.sub(r'\s+', ' ', ln).strip()
        if ln:
            out.append(ln)
    return out

# Index all normalized lines with file+line numbers
index = []  # (file, line_no, normalized_line)
for p in files:
    with open(p) as f:
        lines = f.read().splitlines()
    for i, ln in enumerate(norm_lines(lines), 1):
        index.append((p, i, ln))

# Find longest common subsequences of consecutive lines between file pairs
def find_dup(a, b, min_len=30):
    # Build dict of line -> positions in file a
    # Use rolling approach: find consecutive runs
    seen = {}
    best_run = []
    for pa, la, ln in index:
        if pa == a:
            seen[la] = ln
    pos_a = {}
    for pa, la, ln in index:
        if pa == a:
            pos_a[ln] = pos_a.get(ln, []) + [la]
        elif pa == b:
            pass
    # Simpler: for each line in b, find consecutive run in a
    best = []
    b_lines = [ln for _, _, ln in index if _[0] == b]
    # Build mapping from line to set of line numbers in a
    a_positions = {}
    for pa, la, ln in index:
        if pa == a:
            a_positions.setdefault(ln, []).append(la)
    for ln in b_lines:
        pass
    # We'll just compute the longest common contiguous subsequence via hash
    # Use k=64 rolling hash of strings
    import hashlib
    def h(line):
        return hashlib.md5(line.encode()).hexdigest()
    # Map each line to hash in both files
    a_hashes = []
    for pa, la, ln in index:
        if pa == a:
            a_hashes.append((la, h(ln)))
    b_hashes = [(la, h(ln)) for pa, la, ln in index if pa == b]
    # Find longest common consecutive run
    best_run = []
    # dp
    # map hash to line numbers in a
    a_pos_by_hash = {}
    for la, hh in a_hashes:
        a_pos_by_hash.setdefault(hh, set()).add(la)
    # Now compute longest common substring of hashes
    # Use a small DP
    # For efficiency, we just look for runs
    b_by_hash = {}
    for la, hh in b_hashes:
        b_by_hash.setdefault(hh, set()).add(la)
    # Find consecutive runs
    # Build for a: sorted list of line numbers per hash
    a_sorted = {hh: sorted(ls) for hh, ls in a_pos_by_hash.items()}
    best_hash = None
    best_len = 0
    # Try each hash in b
    for hh, bls in b_by_hash.items():
        als = a_sorted.get(hh, [])
        if len(als) < min_len:
            continue
        # For each position in a, look forward for consecutive run in a matching b
        # We only need to find at least min_len consecutive in a and same count in b
        # Simple: check if there's a run of length >= min_len in both
        # a run: consecutive line numbers with same hash
        best_a_run = 0
        for pos in als:
            run = 1
            while pos + run <= max(als) and (pos + run) in als:
                run += 1
            best_a_run = max(best_a_run, run)
        # b run
        best_b_run = 0
        for pos in bls:
            run = 1
            while pos + run <= max(bls) and (pos + run) in bls:
                run += 1
            best_b_run = max(best_b_run, run)
        if best_a_run >= min_len and best_b_run >= min_len and best_a_run == best_b_run:
            if best_a_run > best_len:
                best_len = best_a_run
                best_hash = hh
    if best_hash:
        # Extract the lines
        a_line_nums = sorted(a_pos_by_hash[best_hash])
        a_lines = [ln for pa, la, ln in index if pa == a and la in a_line_nums]
        b_line_nums = sorted(b_pos_by_hash.get(best_hash, []))
        b_lines = [ln for pa, la, ln in index if pa == b and la in b_line_nums]
        return a_lines, b_lines
    return None

# Compare each pair
files_sorted = sorted(files)
print(f"Total source files: {len(files_sorted)}\n")
found = []
for a, b in itertools.combinations(files_sorted, 2):
    res = find_dup(a, b, min_len=30)
    if res:
        a_lines, b_lines = res
        print(f"\n=== Duplicate between {os.path.basename(a)} and {os.path.basename(b)} (length {len(a_lines)} lines) ===")
        print(f"--- {os.path.basename(a)} (lines {a_lines[0].splitlines()[0][:60] if a_lines else ''}) ---")
        print(f"--- {os.path.basename(b)} (lines {b_lines[0].splitlines()[0][:60] if b_lines else ''}) ---")
        # print first 15 lines of each
        for al, bl in zip(a_lines[:15], b_lines[:15]):
            print(f"  A: {al[:80]}")
            print(f"  B: {bl[:80]}")
        print("  ...")
        found.append((a, b, len(a_lines)))

print(f"\nTotal duplicate blocks found: {len(found)}")
