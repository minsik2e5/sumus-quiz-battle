#!/usr/bin/env python3
"""Extract the six selected Incheon vocabulary sections from the supplied PDF.

This is a deterministic coordinate-based extractor. It does not translate,
normalize meanings, or consult an external dictionary.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

import pdfplumber


SECTIONS = (
    ("31번", 9, 27),
    ("34번", 11, 51),
    ("36번", 13, 48),
    ("38번", 14, 22),
    ("40번", 15, 30),
    ("43~45번", 17, 36),
)

REPRESENTATIVES = {
    "31번": ("content", "만족하는"),
    "34번": ("journalist", "언론인"),
    "36번": ("desert", "사막"),
    "38번": ("editing", "편집"),
    "40번": ("vision", "시각"),
    "43~45번": ("cafeteria", "구내식당"),
}


def join_tokens(tokens: list[dict]) -> str:
    """Join positioned tokens while preserving the PDF's visible line order."""
    lines: list[list[dict]] = []
    for token in sorted(tokens, key=lambda item: (item["top"], item["x0"])):
        if not lines or abs(token["top"] - lines[-1][0]["top"]) > 2.5:
            lines.append([token])
        else:
            lines[-1].append(token)
    return " ".join(
        " ".join(item["text"] for item in sorted(line, key=lambda item: item["x0"]))
        for line in lines
    ).strip()


def section_rows(page, unit: str) -> list[dict]:
    words = page.extract_words(x_tolerance=1, y_tolerance=2, keep_blank_chars=False)
    heading = next((word for word in words if word["text"] == f"▌{unit}"), None)
    if not heading:
        raise ValueError(f"Missing PDF heading {unit}")

    following_headings = [
        word for word in words
        if word["text"].startswith("▌") and word["top"] > heading["top"] + 5
    ]
    section_end = min((word["top"] for word in following_headings), default=790)
    number_tokens = [
        word for word in words
        if re.fullmatch(r"\d+\.", word["text"])
        and heading["bottom"] + 10 < word["top"] < section_end
        and (55 < word["x0"] < 80 or 300 < word["x0"] < 322)
    ]

    result: list[dict] = []
    for side in ("left", "right"):
        numbers = sorted(
            [word for word in number_tokens if (word["x0"] < 100) == (side == "left")],
            key=lambda item: item["top"],
        )
        for index, number in enumerate(numbers):
            upper = number["top"] - 3
            lower = numbers[index + 1]["top"] - 3 if index + 1 < len(numbers) else section_end
            if side == "left":
                word_tokens = [item for item in words if upper <= item["top"] < lower and 70 <= item["x0"] < 175]
                meaning_tokens = [item for item in words if upper <= item["top"] < lower and 175 <= item["x0"] < 300]
            else:
                word_tokens = [item for item in words if upper <= item["top"] < lower and 320 <= item["x0"] < 420]
                meaning_tokens = [item for item in words if upper <= item["top"] < lower and 420 <= item["x0"] < 550]

            raw_word = join_tokens(word_tokens)
            raw_meaning = join_tokens(meaning_tokens)
            marker_match = re.match(r"^(\*{1,2})", raw_word)
            marker = marker_match.group(1) if marker_match else ""
            word = raw_word[len(marker):]
            result.append({
                "sourceN": int(number["text"][:-1]),
                "word": word,
                "rawWord": raw_word,
                "meaning": raw_meaning,
                "rawMeaning": raw_meaning,
                "partOfSpeech": "",
                "lesson": unit,
                "unit": unit,
                "section": unit,
                "type": "단어",
                "sourceMarker": marker,
                "sourceBook": "2025년 고1 9월 인천광역시 교육청 학력평가",
            })
    return sorted(result, key=lambda row: row["sourceN"])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    if not args.pdf.is_file():
        raise FileNotFoundError(args.pdf)

    all_rows: list[dict] = []
    with pdfplumber.open(args.pdf) as document:
        if len(document.pages) != 17:
            raise ValueError(f"Expected 17 PDF pages, got {len(document.pages)}")
        for unit, page_number, expected_count in SECTIONS:
            rows = section_rows(document.pages[page_number - 1], unit)
            if len(rows) != expected_count:
                raise ValueError(f"{unit}: expected {expected_count}, got {len(rows)}")
            if [row["sourceN"] for row in rows] != list(range(1, expected_count + 1)):
                raise ValueError(f"{unit}: sourceN is not contiguous")
            if (rows[0]["word"], rows[0]["meaning"]) != REPRESENTATIVES[unit]:
                raise ValueError(f"{unit}: representative row mismatch: {rows[0]}")
            all_rows.extend(rows)

    for global_number, row in enumerate(all_rows, start=1):
        row["n"] = global_number
    if len(all_rows) != 214:
        raise ValueError(f"Expected 214 rows, got {len(all_rows)}")
    last = all_rows[-1]
    expected_last = (214, 36, "43~45번", "fumble", "더듬어 찾다", "*")
    actual_last = (last["n"], last["sourceN"], last["unit"], last["word"], last["meaning"], last["sourceMarker"])
    if actual_last != expected_last:
        raise ValueError(f"Final row mismatch: {actual_last}")
    if any(not row["word"] or not row["meaning"] for row in all_rows):
        raise ValueError("Empty word or meaning")

    digest = hashlib.sha256(args.pdf.read_bytes()).hexdigest().upper()
    payload = {
        "schemaVersion": 1,
        "source": {
            "file": args.pdf.name,
            "sha256": digest,
            "pages": 17,
            "method": "deterministic-pdf-coordinate-extraction",
        },
        "book": {
            "id": "incheon-g1-sep-2025-selected",
            "name": "2025 고1 9월 인천광역시 교육청 학력평가 · 선택 지문",
            "source": args.pdf.name,
            "sheet": "WORDS & EXPRESSIONS",
            "category": "모의고사",
            "level": "고등",
            "words": all_rows,
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.output}: 214 rows · SHA256 {digest}")


if __name__ == "__main__":
    main()
