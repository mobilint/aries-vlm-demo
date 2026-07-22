"""Shared helpers for the VLM evaluation harness (aries-vlm-demo).

This demo is a free-form chat: the user picks a sample image and asks a
question. The harness drives the live backend_vlm Socket.IO server exactly
like the frontend (prompt_config → ask with a base64 image data URL →
token stream), then scores the answer for degeneration.

The primary goal here is suppressing runaway token repetition, so the
checks center on that (exact loops, near-duplicate sentences, token
runaway, slow decode) plus basic sanity (empty, incomplete,
wrong-language). There is no fixed answer-length band: "describe the
image" and "how many people?" have very different natural lengths, so
length is reported, not graded.
"""

import base64
import difflib
import mimetypes
import re
import time

import socketio


def image_to_data_url(path):
    mime = mimetypes.guess_type(path)[0] or "image/jpeg"
    with open(path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode()
    return f"data:{mime};base64,{encoded}"


# ---- degeneration detection (ported from aries-vision-vlm-demo) ----

_PUNCT = str.maketrans("", "", ".,:;!?\"'()[]“”")
_DIGIT = re.compile(r"\d")


def _normalize_tokens(text):
    tokens = []
    for raw in text.split():
        token = raw.translate(_PUNCT).lower()
        if not token:
            continue
        tokens.append("<num>" if _DIGIT.search(token) else token)
    return tokens


def has_runaway_repetition(text, ngram=4, max_total=3, max_consecutive=3):
    """Exact-loop detector: same normalized n-gram >max_total times
    anywhere (numbers normalized so 'confidence 0.97 ... confidence 0.95'
    loops still match), or any 1-4 word unit repeated max_consecutive+
    times back to back ('falling falling falling'), plus a character-level
    pass for unspaced CJK."""
    tokens = _normalize_tokens(text)

    counts = {}
    for i in range(max(0, len(tokens) - ngram + 1)):
        key = tuple(tokens[i:i + ngram])
        counts[key] = counts.get(key, 0) + 1
        if counts[key] > max_total:
            return True

    for n in range(1, 5):
        for i in range(len(tokens) - n):
            unit = tokens[i:i + n]
            count = 1
            j = i + n
            while tokens[j:j + n] == unit:
                count += 1
                if count >= max_consecutive:
                    return True
                j += n

    condensed = _DIGIT.sub("0", re.sub(r"\s+", "", text))
    if re.search(r"(.{6,30})\1{2}", condensed):
        return True
    return False


SENTENCE_SPLIT = re.compile(r"(?<=[.!?。！？])\s+|\n+")


def near_duplicate_sentences(text, similarity=0.85, min_len=15, min_count=3):
    """'Almost the same sentence, a few chars differ' loops."""
    sentences = [s.strip() for s in SENTENCE_SPLIT.split(text) if len(s.strip()) >= min_len]
    for i, base in enumerate(sentences):
        similar = 1
        for other in sentences[i + 1:]:
            if difflib.SequenceMatcher(None, base, other).ratio() >= similarity:
                similar += 1
                if similar >= min_count:
                    return True
    return False


_HANGUL = re.compile(r"[가-힣]")
_KANA = re.compile(r"[ぁ-んァ-ヶ]")
_HAN = re.compile(r"[一-鿿]")
CJK_LANGUAGES = ("ko", "ja", "zh")
SENTENCE_ENDINGS = (".", "!", "?", '"', "”", ")", "。", "！", "？", "」", "』")


def is_wrong_language(text, language):
    if language == "ko":
        return not _HANGUL.search(text)
    if language == "ja":
        return not _KANA.search(text)
    if language == "zh":
        return not _HAN.search(text) or bool(_KANA.search(text)) or bool(_HANGUL.search(text))
    return bool(_HANGUL.search(text) or _KANA.search(text) or _HAN.search(text))


def check_answer(text, language="en", token_count=None, token_runaway=400,
                 min_words=10, max_words=100, min_chars=15, max_chars=200):
    """Score one answer. Length is graded to keep answers balanced — not
    one-word terse, not a rambling wall of text. For CJK languages length is
    measured in non-whitespace characters instead of words."""
    stripped = text.strip()
    words = len(text.split())
    if language in CJK_LANGUAGES:
        length = len(re.sub(r"\s+", "", stripped))
        too_short, too_long = length < min_chars, length > max_chars
    else:
        length = words
        too_short, too_long = words < min_words, words > max_words
    return {
        "length": length,
        "repetition": has_runaway_repetition(text),
        "near_dup": near_duplicate_sentences(text),
        "token_runaway": token_count is not None and token_count > token_runaway,
        "wrong_language": is_wrong_language(text, language),
        "incomplete": bool(stripped) and not stripped.endswith(SENTENCE_ENDINGS),
        "empty": len(stripped) == 0,
        "too_short": too_short,
        "too_long": too_long,
    }


# Degeneration = hard failures (never acceptable). Length flags are graded
# separately as quality (balance), not degeneration.
DEGENERATION_KEYS = ("repetition", "near_dup", "token_runaway", "wrong_language", "incomplete", "empty")
QUALITY_KEYS = ("too_short", "too_long")
CHECK_KEYS = DEGENERATION_KEYS + QUALITY_KEYS


class VlmClient:
    """Socket.IO client mirroring the frontend ask flow."""

    def __init__(self, url="http://localhost:5000", connect_timeout=30):
        self.sio = socketio.Client()
        self._prompt_ready = False
        self._tokens = []
        self._first_token_at = None
        self._ended = None

        @self.sio.on("prompt_config_state")
        def on_prompt_config_state(payload):
            self._prompt_ready = bool(payload.get("is_ready"))

        @self.sio.on("token")
        def on_token(token):
            if self._first_token_at is None:
                self._first_token_at = time.monotonic()
            self._tokens.append(token)

        @self.sio.on("end")
        def on_end(is_aborted):
            self._ended = bool(is_aborted)

        self.sio.connect(url, wait_timeout=connect_timeout)

    def set_prompts(self, system_prompt, inter_prompt="", timeout=60):
        self._prompt_ready = False
        self.sio.emit("prompt_config", {"system_prompt": system_prompt, "inter_prompt": inter_prompt})
        deadline = time.monotonic() + timeout
        while not self._prompt_ready:
            if time.monotonic() > deadline:
                raise TimeoutError("prompt_config was not acknowledged in time")
            time.sleep(0.05)

    def ask(self, question, image_data_url, timeout=240):
        self.sio.emit("reset")
        time.sleep(0.2)
        self._tokens = []
        self._first_token_at = None
        self._ended = None

        started = time.monotonic()
        self.sio.emit("ask", (question, image_data_url))
        deadline = started + timeout
        while self._ended is None:
            if time.monotonic() > deadline:
                raise TimeoutError("generation did not finish in time")
            time.sleep(0.05)
        finished = time.monotonic()

        first = self._first_token_at or finished
        return {
            "text": "".join(self._tokens),
            "aborted": self._ended,
            "token_count": len(self._tokens),
            "ttft_s": round(first - started, 3),
            "decode_s": round(finished - first, 3),
            "total_s": round(finished - started, 3),
        }

    def close(self):
        self.sio.disconnect()
