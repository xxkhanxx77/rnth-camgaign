export function parseCsv<T extends Record<string, string> = Record<string, string>>(
  text: string,
): T[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  const headers =
    rows.shift()?.map((header) => header.replace(/^\uFEFF/, "")) ?? [];

  return rows
    .filter((cells) => cells.some((cell) => cell.trim() !== ""))
    .map(
      (cells) =>
        Object.fromEntries(
          headers.map((header, index) => [header, cells[index] ?? ""]),
        ) as T,
    );
}

