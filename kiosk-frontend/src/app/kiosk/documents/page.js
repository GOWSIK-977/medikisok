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
  const [patientName, setPatientName] = useState("");
  const [documentType, setDocumentType] = useState("prescription");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
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
    if (active?.patient?.name) {
      setPatientName(active.patient.name);
    }
  }, [router]);

  function handleFileChange(selectedFile) {
    setFile(selectedFile || null);
    if (selectedFile && selectedFile.type?.startsWith("image/")) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  }

  async function handleUpload(useDemoFile = false) {
    setError(null);
    setUploading(true);
    try {
      const imageBase64 = useDemoFile || !file ? PLACEHOLDER_BASE64 : await fileToCompressedBase64(file);
      const res = await uploadDocument(sessionId, documentType, imageBase64, patientName);
      const doc = res?.document || {};
      setUploaded((prev) => [
        ...prev,
        {
          documentType,
          docId: doc.document_id,
          doctor: doc.doctor_name,
          date: doc.document_date,
          shortDescription: doc.short_description,
          medicationsCount: doc.extracted_medications?.length || 0,
          preview: previewUrl,
        },
      ]);
      setFile(null);
      setPreviewUrl(null);
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
        Previous prescriptions or lab reports help your doctor see the full picture. Our AI will automatically analyze your prescription and summarize previous medications for the attending physician.
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
          <label htmlFor="file">Photo / scan of previous doctor prescription</label>
          <input
            ref={fileInputRef}
            id="file"
            type="file"
            accept="image/*,.pdf,application/pdf"
            onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
          />
        </div>

        {previewUrl && (
          <div style={{ marginBottom: 16, textAlign: "center", background: "#f8fafc", padding: 12, borderRadius: 10, border: "1px dashed #cbd5e1" }}>
            <p style={{ fontSize: 13, color: "var(--slate)", marginBottom: 8, fontWeight: 500 }}>Selected Document Preview:</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Prescription preview" style={{ maxHeight: 220, maxWidth: "100%", borderRadius: 8, objectFit: "contain", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }} />
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" disabled={uploading || !file} onClick={() => handleUpload(false)}>
            {uploading ? "Analyzing prescription with Gemini AI…" : "Upload & Analyze Prescription"}
          </button>
          <button className="btn btn-secondary btn-sm" disabled={uploading} onClick={() => handleUpload(true)}>
            Use demo prescription sample
          </button>
        </div>

        {error && <div className="banner banner-red" style={{ marginTop: 16 }}>{error}</div>}
      </div>

      {uploaded.length > 0 && (
        <div className="card" style={{ marginBottom: 20, border: "1.5px solid #a7f3d0", background: "#f0fdf4" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 18 }}>✓</span>
            <div className="eyebrow" style={{ color: "#065f46", margin: 0 }}>
              Analyzed Documents for Doctor Review ({uploaded.length})
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {uploaded.map((u, i) => (
              <div
                key={i}
                style={{
                  background: "#ffffff",
                  padding: 14,
                  borderRadius: 10,
                  border: "1px solid #d1fae5",
                  fontSize: 13.5,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: "#065f46" }}>
                    📋 {DOC_TYPES.find((t) => t.value === u.documentType)?.label || u.documentType}
                  </span>
                  {u.date && <span style={{ fontSize: 12, color: "var(--slate)" }}>Dated: {u.date}</span>}
                </div>
                {u.doctor && (
                  <p style={{ margin: "2px 0 6px", color: "var(--ink)", fontWeight: 600 }}>
                    👨‍⚕️ Prescribed by: {u.doctor}
                  </p>
                )}
                {u.shortDescription && (
                  <div style={{ background: "#ecfdf5", padding: "8px 10px", borderRadius: 6, color: "#065f46", fontSize: 13, lineHeight: 1.45, marginBottom: 6 }}>
                    🧠 <strong>AI Synopsis:</strong> {u.shortDescription}
                  </div>
                )}
                {u.medicationsCount > 0 && (
                  <span style={{ fontSize: 12, background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>
                    💊 {u.medicationsCount} medications extracted
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="btn btn-primary" style={{ width: "100%", padding: 14, fontSize: 16 }} onClick={handleContinue}>
        {uploaded.length > 0 ? "Continue to review ➔" : "Skip — no documents to upload"}
      </button>
    </div>
  );
}
