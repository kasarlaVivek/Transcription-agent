import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { parseRosterFile } from "../api/client";

const ACCEPTED_FILE_TYPES = {
  "audio/mpeg": [".mp3"],
  "audio/wav": [".wav"],
  "audio/x-m4a": [".m4a"],
  "audio/webm": [".webm"],
  "audio/ogg": [".ogg"],
  "text/plain": [".txt", ".vtt", ".srt"],
};

export default function UploadZone({ onSubmit, isLoading }) {
  const [mode, setMode] = useState("upload"); // "upload" | "text"
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [roster, setRoster] = useState([{ name: "", email: "", role: "" }]);
  const [rosterImportError, setRosterImportError] = useState(null);
  const [rosterImporting, setRosterImporting] = useState(false);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxFiles: 1,
    disabled: isLoading,
  });

  // ── Roster (attendee) editing ─────────────────────────────────
  const updateRosterRow = (index, field, value) => {
    setRoster((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const addRosterRow = () => {
    setRoster((prev) => [...prev, { name: "", email: "", role: "" }]);
  };

  const removeRosterRow = (index) => {
    setRoster((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRosterFileImport = async (e) => {
    const importedFile = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!importedFile) return;

    setRosterImportError(null);
    setRosterImporting(true);
    try {
      const imported = await parseRosterFile(importedFile);
      setRoster(imported.length > 0 ? imported : [{ name: "", email: "", role: "" }]);
    } catch (err) {
      setRosterImportError(
        err.response?.data?.detail || "Could not import this file."
      );
    } finally {
      setRosterImporting(false);
    }
  };

  // Keep only rows that have at least a name + email.
  const cleanRoster = () =>
    roster
      .map((r) => ({ name: r.name.trim(), email: r.email.trim(), role: r.role.trim() }))
      .filter((r) => r.name && r.email);

  const handleSubmit = () => {
    const attendees = cleanRoster();
    if (mode === "upload" && file) {
      onSubmit({ file, roster: attendees });
    } else if (mode === "text" && text.trim().length >= 20) {
      onSubmit({ text, roster: attendees });
    }
  };

  const canSubmit =
    !isLoading &&
    ((mode === "upload" && file) || (mode === "text" && text.trim().length >= 20));

  const getFileIcon = (filename) => {
    const ext = filename?.split(".").pop()?.toLowerCase();
    if (["mp3", "wav", "m4a", "webm", "ogg"].includes(ext)) return "🎵";
    return "📄";
  };

  return (
    <div className="upload-zone-container">
      {/* Mode toggle */}
      <div className="mode-toggle">
        <button
          id="mode-upload"
          className={`toggle-btn ${mode === "upload" ? "active" : ""}`}
          onClick={() => setMode("upload")}
          disabled={isLoading}
        >
          <span className="toggle-icon">📁</span>
          Upload File
        </button>
        <button
          id="mode-text"
          className={`toggle-btn ${mode === "text" ? "active" : ""}`}
          onClick={() => setMode("text")}
          disabled={isLoading}
        >
          <span className="toggle-icon">📝</span>
          Paste Text
        </button>
      </div>

      {/* Upload area */}
      {mode === "upload" && (
        <div
          {...getRootProps()}
          className={`dropzone ${isDragActive ? "drag-active" : ""} ${file ? "has-file" : ""}`}
          id="dropzone"
        >
          <input {...getInputProps()} id="file-input" />
          {file ? (
            <div className="file-preview">
              <span className="file-icon">{getFileIcon(file.name)}</span>
              <div className="file-info">
                <span className="file-name">{file.name}</span>
                <span className="file-size">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
              <button
                className="remove-file"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                id="remove-file-btn"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="dropzone-content">
              <div className="dropzone-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className="dropzone-text">
                {isDragActive
                  ? "Drop your file here..."
                  : "Drag & drop a meeting recording or transcript"}
              </p>
              <p className="dropzone-hint">
                Supports .mp3, .wav, .m4a, .txt, .vtt, .srt
              </p>
            </div>
          )}
        </div>
      )}

      {/* Text paste area */}
      {mode === "text" && (
        <div className="text-input-area">
          <textarea
            id="transcript-input"
            className="transcript-textarea"
            placeholder="Paste your meeting transcript here...&#10;&#10;Example:&#10;John: Let's discuss the Q3 roadmap.&#10;Sarah: I think we should prioritize the mobile app.&#10;John: Agreed. Sarah, can you draft a proposal by Friday?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isLoading}
            rows={12}
          />
          <div className="char-count">
            <span className={text.length < 20 ? "insufficient" : "sufficient"}>
              {text.length} characters
            </span>
            {text.length > 0 && text.length < 20 && (
              <span className="min-hint">min 20 required</span>
            )}
          </div>
        </div>
      )}

      {/* Attendee roster (optional) */}
      <div className="roster-section">
        <div className="roster-header">
          <div className="roster-title">
            <span className="roster-icon">👥</span>
            <span>Attendees <span className="roster-optional">(optional)</span></span>
          </div>
          <p className="roster-hint">
            Add names, emails &amp; roles so drafts are addressed and ready to send.
          </p>
          <label className={`roster-import-btn ${rosterImporting ? "loading" : ""}`}>
            {rosterImporting ? "Importing..." : "Import CSV / Excel"}
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={handleRosterFileImport}
              disabled={isLoading || rosterImporting}
              hidden
            />
          </label>
          {rosterImportError && (
            <p className="roster-import-error">{rosterImportError}</p>
          )}
        </div>

        <div className="roster-rows">
          {roster.map((row, i) => (
            <div className="roster-row" key={i}>
              <input
                type="text"
                className="roster-input roster-name"
                placeholder="Name"
                value={row.name}
                onChange={(e) => updateRosterRow(i, "name", e.target.value)}
                disabled={isLoading}
              />
              <input
                type="email"
                className="roster-input roster-email"
                placeholder="email@company.com"
                value={row.email}
                onChange={(e) => updateRosterRow(i, "email", e.target.value)}
                disabled={isLoading}
              />
              <input
                type="text"
                className="roster-input roster-role"
                placeholder="Role"
                value={row.role}
                onChange={(e) => updateRosterRow(i, "role", e.target.value)}
                disabled={isLoading}
              />
              <button
                type="button"
                className="roster-remove"
                onClick={() => removeRosterRow(i)}
                disabled={isLoading || roster.length === 1}
                title="Remove attendee"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="roster-add"
          onClick={addRosterRow}
          disabled={isLoading}
        >
          + Add attendee
        </button>
      </div>

      {/* Submit button */}
      <button
        id="submit-btn"
        className={`submit-btn ${canSubmit ? "ready" : ""}`}
        onClick={handleSubmit}
        disabled={!canSubmit}
      >
        {isLoading ? (
          <span className="loading-content">
            <span className="spinner" />
            Processing...
          </span>
        ) : (
          <>
            <span className="btn-icon">⚡</span>
            Analyse Meeting
          </>
        )}
      </button>
    </div>
  );
}
