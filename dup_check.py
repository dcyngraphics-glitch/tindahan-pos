#!/usr/bin/env python3
import os, re, hashlib, itertools

base = r'C:\Users\bryan\Documents\Hermes\Projects\tindahan-pos\src'
files = []
for root, dirs, names in os.walk(base):
    dirs[:] = [d for d in dirs if d not in ('__tests__', 'node_modules', 'dist')]
    for n in names:
        if n.endswith(('.tsx', '.ts')):
            files.append(os.path.join(root, n))

def norm(s):
    s = re.sub(r'//.*', '', s)
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    s = re.sub(r'\s+', ' ', s)
    return s

def blocks_of(path):
    with open(path) as f:
        lines = f.read().splitlines()
    out = []
    cur = None
    for i, ln in enumerate(lines):
        m = re.match(r'^(?:export\s+)?(?:async\s+)?(?:function|class)\s+(\w+)', ln)
        if m:
            if cur: out.append(cur)
            cur = {'name': m.group(1), 'start': i, 'lines': [ln]}
        elif cur is not None:
            cur['lines'].append(ln)
    if cur: out.append(cur)
    return out

all_blocks = {}
for p in files:
    key = os.path.relpath(p, base)
    all_blocks[key] = blocks_of(p)

report = []
for a, b in itertools.combinations(sorted(all_blocks), 2):
    fa, fb = all_blocks[a], all_blocks[b]
    for x in fa:
        for y in fb:
            if x['name'] != y['name']:
                continue
            if len(x['lines']) < 5 or len(y['lines']) < 5:
                continue
            sa = norm(' '.join(x['lines']))
            sb = norm(' '.join(y['lines']))
            common = len(set(sa.split()) & set(sb.split()))
            total = len(set(sa.split()) | set(sb.split()))
            jac = common / total if total else 0
            if jac > 0.75 and len(x['lines']) > 20:
                report.append((jac, a, x['name'], b, y['name'], len(x['lines']), len(y['lines'])))

report.sort(reverse=True)
print(f"Total files: {len(files)}")
print(f"Large duplicated blocks (>=20 lines, Jaccard>=0.75) between different files:")
for r in report:
    print(f"  J={r[0]:.2f}  {r[1]}:{r[2]}  <->  {r[3]}:{r[4]}  (lines {r[5]}x{r[6]})")
print(f"\nTotal matches: {len(report)}")
