"""Remove em dashes from website source (src/ and api/)."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET_DIRS = [ROOT / "src", ROOT / "api"]
EXTS = {".js", ".jsx", ".ts", ".tsx", ".css"}


def transform(content: str) -> str:
    content = content.replace("'—'", "'-'")
    content = content.replace('"—"', '"-"')
    content = content.replace(" — ", ", ")
    content = content.replace("—", ", ")
    content = re.sub(r" , ", ", ", content)
    content = re.sub(r",  +", ", ", content)
    return content


def main() -> None:
    changed_files = []
    for base in TARGET_DIRS:
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if path.suffix not in EXTS:
                continue
            text = path.read_text(encoding="utf-8")
            new = transform(text)
            if new != text:
                path.write_text(new, encoding="utf-8")
                changed_files.append(str(path.relative_to(ROOT)))

    print(f"Updated {len(changed_files)} files")
    for f in sorted(changed_files):
        print(f"  {f}")


if __name__ == "__main__":
    main()
