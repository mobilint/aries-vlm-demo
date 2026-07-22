"""Run the demo's sample image+question cases against the live VLM server
and score answers for degeneration.

Usage:
    python run_eval.py --label baseline
    python run_eval.py --label cand1 --language ko --bundle <dir-with-system.txt>
"""

import argparse
import json
import pathlib
import statistics

from cases import build_cases
from harness import CHECK_KEYS, DEGENERATION_KEYS, VlmClient, check_answer, image_to_data_url

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parents[1]


def load_bundle(bundle_dir):
    system = (bundle_dir / "system.txt").read_text().strip()
    inter_path = bundle_dir / "inter.txt"
    inter = inter_path.read_text().strip() if inter_path.exists() else ""
    return system, inter


def summarize(results):
    ok = [r for r in results if not r.get("error")]
    failures = {k: sum(1 for r in ok if r["checks"][k]) for k in CHECK_KEYS}
    clean = sum(1 for r in ok if not any(r["checks"][k] for k in CHECK_KEYS))
    no_degen = sum(1 for r in ok if not any(r["checks"][k] for k in DEGENERATION_KEYS))
    lengths = sorted(r["checks"]["length"] for r in ok)
    tokens = sorted(r["token_count"] for r in ok)
    return {
        "cases": len(results),
        "errors": len(results) - len(ok),
        "clean": clean,
        "no_degeneration": no_degen,
        "length_min": lengths[0] if lengths else 0,
        "length_median": statistics.median(lengths) if lengths else 0,
        "length_max": lengths[-1] if lengths else 0,
        "tokens_max": tokens[-1] if tokens else 0,
        "decode_s_median": round(statistics.median(r["decode_s"] for r in ok), 2) if ok else 0,
        "failures": failures,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", required=True)
    parser.add_argument("--language", choices=["en", "ko", "ja", "zh"], default="en")
    parser.add_argument("--bundle", default=None, help="dir with system.txt/inter.txt (default: live en bundle)")
    parser.add_argument("--url", default="http://localhost:5000")
    args = parser.parse_args()

    bundle_dir = pathlib.Path(args.bundle) if args.bundle else (
        REPO / "frontend" / "public" / "prompt-bundles" / args.language
    )
    cases = build_cases(args.language)

    client = VlmClient(args.url)
    client.set_prompts(*load_bundle(bundle_dir))

    results = []
    try:
        for case in cases:
            try:
                r = client.ask(case["question"], image_to_data_url(case["path"]))
                r["checks"] = check_answer(r["text"], args.language, r["token_count"])
            except Exception as exc:
                r = {"error": str(exc)}
            r["case_id"] = case["case_id"]
            r["question"] = case["question"]
            results.append(r)
            if r.get("error"):
                print(f"{case['case_id']}: ERROR {r['error']}")
            else:
                c = r["checks"]
                flags = ",".join(k for k in CHECK_KEYS if c[k]) or "clean"
                print(f"{case['case_id']}: len={c['length']} tok={r['token_count']} {r['total_s']}s [{flags}]")
    finally:
        client.close()

    summary = summarize(results)
    out_dir = ROOT / "results"
    out_dir.mkdir(exist_ok=True)
    out_path = out_dir / f"{args.label}-{args.language}.json"
    out_path.write_text(json.dumps({
        "label": args.label, "language": args.language, "bundle": str(bundle_dir),
        "summary": summary, "results": results,
    }, indent=2, ensure_ascii=False))

    print(f"\n== {args.label} / {args.language} ==")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    print(f"saved {out_path}")


if __name__ == "__main__":
    main()
