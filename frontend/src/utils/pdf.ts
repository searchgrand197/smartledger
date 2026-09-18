import type { AxiosResponse } from "axios";

const PDF_MIME = "application/pdf";

function asPdfBlob(data: Blob | ArrayBuffer): Blob {
  if (data instanceof Blob) {
    if (data.type === PDF_MIME) return data;
    return new Blob([data], { type: PDF_MIME });
  }
  return new Blob([data], { type: PDF_MIME });
}

/** Normalize axios blob response and verify it is a real PDF (not JSON error). */
export async function ensurePdfBlob(res: AxiosResponse<Blob>): Promise<Blob> {
  const blob = asPdfBlob(res.data);
  const head = await blob.slice(0, 8).text();

  if (head.trimStart().startsWith("{") || head.trimStart().startsWith("<")) {
    try {
      const err = JSON.parse(await blob.text());
      throw new Error(err.detail || err.message || "Failed to load PDF");
    } catch (e) {
      if (e instanceof Error && !e.message.includes("JSON")) throw e;
      throw new Error("Failed to load PDF");
    }
  }

  if (!head.startsWith("%PDF")) {
    throw new Error("Server did not return a valid PDF");
  }

  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Open a blank tab immediately while the browser still treats the action as a user gesture.
 * Call this synchronously inside a click handler before any await.
 */
export function openPdfPrintWindow(): Window | null {
  try {
    return window.open("", "_blank");
  } catch {
    return null;
  }
}

export async function loadPdfIntoWindow(
  targetWin: Window | null,
  res: AxiosResponse<Blob>,
  filename = "invoice.pdf"
): Promise<"opened" | "downloaded"> {
  const blob = await ensurePdfBlob(res);
  const url = URL.createObjectURL(blob);
  window.setTimeout(() => URL.revokeObjectURL(url), 300_000);

  if (targetWin && !targetWin.closed) {
    targetWin.location.href = url;
    targetWin.focus();
    return "opened";
  }

  downloadBlob(blob, filename);
  return "downloaded";
}

/** Open PDF in a new tab (for print). Falls back to download if popup blocked. */
export async function openPdfInNewTab(
  res: AxiosResponse<Blob>,
  filename = "invoice.pdf",
  preOpened?: Window | null
) {
  const win = preOpened !== undefined ? preOpened : openPdfPrintWindow();
  return loadPdfIntoWindow(win, res, filename);
}

export async function downloadPdfResponse(res: AxiosResponse<Blob>, filename: string) {
  const blob = await ensurePdfBlob(res);
  downloadBlob(blob, filename);
}
