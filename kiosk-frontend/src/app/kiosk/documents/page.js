"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadDocument } from "@/lib/api";
import { loadActiveSession, upsertQueueEntry } from "@/lib/registry";

const DOC_TYPES = [
  { value: "prescription", label: "Previous prescription" },
  { value: "lab_report", label: "Lab / blood test report" },
  { value: "discharge_summary", label: "Discharge summary" },
];

const PLACEHOLDER_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORUS5CYII=";

function fileToCompressedBase64(file, maxDimension = 1200, quality = 0.8) {
  return new Promise((resolve) => {
    if (!file) return resolve(PLACEHOLDER_BASE64);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result || "";
      const rawBase64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      if (!file.type || !file.type.startsWith("image/")) {
        return resolve(rawBase64);
      }
      const img = new Image();
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
          resolve(compressedDataUrl.split(",")[1] || rawBase64);
        } catch (_) {
          resolve(rawBase64);
        }
      };
      img.onerror = () => resolve(rawBase64);
      img.src = dataUrl;
    };
    reader.onerror = () => resolve(PLACEHOLDER_BASE64);
    reader.readAsDataURL(file);
  });
}

export default function DocumentsPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
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
      const imageBase64 = useDemoFile || !file ? PLACEHOLDER_BASE64 : await fileToCompressedBase64(file);
      const result = await uploadDocument(sessionId, documentType, imageBase64);
      setUploaded((prev) => [...prev, { documentType, result }]);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
          <input
            ref={fileInputRef}
            id="file"
            type="file"
            accept="image/*,.pdf,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
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
