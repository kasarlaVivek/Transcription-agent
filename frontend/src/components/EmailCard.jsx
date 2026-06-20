import { useState } from "react";

export default function EmailCard({ email, index }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Editable fields so the user can review/correct before sending.
  const [toEmail, setToEmail] = useState(email.to_email || "");
  const [subject, setSubject] = useState(email.subject || "");
  const [body, setBody] = useState(email.body || "");

  const handleCopy = async (e) => {
    e.stopPropagation();
    const textToCopy = `Subject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS contexts
      const textarea = document.createElement("textarea");
      textarea.value = textToCopy;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSend = (e) => {
    e.stopPropagation();
    // Review-then-send: open the user's mail client pre-filled. No auto-send.
    const mailto = `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail.trim());

  return (
    <div className={`email-card ${isOpen ? "open" : ""}`} id={`email-card-${index}`}>
      <div
        className="email-header"
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setIsOpen(!isOpen)}
      >
        <div className="email-header-left">
          <span className="email-icon">✉️</span>
          <div className="email-meta">
            <span className="email-to">
              To: {email.to}
              {email.role && <span className="email-role-badge">{email.role}</span>}
            </span>
            <span className="email-subject">{subject}</span>
          </div>
        </div>
        <div className="email-header-right">
          <button
            className={`copy-btn ${copied ? "copied" : ""}`}
            onClick={handleCopy}
            title="Copy to clipboard"
            id={`copy-email-${index}`}
          >
            {copied ? "✓ Copied" : "📋 Copy"}
          </button>
          <span className={`chevron ${isOpen ? "rotated" : ""}`}>▼</span>
        </div>
      </div>
      {isOpen && (
        <div className="email-body">
          <div className="email-edit-field">
            <label htmlFor={`email-to-${index}`}>Recipient</label>
            <input
              id={`email-to-${index}`}
              type="email"
              className="email-edit-input"
              placeholder="recipient@company.com"
              value={toEmail}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setToEmail(e.target.value)}
            />
          </div>

          <div className="email-edit-field">
            <label htmlFor={`email-subject-${index}`}>Subject</label>
            <input
              id={`email-subject-${index}`}
              type="text"
              className="email-edit-input"
              value={subject}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="email-edit-field">
            <label htmlFor={`email-body-${index}`}>Message</label>
            <textarea
              id={`email-body-${index}`}
              className="email-edit-textarea"
              rows={10}
              value={body}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <div className="email-send-row">
            {!validEmail && (
              <span className="email-send-hint">
                Add a valid recipient email to enable sending.
              </span>
            )}
            <button
              className="email-send-btn"
              onClick={handleSend}
              disabled={!validEmail}
              id={`send-email-${index}`}
              title="Open in your email client, pre-filled"
            >
              📤 Review &amp; Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
