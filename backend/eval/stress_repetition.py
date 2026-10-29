"""Repetition stress test: hammer the live VLM server with concurrent
sessions and an uncapped token budget to see whether runaway repetition
reproduces.

Writes a separate src/generation_config.stress.json with a raised
max_new_tokens; the shipped generation_config.json is never modified. The
server must be launched with VLM_GEN_CONFIG_OVERRIDE=generation_config.stress.json
for the override to take effect. Appends one JSON line per trial to
results/stress-<label>.jsonl.

Usage:
    python stress_repetition.py --label baseline --trials 100
"""

import argparse
import itertools
import json
import pathlib
import threading
import time

from cases import build_cases
from harness import (
    VlmClient,
    check_answer,
    has_runaway_repetition,
    image_to_data_url,
    near_duplicate_sentences,
)

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parents[1]
GEN_CONFIG = REPO / "backend" / "src" / "generation_config.json"
STRESS_CONFIG = REPO / "backend" / "src" / "generation_config.stress.json"


def load_bundle(language):
    bundle = REPO / "frontend" / "public" / "prompt-bundles" / language
    system = (bundle / "system.txt").read_text().strip()
    inter_path = bundle / "inter.txt"
    inter = inter_path.read_text().strip() if inter_path.exists() else ""
    return system, inter


def worker(worker_id, cases, trials, args, out_path, lock, stats):
    client = VlmClient(args.url)
    try:
        client.set_prompts(*load_bundle(args.language))
        case_cycle = itertools.cycle(cases)
        # stagger workers so they hit different cases
        for _ in range(worker_id):
            next(case_cycle)
        for trial in range(trials):
            case = next(case_cycle)
            record = {"worker": worker_id, "trial": trial, "case_id": case["case_id"]}
            try:
                result = client.ask(case["question"], image_to_data_url(case["path"]),
                                    timeout=args.ask_timeout)
                text = result["text"]
                record.update({
                    "tokens": result["token_count"],
                    "decode_s": result["decode_s"],
                    "flags": sorted(k for k, v in {
                        "repetition": has_runaway_repetition(text),
                        "near_dup": near_duplicate_sentences(text),
                        "token_runaway": result["token_count"] > args.token_limit,
                        "slow_decode": result["decode_s"] > args.decode_limit,
                    }.items() if v),
                    "text": text,
                })
            except TimeoutError:
                record.update({"flags": ["timeout"], "text": "".join(client._tokens)})
            with lock:
                with out_path.open("a") as f:
                    f.write(json.dumps(record, ensure_ascii=False) + "\n")
                stats["done"] += 1
                if record["flags"]:
                    stats["flagged"] += 1
                    print(f"[w{worker_id} t{trial}] FLAGS={record['flags']} "
                          f"tokens={record.get('tokens','?')} :: {record['text'][:80]!r}")
                if stats["done"] % 10 == 0:
                    print(f"progress: {stats['done']} trials, {stats['flagged']} flagged")
    finally:
        client.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", required=True)
    parser.add_argument("--language", choices=["en", "ko", "ja", "zh"], default="en")
    parser.add_argument("--url", default="http://localhost:5000")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--trials", type=int, default=100, help="total across all workers")
    parser.add_argument("--max-new-tokens", type=int, default=2048)
    parser.add_argument("--token-limit", type=int, default=400)
    parser.add_argument("--decode-limit", type=float, default=30.0)
    parser.add_argument("--ask-timeout", type=float, default=240.0)
    args = parser.parse_args()

    cases = build_cases(args.language)
    out_path = ROOT / "results" / f"stress-{args.label}.jsonl"
    out_path.parent.mkdir(exist_ok=True)
    out_path.write_text("")

    config = json.loads(GEN_CONFIG.read_text())
    original_cap = config.get("max_new_tokens")
    config["max_new_tokens"] = args.max_new_tokens
    STRESS_CONFIG.write_text(json.dumps(config, indent=2) + "\n")
    print(f"wrote {STRESS_CONFIG.name} with max_new_tokens {original_cap} -> {args.max_new_tokens}")
    print("server must be launched with VLM_GEN_CONFIG_OVERRIDE=generation_config.stress.json")

    lock = threading.Lock()
    stats = {"done": 0, "flagged": 0}
    per_worker = args.trials // args.workers
    started = time.monotonic()
    try:
        threads = [threading.Thread(target=worker,
                                    args=(i, cases, per_worker, args, out_path, lock, stats))
                   for i in range(args.workers)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
    finally:
        STRESS_CONFIG.unlink(missing_ok=True)

    records = [json.loads(line) for line in out_path.read_text().splitlines()]
    flagged = [r for r in records if r["flags"]]
    by_flag = {}
    for r in flagged:
        for f in r["flags"]:
            by_flag[f] = by_flag.get(f, 0) + 1
    tokens = sorted(r.get("tokens", 0) for r in records if "tokens" in r)
    print(f"\n== stress-{args.label} ({args.language}): {len(records)} trials in {time.monotonic()-started:.0f}s ==")
    print(f"flagged: {len(flagged)}/{len(records)}  by type: {by_flag or 'none'}")
    if tokens:
        print(f"tokens: min {tokens[0]} / median {tokens[len(tokens)//2]} / max {tokens[-1]}")
    print(f"details: {out_path}")


if __name__ == "__main__":
    main()
