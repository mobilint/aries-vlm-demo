# VLM Evaluation Harness (aries-vlm-demo)

Measures answer degeneration (runaway token repetition and friends) for the
chat demo against the **live** backend on :5000. Drives the Socket.IO server
exactly like the frontend — `prompt_config` → `ask` with a base64 image data
URL → token stream — and scores the streamed answer.

Ported from `aries-vision-vlm-demo/backend_vlm/eval`, adapted for this demo's
free-form input (sample image + question, no detection metadata).

## Setup

```bash
cd backend/eval
uv venv .venv
uv pip install --python .venv/bin/python "python-socketio[client]" requests
```

## Workflow

```bash
# quality: run the sample image+question catalog once, per language
.venv/bin/python run_eval.py --label baseline --language en
.venv/bin/python run_eval.py --label baseline --language ko

# repetition stress: N concurrent sessions, token cap lifted to expose the
# intermittent runaway that single sessions rarely surface.
# The harness writes a separate generation_config.stress.json; the shipped
# generation_config.json is never modified. Launch the server with the
# override env var so it picks up the stress config:
VLM_GEN_CONFIG_OVERRIDE=generation_config.stress.json python backend/src/server.py
# in another shell:
.venv/bin/python stress_repetition.py --label baseline --trials 100
```

Cases (`cases.py`) mirror the frontend sample-image catalog plus a few
open-ended stress prompts. Checks per answer fall in two groups:
- **degeneration** (hard failures): `repetition` (exact loops, word- and
  char-level, numbers normalized), `near_dup` (near-identical sentences),
  `token_runaway` (>400 tokens), `wrong_language`, `incomplete`, `empty`.
- **quality/balance**: `too_short` / `too_long` — a length band (en 10–80
  words, CJK 15–150 chars) that flags one-word terseness and rambling walls
  of text. `clean` = passes both groups; `no_degeneration` = passes the hard
  group only.

## Why the stress test matters

The single-pass quality eval is clean at every config (13/13) — runaway
repetition is intermittent and only surfaces under volume + concurrency.
That is exactly why a browser user hits it occasionally but a sequential
eval never does.

## Results (2026-07-16, Qwen2-VL-2B on NPU, 100 uncapped stress trials, en)

| config | stress flagged | max tokens | notes |
|---|---|---|---|
| baseline (temp 0.9, rep 1.1, no cap) | **47/100** | 2049 | 43 token-runaway, 17 repetition; some collapse to gibberish; 2312s |
| ngram (temp 0.5, rep 1.2, no_repeat_ngram 5) | 20/100 | 1023 | fewer, but failures are worse: `no_repeat_ngram` forces broken-token salad ("/on/on/on…"). ko quality 6/13 |
| **presence (rep 1.0, presence_penalty 1.5, temp 0.7)** | **6/100** | **223** | shipped. Only 1/100 is real repetition; other 5 are long-but-finite. No token runaway at all — every trial terminated naturally (cap never hit). 283s. ko 9/13 (best), en 13/13 |

Shipped `generation_config.json`: additive `presence_penalty 1.5` (custom
`PresencePenaltyLogitsProcessor` in `ImageTextToTextPipeline.py` — HF
`generate()` has no native one; unlike `repetition_penalty` it never
penalizes EOS, and unlike `no_repeat_ngram_size` it does not force broken
variants), `repetition_penalty 1.0`, temp 0.7 / top_p 0.8 / top_k 20, and
`max_new_tokens 512` as the mandatory blast-radius cap (the old code had only
`max_length 4096`, so a runaway ran for minutes). This is the Qwen model-card
recipe for suppressing repetition in quantized models.

## Length balance (2026-07-16, Qwen3-VL-2B default, 13 cases per language)

The shipped system prompts constrain answer length ("2–4 sentences, ~30–70
words / 60–120 chars", direct opening, no "Based on the image…" filler, one
example per question type). Effect:

Length targets are tuned per language (Korean/Japanese are shorter — the 2B
model rambles and occasionally degenerates when given a longer Korean
budget): en/zh "3–5 sentences, ~50–90 words / 70–130 chars", ko/ja "3–4
sentences, ~80–140 chars", direct opening, no lists for ko/ja.

| language | median length: original → tuned |
|---|---|
| en | 113 → 46 words |
| ko | 252 → 101 chars |
| ja | ~200 → ~90 chars |
| zh | ~150 → 77 chars |

The real demo cases (the four sample images with their catalog questions)
are clean across languages. The remaining `too_long`/degeneration hits are
the deliberately adversarial "describe in exhaustive detail" stress prompt,
which the 512-token cap bounds in production, plus occasional borderline
Korean answers — a model-level limit, not a prompt-target one.

## Known limitation (model-level, Qwen2-VL-2B)

This demo is Qwen2-VL-2B only. On this harder open-ended task the runaway
rate is much higher than for the sibling surveillance demo (baseline 47/100
vs 22/100), and when generation fails it tends to produce token-level
gibberish rather than clean repetition — a quantized-2B logit-quality issue
amplified under concurrency. The presence recipe minimizes the rate and the
512 cap bounds the damage, but the ceiling is the model.

Non-English is weak regardless of config: Korean answers sometimes refuse
("죄송합니다, 이미지를 분석할 수 없습니다") or switch to English (both configs;
presence is the least bad at 9/13). Repetition suppression is solved as far
as a 2B model allows; answer quality outside English is model-bound and would
need a stronger model.
