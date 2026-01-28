export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "…";
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function exportAsJson(entries: unknown[], filename: string): void {
  const blob = new Blob([JSON.stringify(entries, null, 2)], {
    type: "application/json",
  });
  downloadBlob(blob, filename);
}

export function exportAsCsv(
  entries: { originalText: string; result: { translation: string }; timestamp: number }[],
  filename: string
): void {
  const header = "Original,Translation,Timestamp\n";
  const rows = entries
    .map(
      (e) =>
        `"${e.originalText.replace(/"/g, '""')}","${e.result.translation.replace(/"/g, '""')}","${formatTimestamp(e.timestamp)}"`
    )
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  downloadBlob(blob, filename);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
