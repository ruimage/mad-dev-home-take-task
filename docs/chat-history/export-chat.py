"""Append public chat messages from a Codex session JSONL to Markdown."""

import argparse
import hashlib
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path


SESSION_ID = "01a186f9-adb9-7f93-ae71-0bc99f2441e6"
DEFAULT_OUTPUT = Path(__file__).with_name(f"2026-10-29-{SESSION_ID}.md")
MINSK = timezone(timedelta(hours=3), "Europe/Minsk")
TECHNICAL_PREFIXES = (
    "<environment_context>",
    "<external_codex_apps_open_page>",
    "<permissions instructions>",
)


def public_text(payload):
    return "\n".join(
        block.get("text", "")
        for block in payload.get("content", [])
        if block.get("type") in ("input_text", "output_text", "text")
    ).strip()


def local_timestamp(record):
    value = record.get("timestamp")
    if not value:
        return "Время не указано в журнале"
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(MINSK).isoformat()


def entry_id(record):
    canonical = json.dumps(record, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def questions_text(payload):
    args = json.loads(payload.get("arguments", "{}"))
    sections = []
    for question in args.get("questions", []):
        sections.append(question.get("question", question.get("title", "")))
        for option in question.get("options", []):
            if isinstance(option, str):
                sections.append(f"- {option}")
            else:
                sections.append(f"- {option.get('label', '')}: {option.get('description', '')}")
        sections.append("")
    return "\n".join(sections).strip()


def export(source, output):
    existing = output.read_text(encoding="utf-8") if output.exists() else ""
    known = set(re.findall(r"<!-- chat-log:([a-f0-9]{64}) -->", existing))
    question_calls = set()
    blocks = []
    count = 0
    for line in source.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            # A live writer may not yet have completed the last JSONL record.
            continue
        if record.get("type") != "response_item":
            continue
        payload = record.get("payload", {})
        kind = payload.get("type")
        label = None
        text = ""
        if kind == "message" and payload.get("role") in ("user", "assistant"):
            role = payload["role"]
            if role == "assistant":
                phase = payload.get("phase") or payload.get("channel")
                if phase not in ("commentary", "final_answer", "final"):
                    continue
            text = public_text(payload)
            if not text or text.startswith(TECHNICAL_PREFIXES):
                continue
            label = "Пользователь" if role == "user" else "Ассистент"
            if payload.get("phase") == "commentary":
                label += " — промежуточное сообщение"
        elif kind == "function_call" and payload.get("name", "").split(".")[-1] in (
            "request_user_input", "request_user_input_async"
        ):
            question_calls.add(payload.get("call_id"))
            text = questions_text(payload)
            label = "Ассистент — интерактивные вопросы"
        elif kind == "function_call_output" and payload.get("call_id") in question_calls:
            value = payload.get("output", "")
            try:
                value = json.dumps(json.loads(value), ensure_ascii=False, indent=2)
            except (json.JSONDecodeError, TypeError):
                pass
            text = f"```json\n{value}\n```"
            label = "Пользователь — ответы на интерактивные вопросы"
        if not label or not text:
            continue
        identity = entry_id(record)
        if identity in known:
            continue
        blocks.append(
            f"\n<!-- chat-log:{identity} -->\n"
            f"## {label}\n\n"
            f"Время: {local_timestamp(record)}\n\n{text}\n"
        )
        known.add(identity)
        count += 1

    output.parent.mkdir(parents=True, exist_ok=True)
    if not output.exists():
        header = (
            "# История чата: бронирование переговорной\n\n"
            "Формат: сообщения пользователя, публичные ответы и промежуточные сообщения "
            "ассистента, интерактивные уточнения. Текст сообщений сохранён без редактирования. "
            "System/developer instructions, рассуждения и технические логи инструментов исключены.\n\n"
            "Время сообщений: Europe/Minsk (UTC+03:00). "
            "Комментарии chat-log используются для дополнения без дублей.\n"
        )
        output.write_text(header, encoding="utf-8")
    if blocks:
        with output.open("a", encoding="utf-8", newline="\n") as target:
            target.write("".join(blocks))
    return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    source = args.source
    if source is None:
        directory = Path.home() / ".codex" / "sessions" / "2026" / "10" / "29"
        candidates = list(directory.glob(f"*{SESSION_ID}*.jsonl"))
        if len(candidates) != 1:
            parser.error("Pass --source: expected exactly one session JSONL")
        source = candidates[0]
    count = export(source, args.output)
    print(json.dumps({"appended": count, "output": str(args.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
