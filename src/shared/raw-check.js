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
  const hasName = lines.slice(1, end).some((line) => {
    const match = /^name:(.*)$/.exec(line);
    if (!match) return false;
    // Drop a trailing comment, then reject YAML empty and null forms.
    const value = match[1].replace(/(^|\s)#.*$/, "").trim();
    return !["", '""', "''", "~", "null", "Null", "NULL"].includes(value);
  });
  if (!hasName) failures.push("The front matter needs a name: line with a value.");
  return failures;
}
