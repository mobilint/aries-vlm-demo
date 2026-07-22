"""Evaluation cases = the demo's own sample images × example questions.

Mirrors frontend/app/questions/catalog.ts and settings.ts so the harness
exercises exactly what the demo shows. Extra "stress" questions (open-ended
prompts that invite long rambling answers) are added because runaway
repetition surfaces most on under-constrained generations.
"""

import pathlib

REPO = pathlib.Path(__file__).resolve().parents[2]
IMAGE_DIR = REPO / "frontend" / "public" / "images"

# image -> {lang: [questions]}. Demo questions from the frontend catalog,
# plus open-ended stress prompts (key "*_stress") that maximize length.
QUESTIONS = {
    "people.jpg": {
        "en": ["Describe the image.", "How many people are visible in the image?"],
        "ko": ["이미지를 설명해줘.", "이미지에 사람이 몇 명 보이나요?"],
        "ja": ["画像を説明してください。", "画像には何人の人が写っていますか？"],
        "zh": ["请描述这张图片。", "图片中能看到多少人？"],
    },
    "crossroad.jpg": {
        "en": ["Describe what is happening in this street scene.",
               "What kinds of vehicles and road conditions do you see?"],
        "ko": ["이 거리 장면에서 무슨 일이 일어나고 있는지 설명해줘.", "어떤 차량들과 도로 상황이 보이나요?"],
        "ja": ["この街の場面で何が起きているか説明してください。", "どんな車両や路面状況が見えますか？"],
        "zh": ["请描述这个街景中正在发生的事情。", "你看到哪些车辆和路况？"],
    },
    "ai_suspicious.png": {
        "en": ["Describe the scene and the people in it.",
               "Is there anything that looks suspicious or unusual in this image?"],
        "ko": ["장면과 그 안의 사람들을 설명해줘.", "이 이미지에서 수상하거나 이상해 보이는 점이 있나요?"],
        "ja": ["場面とそこにいる人々を説明してください。", "この画像に不審または異常に見えるものはありますか？"],
        "zh": ["请描述场景和其中的人物。", "这张图片中有什么可疑或异常的地方吗？"],
    },
    "ai_fire.png": {
        "en": ["Describe the fire scene in the image.", "What signs suggest this scene is dangerous?"],
        "ko": ["이미지 속 화재 장면을 설명해줘.", "이 장면이 위험하다고 볼 수 있는 징후는 무엇인가요?"],
        "ja": ["画像の火災の場面を説明してください。", "この場面が危険だと示す兆候は何ですか？"],
        "zh": ["请描述图片中的火灾场景。", "有哪些迹象表明这个场景是危险的？"],
    },
    # additional sample images shipped with the demo, open-ended prompts
    "city.jpg": {"en": ["Describe this scene in detail, including everything you notice."]},
    "earth.jpg": {"en": ["Explain what this image shows and everything you can infer from it."]},
    "fish.jpg": {"en": ["Describe everything visible in this underwater scene in detail."]},
    "flowers.png": {"en": ["Describe the image in as much detail as you can."]},
    "crossroad.jpg#stress": {"en": ["Describe this street scene in exhaustive detail, listing every object, person, vehicle, sign, and condition you can identify."]},
}


def build_cases(language="en"):
    cases = []
    for key, langs in QUESTIONS.items():
        image = key.split("#")[0]
        path = IMAGE_DIR / image
        if not path.exists():
            continue
        questions = langs.get(language) or langs.get("en") or []
        for i, q in enumerate(questions):
            cases.append({"image": image, "path": str(path), "question": q, "case_id": f"{key}:{i}"})
    return cases
