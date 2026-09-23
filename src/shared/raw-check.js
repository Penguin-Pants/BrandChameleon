// Basic checks on hand-edited markdown before download (FR-47).

export function checkRawMarkdown(text) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const failures = [];
  if (lines[0] !== "---") {
    failures.push("The file must start with a --- line.");
    return failures;
  }
  const end = lines.indexOf("---", 1);
  if (end === -1) {
    failures.push("The front matter needs a closing --- line.");
    return failures;
  }
  const hasName = lines
    .slice(1, end)
    .some((line) => /^name:\s*\S/.test(line) && !/^name:\s*(""|'')\s*$/.test(line));
  if (!hasName) failures.push("The front matter needs a name: line with a value.");
  return failures;
}
