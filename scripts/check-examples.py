"""Checks the example packs in templates/examples/.

For each pack file:
  - every entry name is a name in templates/dry-run-design.md
  - the entries are in the same order as in the design file
  - a strict pack (generic.md) has every name. A lenient pack
    (data-pipeline.md) may miss names: they fall back to generic.md
  - each entry has exactly one java block and one python block,
    each 8 lines or less
  - each java block compiles (javac) and each python block parses (ast)

Run from the repo root: python3 scripts/check-examples.py
Exit code 0 when all is well, 1 when there is any problem.
"""
import ast
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DESIGN_FILE = ROOT / "templates" / "dry-run-design.md"
PACK_DIR = ROOT / "templates" / "examples"
# (file name, strict). A strict pack must have every entry.
PACKS = [("generic.md", True), ("data-pipeline.md", False)]
MAX_LINES = 8
FENCE = "```"
LANGUAGES = ["java", "python"]


def design_names():
    """The names of the entries in the design file, in order."""
    names = []
    for line in DESIGN_FILE.read_text(encoding="utf-8").split("\n"):
        if line.startswith("### "):
            names.append(line[4:].strip())
    return names


def read_entries(pack_name, problems):
    """Returns a dict: entry name -> dict: language -> list of code lines.

    The dict keeps the order of the entries in the file. Adds a message to
    `problems` for a duplicate entry, a second block of one language, a fence
    before the first entry, and a fence that is never closed.
    """
    entries = {}
    name = None
    fence_language = None  # None outside a fence. "other" for a block we skip.
    for line in (PACK_DIR / pack_name).read_text(encoding="utf-8").split("\n"):
        if fence_language is not None:
            if line.startswith(FENCE):
                fence_language = None
            elif fence_language in LANGUAGES:
                entries[name][fence_language].append(line)
        elif line.startswith("### "):
            name = line[4:].strip()
            if name in entries:
                problems.append(f"{pack_name}: duplicate entry {name}")
            entries[name] = {"java": [], "python": [], "seen": []}
        elif line.startswith(FENCE):
            language = line[len(FENCE):].strip()
            fence_language = "other"
            if name is None:
                problems.append(f"{pack_name}: code block before the first entry")
            elif language in LANGUAGES:
                if language in entries[name]["seen"]:
                    problems.append(f"{pack_name}: {name}: two {language} blocks")
                else:
                    entries[name]["seen"].append(language)
                    fence_language = language
    if fence_language is not None:
        problems.append(f"{pack_name}: a code block is never closed")
    return entries


def java_compiles(code):
    """Returns (compiled, errors). `compiled` is True when javac accepts the code."""
    with tempfile.TemporaryDirectory() as folder:
        source = Path(folder) / "Snippet.java"
        source.write_text(code, encoding="utf-8")
        result = subprocess.run(
            ["javac", "-d", folder, str(source)],
            capture_output=True,
            text=True,
        )
        return result.returncode == 0, result.stderr


def python_parses(code):
    """True when the code is valid Python syntax."""
    try:
        ast.parse(code)
    except SyntaxError:
        return False
    return True


def check_names(pack_name, strict, entries, expected_names):
    """Problems with the entry names: unknown, missing (strict only), order."""
    problems = []
    for name in entries:
        if name not in expected_names:
            problems.append(f"{pack_name}: unknown entry {name}")
    if strict:
        for name in expected_names:
            if name not in entries:
                problems.append(f"{pack_name}: missing entry {name}")
    present = [name for name in entries if name in expected_names]
    wanted = [name for name in expected_names if name in entries]
    if present != wanted:
        problems.append(f"{pack_name}: entries are not in the order of dry-run-design.md")
    return problems


def check_entry(pack_name, name, entry):
    """Problems with the code blocks of one entry."""
    problems = []
    for language in LANGUAGES:
        count = len(entry[language])
        if count == 0:
            problems.append(f"{pack_name}: {name}: no {language} block")
        elif count > MAX_LINES:
            problems.append(f"{pack_name}: {name}: {language} has {count} lines, max {MAX_LINES}")
    if len(entry["java"]) > 0:
        compiled, errors = java_compiles("\n".join(entry["java"]))
        if not compiled:
            problems.append(f"{pack_name}: {name}: java does not compile\n{errors}")
    if len(entry["python"]) > 0 and not python_parses("\n".join(entry["python"])):
        problems.append(f"{pack_name}: {name}: python does not parse")
    return problems


def check_pack(pack_name, strict, expected_names):
    """Returns a list of problem messages for one pack file."""
    problems = []
    entries = read_entries(pack_name, problems)
    problems.extend(check_names(pack_name, strict, entries, expected_names))
    for name in entries:
        if name in expected_names:
            problems.extend(check_entry(pack_name, name, entries[name]))
    return problems


def main():
    if shutil.which("javac") is None:
        print("javac not found: install a JDK")
        sys.exit(1)
    expected_names = design_names()
    problems = []
    for pack_name, strict in PACKS:
        problems.extend(check_pack(pack_name, strict, expected_names))
    if len(problems) > 0:
        for problem in problems:
            print(problem)
        sys.exit(1)
    print(f"OK: {len(PACKS)} packs, {len(expected_names)} names in the design file")


if __name__ == "__main__":
    main()
