"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const MAX_FILE_READ_BYTES = 256 * 1024; // Read only the first 256KB of large text files

export default function PayloadPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const resultsContainerRef = useRef(null);
  const resultsEndRef = useRef(null);
  const scrollTimerRef = useRef(null);

  const [payloadText, setPayloadText] = useState("");
  const [payloadWords, setPayloadWords] = useState([]);
  const [wordLimit, setWordLimit] = useState(2000);
  const [fileName, setFileName] = useState("");
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
  const [previewResult, setPreviewResult] = useState("");
  const [sendResults, setSendResults] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [requestText, setRequestText] = useState(`GET /example HTTP/1.1
Host: example.com
User-Agent: Mozilla/5.0
Accept: text/html

username=user&password=123`);

  // Handle manual payload input
  const handlePayloadInputChange = (e) => {
    setPayloadText(e.target.value);
  };

  const readFirstWordsFromFile = (file) => {
    const slice = file.slice(0, MAX_FILE_READ_BYTES);
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result || "";
      const text = typeof content === "string" ? content : "";
      const words = text
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => word.length > 0);

      if (words.length === 0) {
        alert("The selected file does not contain readable payload words.");
        return;
      }

      setPayloadText(text);
      processPayloadText(text);
    };

    reader.onerror = () => {
      alert("Unable to read the selected file. Please check the file type and try again.");
    };

    reader.readAsText(slice);
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    readFirstWordsFromFile(file);
  };

  // Process payload text into words
  const processPayloadText = (text) => {
    const words = text
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 0)
      .slice(0, wordLimit);

    setPayloadWords(words);
    setPreviewResult("");
  };

  // Handle add/import payload button
  const handleAddPayload = () => {
    if (payloadText.trim()) {
      processPayloadText(payloadText);
    }
  };

  // Handle sort by code
  const handleSort = () => {
    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
  };

  const handleResultsInteraction = () => {
    if (autoScrollEnabled) {
      setAutoScrollEnabled(false);
    }
    if (scrollTimerRef.current) {
      window.clearTimeout(scrollTimerRef.current);
    }
    scrollTimerRef.current = window.setTimeout(() => {
      setAutoScrollEnabled(true);
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        window.clearTimeout(scrollTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!autoScrollEnabled || sendResults.length === 0) return;
    const container = resultsContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [sendResults, autoScrollEnabled]);

  // Handle mark payload
  const handleMarkPayload = () => {
    const textarea = document.querySelector('#request-textarea');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) {
      alert("Please select some text to mark as payload");
      return;
    }

    const selectedText = requestText.substring(start, end);
    const before = requestText.substring(0, start);
    const after = requestText.substring(end);
    const newText = `${before}@{${selectedText}}${after}`;
    setRequestText(newText);
  };

  // Handle clear payload markers
  const handleClearPayloadMarkers = () => {
    const newText = requestText.replace(/@\{[^}]+\}/g, (match) => match.slice(2, -1));
    setRequestText(newText);
  };

  const parseRequestText = (text) => {
    const normalized = text.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    const requestLine = lines.find((line) => line.trim().length > 0);
    if (!requestLine) return null;

    const [method, path] = requestLine.split(" ");
    if (!method || !path) return null;

    const headers = {};
    const bodyLines = [];
    let isBody = false;

    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (!isBody && line.trim() === "") {
        isBody = true;
        continue;
      }
      if (isBody) {
        bodyLines.push(line);
      } else {
        const splitIndex = line.indexOf(":");
        if (splitIndex !== -1) {
          const name = line.slice(0, splitIndex).trim().toLowerCase();
          const value = line.slice(splitIndex + 1).trim();
          headers[name] = value;
        }
      }
    }

    let url = path;
    if (!path.startsWith("http://") && !path.startsWith("https://")) {
      const hostHeader = headers.host || "";
      const scheme = hostHeader.startsWith("https://") ? "" : "http://";
      url = hostHeader ? `${hostHeader.startsWith("http") ? "" : scheme}${hostHeader}${path}` : path;
    }

    return {
      method,
      url,
      headers,
      body: bodyLines.join("\n") || undefined,
    };
  };

  const buildSendRequestText = (word) => {
    const markers = requestText.match(/@\{[^}]+\}/g) || [];
    if (markers.length === 0) return null;

    let sendText = requestText;
    markers.forEach((marker) => {
      sendText = sendText.replace(marker, word);
    });

    return sendText;
  };

  const handleSendPayload = async () => {
    if (payloadWords.length === 0) {
      alert("Please add payload words before sending.");
      return;
    }

    const markers = requestText.match(/@\{[^}]+\}/g) || [];
    if (markers.length === 0) {
      alert("Please mark at least one payload injection point in the request using 'Mark Payload'.");
      return;
    }

    setIsSending(true);
    setSendResults([]);
    setAutoScrollEnabled(true);
    setPreviewResult(`Sending ${payloadWords.length} payload requests...`);

    for (const word of payloadWords) {
      const sendText = buildSendRequestText(word);
      const parsed = sendText ? parseRequestText(sendText) : null;

      if (!parsed || !parsed.method || !parsed.url) {
        setSendResults((prev) => [
          ...prev,
          {
            word,
            status: 0,
            url: "",
            bodySnippet: "",
            elapsed: 0,
            error: "Unable to parse request for this payload word.",
          },
        ]);
        continue;
      }

      const requestBody = {
        method: parsed.method,
        url: parsed.url,
        headers: parsed.headers,
        body: parsed.body,
      };

      try {
        const response = await fetch("/api/repeater/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        const result = await response.json();

        setSendResults((prev) => [
          ...prev,
          {
            word,
            status: result.status_code ?? response.status,
            url: parsed.url,
            bodySnippet: result.body ? String(result.body).slice(0, 120) : "",
            elapsed: result.elapsed ?? 0,
            error: result.error ?? (response.ok ? null : JSON.stringify(result)),
          },
        ]);
      } catch (error) {
        setSendResults((prev) => [
          ...prev,
          {
            word,
            status: 0,
            url: parsed.url,
            bodySnippet: "",
            elapsed: 0,
            error: error?.message || "Network error",
          },
        ]);
      }
    }

    setIsSending(false);
    setPreviewResult(`Completed sending ${payloadWords.length} payload requests.`);
  };

  // Apply payload and generate preview
  const handleApplyPayload = () => {
    if (payloadWords.length === 0) {
      alert("Please add payload words before applying payload.");
      return;
    }

    const markers = requestText.match(/@\{[^}]+\}/g) || [];
    if (markers.length === 0) {
      alert("Please mark at least one payload injection point in the request using 'Mark Payload'.");
      return;
    }

    const previewExamples = payloadWords.slice(0, 3).map((word, i) => {
      let modifiedRequest = requestText;
      markers.forEach((marker) => {
        modifiedRequest = modifiedRequest.replace(marker, word);
      });
      return `\nRequest ${i + 1} (using "${word}"):\n${modifiedRequest}\n---`;
    });

    const preview = `
PAYLOAD PREVIEW:
================

Payload Words Loaded: ${payloadWords.length}

Injection Points Found: ${markers.length}

EXAMPLE MODIFIED REQUESTS:${previewExamples.join("\n")}

Ready to send payloads using the Send Payload button.
    `.trim();

    setPreviewResult(preview);
    console.log("Apply payload preview:", {
      payloadWords: payloadWords.slice(0, 3),
      markers,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Payload Builder</p>
            <h1 className="mt-2 text-4xl font-bold text-slate-100">Craft & Test Payloads</h1>
            <p className="mt-2 text-slate-400">Create custom payloads and preview injection points</p>
          </div>
          <button
            onClick={() => router.back()}
            className="rounded-2xl border border-slate-800/80 bg-slate-950/90 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-900"
          >
            Back
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Request & Payload Input */}
          <div className="lg:col-span-2 space-y-6">
            {/* Request Display */}
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">Request Inspector</h2>
                  <p className="text-sm text-slate-500">Select text to mark as payload injection points</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleMarkPayload}
                    className="rounded-2xl border border-blue-700/50 bg-blue-950/50 px-4 py-2 text-sm text-blue-300 transition hover:bg-blue-900/70 hover:border-blue-600"
                  >
                    Mark Payload
                  </button>
                  <button
                    onClick={handleClearPayloadMarkers}
                    className="rounded-2xl border border-red-700/50 bg-red-950/50 px-4 py-2 text-sm text-red-300 transition hover:bg-red-900/70 hover:border-red-600"
                  >
                    Clear Markers
                  </button>
                </div>
              </div>
              <textarea
                id="request-textarea"
                value={requestText}
                onChange={(e) => setRequestText(e.target.value)}
                className="w-full h-48 rounded-2xl border border-slate-800/80 bg-slate-950/90 p-4 text-sm text-slate-100 outline-none focus:border-emerald-500/80"
                placeholder="Paste your request here..."
              />
            </div>
            {/* Payload Word Limit */}
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6">
              <h2 className="text-lg font-semibold text-slate-100 mb-4">Payload Word Limit</h2>
              <div className="flex items-center gap-4">
                <label className="text-sm text-slate-300">Limit:</label>
                <input
                  type="number"
                  value={wordLimit}
                  onChange={(e) => setWordLimit(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 rounded-2xl border border-slate-800/80 bg-slate-950/90 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/80"
                  min="1"
                />
                <span className="text-sm text-slate-500">words (default: 2000)</span>
              </div>
            </div>

            {/* Payload Input */}
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6">
              <h2 className="text-lg font-semibold text-slate-100 mb-4">Payload Input System</h2>

              {/* Manual Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Paste Payload Text
                </label>
                <textarea
                  value={payloadText}
                  onChange={handlePayloadInputChange}
                  placeholder="Enter payload words or lines here... One per line or separated by spaces"
                  className="w-full h-32 rounded-2xl border border-slate-800/80 bg-slate-950/90 p-4 text-sm text-slate-100 outline-none focus:border-emerald-500/80"
                />
              </div>

              {/* File Upload */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Or Import .txt File
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-2xl border-2 border-dashed border-slate-800/80 bg-slate-950/50 p-6 text-center cursor-pointer transition hover:border-emerald-500/50 hover:bg-slate-950/80"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <p className="text-slate-400">📁 Click to upload or drag & drop .txt file</p>
                  <p className="text-xs text-slate-500 mt-2">
                    Only the first {wordLimit} words are read from the first {MAX_FILE_READ_BYTES / 1024}KB of the file.
                  </p>
                  {fileName && (
                    <p className="text-xs text-slate-500 mt-2">Loaded file: {fileName}</p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleAddPayload}
                  className="flex-1 rounded-2xl border border-emerald-700/50 bg-emerald-950/50 px-4 py-3 text-sm font-medium text-emerald-300 transition hover:bg-emerald-900/70 hover:border-emerald-600"
                >
                  + Add/Import Payload
                </button>
                {payloadWords.length > 0 && (
                  <button
                    onClick={() => {
                      setPayloadWords([]);
                      setPayloadText("");
                      setFileName("");
                      setSendResults([]);
                      setIsSending(false);
                      setPreviewResult("");
                    }}
                    className="rounded-2xl border border-red-700/50 bg-red-950/50 px-4 py-3 text-sm font-medium text-red-300 transition hover:bg-red-900/70 hover:border-red-600"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Payload Summary */}
            {payloadWords.length > 0 && (
              <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6">
                <h2 className="text-lg font-semibold text-slate-100 mb-4">Payload Summary</h2>
                <p className="text-sm text-slate-300 mb-2">Loaded {payloadWords.length} payload words.</p>
                <p className="text-sm text-slate-500">
                  Each payload word will be sent in a separate request by replacing marked payload injection points in the request.
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Preview and Results */}
          <div className="space-y-6">
            {payloadWords.length > 0 && (
              <div className="grid gap-3">
                <button
                  onClick={handleApplyPayload}
                  className="w-full rounded-2xl border border-amber-700/50 bg-gradient-to-r from-amber-950/70 to-amber-900/70 px-6 py-4 text-sm font-semibold text-amber-300 transition hover:from-amber-900 hover:to-amber-800 hover:border-amber-600"
                >
                  Apply Payload
                </button>
                <button
                  onClick={handleSendPayload}
                  disabled={isSending}
                  className="w-full rounded-2xl border border-cyan-700/50 bg-gradient-to-r from-cyan-950/70 to-cyan-900/70 px-6 py-4 text-sm font-semibold text-cyan-300 transition hover:from-cyan-900 hover:to-cyan-800 hover:border-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSending ? `Sending ${payloadWords.length} requests...` : "Send Payload"}
                </button>
              </div>
            )}

            {previewResult && (
              <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6">
                <h2 className="text-lg font-semibold text-slate-100 mb-4">Preview</h2>
                <pre className="text-xs text-slate-300 bg-slate-950/90 p-4 rounded-2xl overflow-x-auto border border-slate-800/80">
                  {previewResult}
                </pre>
              </div>
            )}

            {sendResults.length > 0 && (
              <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-100">Send Results</h2>
                    <p className="text-sm text-slate-500">
                      Results for each payload word. Auto-scroll will pause while you interact with the table.
                    </p>
                  </div>
                  <button
                    onClick={handleSort}
                    className="rounded-2xl border border-slate-700/50 bg-slate-950/50 px-4 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:text-slate-200"
                  >
                    Sort by Status {sortDirection === 'asc' ? '↑' : '↓'}
                  </button>
                </div>

                <div
                  ref={resultsContainerRef}
                  onScroll={handleResultsInteraction}
                  onMouseEnter={handleResultsInteraction}
                  onTouchStart={handleResultsInteraction}
                  className="max-h-[360px] overflow-y-auto rounded-2xl border border-slate-800/80 bg-slate-950/70"
                >
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-950/95">
                      <tr className="border-b border-slate-800/80">
                        <th className="text-left py-3 px-2 text-slate-400 font-medium">#</th>
                        <th className="text-left py-3 px-2 text-slate-300 font-medium">Word</th>
                        <th className="text-left py-3 px-2 text-slate-300 font-medium">Status</th>
                        <th className="text-left py-3 px-2 text-slate-300 font-medium">URL</th>
                        <th className="text-left py-3 px-2 text-slate-300 font-medium">Body Snippet</th>
                        <th className="text-left py-3 px-2 text-slate-300 font-medium">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...sendResults]
                        .sort((a, b) =>
                          sortDirection === 'asc'
                            ? a.status - b.status
                            : b.status - a.status
                        )
                        .map((result, index) => (
                          <tr
                            key={`${result.word}-${index}`}
                            className="border-b border-slate-800/80 hover:bg-slate-950/60 transition"
                          >
                            <td className="py-3 px-2 text-slate-400">{index + 1}</td>
                            <td className="py-3 px-2 text-slate-100 break-all">{result.word}</td>
                            <td className="py-3 px-2 text-slate-200">{result.status}</td>
                            <td className="py-3 px-2 text-slate-400 break-all">{result.url}</td>
                            <td className="py-3 px-2 text-slate-400 break-all">{result.bodySnippet}</td>
                            <td className="py-3 px-2 text-rose-300 break-all">{result.error || "-"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  <div ref={resultsEndRef} />
                </div>
              </div>
            )}

            <div className="rounded-3xl border border-slate-700/50 bg-slate-900/50 p-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                <span className="text-emerald-400 font-semibold">💡 Tip:</span> This is a
                frontend preview. Use the Send Payload button to post the current
                request to `/api/repeater/send` when a backend is available.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
