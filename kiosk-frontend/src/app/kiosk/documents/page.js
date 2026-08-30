"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadDocument } from "@/lib/api";
import { loadActiveSession, upsertQueueEntry } from "@/lib/registry";

const DOC_TYPES = [
  { value: "prescription", label: "Previous prescription" },
  { value: "lab_report", label: "Lab / blood test report" },
  { value: "discharge_summary", label: "Discharge summary" },
];

// 1x1 transparent PNG — lets the demo proceed even without a real
// scanned file on hand. The mock OCR provider returns canned text
// keyed to documentType regardless of image content.
const PLACEHOLDER_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to JPEG with 0.75 quality to reduce upload payload size significantly while preserving text readability
        const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
        resolve(dataUrl.split(",")[1]);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DocumentsPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState(null);
  const [documentType, setDocumentType] = useState("prescription");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [uploaded, setUploaded] = useState([]);

  useEffect(() => {
    const active = loadActiveSession();
    if (!active?.sessionId) {
      router.push("/kiosk/identify");
      return;
    }
    setSessionId(active.sessionId);
  }, [router]);

  async function handleUpload(useDemoFile = false) {
    setError(null);
    setUploading(true);
    try {
      const imageBase64 = useDemoFile || !file ? PLACEHOLDER_BASE64 : await fileToBase64(file);
      const result = await uploadDocument(sessionId, documentType, imageBase64);
      setUploaded((prev) => [...prev, { documentType, result }]);
      setFile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function handleContinue() {
    upsertQueueEntry(sessionId, { status: "documents_uploaded", documentCount: uploaded.length });
    router.push("/kiosk/review");
  }

  return (
    <div>
      <p className="eyebrow">Step 5 of 6</p>
      <h1 style={{ fontSize: 30, marginTop: 8, marginBottom: 6 }}>Upload any documents</h1>
      <p style={{ color: "var(--slate)", marginBottom: 24 }}>
        Previous prescriptions or lab reports help your doctor see the full picture. This step is optional.
      </p>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="field">
          <label htmlFor="doctype">Document type</label>
          <select id="doctype" value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="file">Photo / scan</label>
          <input id="file" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" disabled={uploading || !file} onClick={() => handleUpload(false)}>
            {uploading ? "Uploading…" : "Upload"}
          </button>
          <button className="btn btn-secondary btn-sm" disabled={uploading} onClick={() => handleUpload(true)}>
            Use demo sample instead
          </button>
        </div>

        {error && <div className="banner banner-red" style={{ marginTop: 16 }}>{error}</div>}
      </div>

      {uploaded.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Uploaded this visit</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {uploaded.map((u, i) => (
              <li key={i}>{DOC_TYPES.find((t) => t.value === u.documentType)?.label || u.documentType}</li>
            ))}
          </ul>
        </div>
      )}

      <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleContinue}>
        {uploaded.length > 0 ? "Continue to review" : "Skip — no documents to upload"}
      </button>
    </div>
  );
}
