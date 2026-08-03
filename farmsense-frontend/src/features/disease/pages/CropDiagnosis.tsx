import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { analyseCropImage, getCropImages } from "../disease.service";
import type { AnalysisResult, CropImage } from "../disease.types";

/**
 * The crop photo diagnosis screen.
 *
 * This UI did not exist before: the classifier ran, the backend had an
 * endpoint, and there was no way for a farmer to actually use any of it. The
 * flagship "AI-powered crop health" feature was unreachable from the app.
 *
 * The important behaviour here is what happens on a LOW-CONFIDENCE result. The
 * component renders a completely different branch - no chemical, no dose, just
 * instructions for a better photo. That is enforced by the discriminated union
 * on AnalysisResult, so it is not possible to accidentally show a treatment
 * the backend withheld.
 */
export default function CropDiagnosis() {
  const { cropId } = useParams();
  const fileInput = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<CropImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cropId) return;
    getCropImages(cropId).then(setHistory).catch(() => setHistory([]));
  }, [cropId]);

  // Object URLs leak until revoked. Cheap to get wrong, and it accumulates
  // across every photo a farmer takes in one session.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFile = async (file: File) => {
    if (!cropId) return;

    setError(null);
    setResult(null);
    setProgress(0);
    setPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const analysis = await analyseCropImage(cropId, file, setProgress);
      setResult(analysis);
      setHistory(await getCropImages(cropId));
    } catch (err: any) {
      setError(
        err.response?.data?.error ??
          "Could not analyse the photo. Check your connection and try again."
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      <header>
        <h2 className="text-2xl font-bold text-green-800">Crop Health Photo</h2>
        <p className="text-sm text-gray-600 mt-1">
          Photograph a single affected leaf in daylight, filling the frame.
        </p>
      </header>

      {/* ---- Capture ---- */}
      <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-6">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          // `capture="environment"` opens the rear camera directly on a phone,
          // which is how this will almost always be used - standing in a field,
          // not picking from a gallery.
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        <button
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-4 rounded-xl transition"
        >
          {uploading ? `Analysing... ${progress}%` : "Take or choose a photo"}
        </button>

        {preview && (
          <img
            src={preview}
            alt="Selected crop leaf"
            className="mt-4 rounded-xl max-h-72 w-full object-contain bg-gray-50"
          />
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>

      {/* ---- Result ---- */}
      {result && <DiagnosisResult result={result} />}

      {/* ---- History ---- */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-6">
          <h3 className="font-semibold text-green-800 mb-4">Photo history</h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {history.map((image) => (
              <div key={image.id} className="rounded-lg overflow-hidden border">
                <img
                  src={image.image_url}
                  alt={image.disease_class ?? "Crop photo"}
                  loading="lazy"
                  className="w-full h-28 object-cover bg-gray-100"
                />
                <div className="p-2 text-xs">
                  <p className="font-medium capitalize">
                    {image.disease_class?.replace("_", " ") ?? "Unclassified"}
                  </p>
                  <p className="text-gray-500">
                    {image.confidence != null
                      ? `${(image.confidence * 100).toFixed(0)}% · `
                      : ""}
                    {new Date(image.uploaded_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DiagnosisResult({ result }: { result: AnalysisResult }) {
  const { diagnosis } = result;
  const confidencePct = (diagnosis.confidence * 100).toFixed(0);

  // ---- Below the confidence gate ----
  // Deliberately a separate render path with no treatment anywhere in it.
  if (!result.actionable) {
    return (
      <div className="bg-amber-50 border border-amber-300 rounded-2xl p-6">
        <h3 className="font-semibold text-amber-900 text-lg">
          Not confident enough to advise
        </h3>

        <p className="mt-2 text-sm text-amber-900">{result.guidance.message}</p>

        <p className="mt-3 text-xs text-amber-800">
          The closest match was{" "}
          <span className="font-medium capitalize">
            {diagnosis.disease.replace("_", " ")}
          </span>{" "}
          at {confidencePct}%, which is below the threshold required to
          recommend any treatment.
        </p>

        <ul className="mt-4 space-y-2 text-sm text-amber-900 list-disc ml-5">
          {result.guidance.actions.map((action, i) => (
            <li key={i}>{action}</li>
          ))}
        </ul>
      </div>
    );
  }

  // ---- Above the gate ----
  const { treatment } = result;
  const healthy = treatment.disease === "healthy";

  return (
    <div
      className={`rounded-2xl border p-6 ${
        healthy ? "bg-green-50 border-green-300" : "bg-white border-orange-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-lg text-gray-900">{treatment.label}</h3>
          {treatment.label_ne && (
            <p className="text-sm text-gray-600">{treatment.label_ne}</p>
          )}
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 border text-gray-700">
          {confidencePct}% confidence
        </span>
      </div>

      {treatment.pathogen && (
        <p className="mt-2 text-xs text-gray-500">{treatment.pathogen}</p>
      )}

      {treatment.chemical_treatment && (
        <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm">
          <p className="font-medium text-orange-900">
            {treatment.chemical_treatment.active_ingredient}
          </p>
          <p className="mt-1 text-orange-900">
            {treatment.chemical_treatment.dose_per_hectare}
          </p>
          <dl className="mt-3 space-y-1 text-xs text-orange-800">
            <div>
              <dt className="inline font-medium">How: </dt>
              <dd className="inline">{treatment.chemical_treatment.application}</dd>
            </div>
            <div>
              <dt className="inline font-medium">When: </dt>
              <dd className="inline">{treatment.chemical_treatment.timing}</dd>
            </div>
          </dl>
          {/* Legally and practically the most important line on this screen. */}
          <p className="mt-3 text-xs font-medium text-red-700">
            Do not harvest within{" "}
            {treatment.chemical_treatment.preharvest_interval_days} days of
            spraying.
          </p>
        </div>
      )}

      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-800">In the field</h4>
        <ul className="mt-2 space-y-1.5 text-sm text-gray-700 list-disc ml-5">
          {treatment.cultural_practice.map((practice, i) => (
            <li key={i}>{practice}</li>
          ))}
        </ul>
      </div>

      {treatment.notes && (
        <p className="mt-4 text-xs text-gray-600 italic border-t pt-3">
          {treatment.notes}
        </p>
      )}

      {result.compression.ratio && (
        <p className="mt-3 text-xs text-gray-400">
          Photo stored at {result.compression.ratio}x compression
          ({(result.compression.stored_bytes / 1024).toFixed(0)} KB).
        </p>
      )}
    </div>
  );
}
