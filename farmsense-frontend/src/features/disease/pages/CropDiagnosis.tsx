import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Camera,
  CheckCircle2,
  ImageOff,
  Sun,
  TriangleAlert,
} from "lucide-react";

import { analyseCropImage, getCropImages } from "../disease.service";
import type { AnalysisResult, CropImage, TwinCorrection } from "../disease.types";
import { apiErrorMessage } from "../../../services/apiError";
import { Alert, Badge, Button, Card, CardHeader } from "../../../components/ui";

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
  const [viewing, setViewing] = useState<CropImage | null>(null);
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
  const [takenOn, setTakenOn] = useState(today);
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
      const analysis = await analyseCropImage(cropId, file, takenOn, setProgress);
      setResult(analysis);
      setHistory(await getCropImages(cropId));
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          "Could not analyse the photo. Check your connection and try again."
        )
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-6">
        <CardHeader
          icon={<Camera className="h-5 w-5" />}
          title="Crop health photo"
          description="One affected leaf, filling the frame, in daylight."
        />

        {/* What makes a usable photo, before the photo is taken rather than in
            an error message afterwards. */}
        <ul className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            { icon: Sun, text: "Daylight, no flash" },
            { icon: Camera, text: "One leaf, filling the frame" },
            { icon: ImageOff, text: "Steady — a blurred photo is refused" },
          ].map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-center gap-2 rounded-lg bg-clay-50 px-3 py-2 text-sm text-clay-700"
            >
              <Icon className="h-4 w-4 shrink-0 text-field-600" />
              {text}
            </li>
          ))}
        </ul>

        {/* The twin compares the photo with what it predicted for THIS date, so a
            photo taken earlier and uploaded later still lands on the right day. */}
        <label className="mt-5 block">
          <span className="text-sm font-semibold text-clay-700">
            Date the photo was taken
          </span>
          <input
            type="date"
            value={takenOn}
            max={today}
            onChange={(e) => setTakenOn(e.target.value || today)}
            disabled={uploading}
            className="mt-1 block w-full rounded-lg border border-clay-200 bg-white px-3 py-2 text-clay-900"
          />
        </label>

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

        <Button
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          size="lg"
          block
          className="mt-5"
        >
          <Camera className="h-5 w-5" />
          {uploading ? `Analysing... ${progress}%` : "Take or choose a photo"}
        </Button>

        {uploading && (
          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-clay-200"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-field-600 transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {preview && (
          <img
            src={preview}
            alt="The leaf you selected"
            className="mt-4 max-h-72 w-full rounded-xl bg-clay-100 object-contain"
          />
        )}

        {error && (
          <Alert tone="error" className="mt-4">
            {error}
          </Alert>
        )}
      </Card>

      {result && <DiagnosisResult result={result} />}
      {result?.twin_correction && <TwinNote correction={result.twin_correction} />}

      {history.length > 0 && (
        <Card className="p-5 sm:p-6">
          <CardHeader
            title="Photo history"
            description="Every leaf you have photographed for this crop."
          />

          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {history.map((image) => (
              <li
                key={image.id}
                className="overflow-hidden rounded-xl border border-clay-200"
              >
                <button
                  type="button"
                  onClick={() => setViewing(image)}
                  className="block aspect-square w-full bg-clay-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-field-600"
                  aria-label="View photo full size"
                >
                  <img
                    src={image.image_url}
                    alt={image.disease_class ?? "Crop photo"}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.visibility = "hidden";
                    }}
                    className="h-full w-full object-cover"
                  />
                </button>
                <div className="p-2.5">
                  <p className="truncate text-sm font-semibold capitalize text-clay-900">
                    {image.disease_class?.replace(/_/g, " ") ?? "Unclassified"}
                  </p>
                  <p className="text-xs tabular text-clay-500">
                    {image.confidence != null
                      ? `${(image.confidence * 100).toFixed(0)}% · `
                      : ""}
                    {new Date(image.uploaded_at).toLocaleDateString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {viewing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo preview"
          onClick={() => setViewing(null)}
          onKeyDown={(e) => e.key === "Escape" && setViewing(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/85 p-4"
        >
          <img
            src={viewing.image_url}
            alt={viewing.disease_class ?? "Crop photo"}
            className="max-h-[80vh] max-w-full rounded-lg object-contain"
          />
          <p className="text-sm font-semibold capitalize text-white">
            {viewing.disease_class?.replace(/_/g, " ") ?? "Unclassified"}
            {viewing.confidence != null
              ? ` · ${(viewing.confidence * 100).toFixed(0)}%`
              : ""}
            {" · "}
            {new Date(viewing.uploaded_at).toLocaleDateString()}
          </p>
          <button
            type="button"
            autoFocus
            className="rounded-lg bg-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/25"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

function TwinNote({ correction }: { correction: TwinCorrection }) {
  return (
    <section
      className={`rounded-2xl border p-5 sm:p-6 ${
        correction.adjusted
          ? "border-harvest-300 bg-harvest-50"
          : "border-clay-200 bg-white"
      }`}
    >
      <h3 className="text-base font-bold text-clay-900">
        {correction.adjusted
          ? "Crop estimate updated from your photo"
          : "Crop estimate unchanged"}
      </h3>

      <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
        {[
          { label: "Estimate before", value: correction.simulated_health },
          { label: "Photo shows", value: correction.observed_health },
          { label: "Estimate now", value: correction.corrected_health },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-clay-50 p-3">
            <dt className="text-xs font-bold uppercase tracking-wide text-clay-400">
              {label}
            </dt>
            <dd className="mt-1 text-xl font-bold tabular text-clay-900">
              {value}
              <span className="text-xs font-medium text-clay-500">/100</span>
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-sm text-clay-700">{correction.note}</p>
      <p className="mt-1 text-xs text-clay-500">
        Compared for {new Date(correction.date).toLocaleDateString()}.
      </p>
    </section>
  );
}

/**
 * The Grad-CAM++ overlay: warmer colours mark the parts of the photo that most
 * pushed the model toward its answer. It explains the model's attention, not
 * whether the answer is right - the caption says so, because a convincing
 * picture invites more trust than it has earned.
 */
function Heatmap({ src }: { src: string | null | undefined }) {
  if (!src) return null;
  return (
    <figure className="mt-4">
      <img
        src={src}
        alt="Heatmap of where the AI looked in your photo"
        className="w-full max-w-sm rounded-xl border border-clay-200"
      />
      <figcaption className="mt-1.5 text-xs text-clay-500">
        Warmer colours show where the AI looked. If they sit on soil or
        background instead of the leaf, do not rely on the result.
      </figcaption>
    </figure>
  );
}

function DiagnosisResult({ result }: { result: AnalysisResult }) {
  const { diagnosis } = result;
  const confidencePct = (diagnosis.confidence * 100).toFixed(0);

  // ---- Below the confidence gate ----
  // Deliberately a separate render path with no treatment anywhere in it.
  if (!result.actionable) {
    return (
      <section className="rounded-2xl border border-harvest-300 bg-harvest-50 p-5 sm:p-6">
        <h3 className="flex items-start gap-2.5 text-lg font-bold text-harvest-900">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-harvest-700" />
          Not confident enough to advise
        </h3>

        <p className="mt-2 text-sm text-harvest-900">{result.guidance.message}</p>

        <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-xs text-harvest-900">
          The closest match was{" "}
          <span className="font-bold capitalize">
            {diagnosis.disease.replace(/_/g, " ")}
          </span>{" "}
          at <span className="tabular font-bold">{confidencePct}%</span>, which is
          below the threshold required to recommend any treatment.
        </p>

        <Heatmap src={diagnosis.heatmap} />

        <ul className="mt-4 ml-5 list-disc space-y-2 text-sm text-harvest-900">
          {result.guidance.actions.map((action, i) => (
            <li key={i}>{action}</li>
          ))}
        </ul>
      </section>
    );
  }

  // ---- Above the gate ----
  const { treatment } = result;
  const healthy = treatment.disease === "healthy";

  return (
    <section
      className={`rounded-2xl border p-5 sm:p-6 ${
        healthy ? "border-field-300 bg-field-50" : "border-harvest-300 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {healthy && (
            <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-field-600" />
          )}
          <div>
            <h3 className="text-lg font-bold text-clay-900">{treatment.label}</h3>
            {treatment.label_ne && (
              <p className="text-sm text-clay-600">{treatment.label_ne}</p>
            )}
          </div>
        </div>
        <Badge tone={healthy ? "field" : "harvest"}>
          {confidencePct}% confidence
        </Badge>
      </div>

      {treatment.pathogen && (
        <p className="mt-2 text-xs italic text-clay-500">{treatment.pathogen}</p>
      )}

      <Heatmap src={diagnosis.heatmap} />

      {treatment.chemical_treatment && (
        <div className="mt-4 rounded-xl border border-harvest-200 bg-harvest-50 p-4">
          <p className="font-bold text-harvest-900">
            {treatment.chemical_treatment.active_ingredient}
          </p>
          <p className="mt-1 text-sm tabular text-harvest-900">
            {treatment.chemical_treatment.dose_per_hectare}
          </p>

          <dl className="mt-3 space-y-1.5 text-xs text-harvest-900">
            <div>
              <dt className="inline font-bold">How: </dt>
              <dd className="inline">{treatment.chemical_treatment.application}</dd>
            </div>
            <div>
              <dt className="inline font-bold">When: </dt>
              <dd className="inline">{treatment.chemical_treatment.timing}</dd>
            </div>
          </dl>

          {/* Legally and practically the most important line on this screen, so
              it is given its own block rather than a coloured sentence at the
              end of a paragraph. */}
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-alert-200 bg-alert-50 px-3 py-2.5 text-sm font-bold text-alert-800">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Do not harvest within{" "}
            {treatment.chemical_treatment.preharvest_interval_days} days of
            spraying.
          </p>
        </div>
      )}

      <div className="mt-4">
        <h4 className="text-sm font-bold text-clay-800">In the field</h4>
        <ul className="mt-2 ml-5 list-disc space-y-1.5 text-sm text-clay-700">
          {treatment.cultural_practice.map((practice, i) => (
            <li key={i}>{practice}</li>
          ))}
        </ul>
      </div>

      {treatment.notes && (
        <p className="mt-4 border-t border-clay-200 pt-3 text-xs italic text-clay-600">
          {treatment.notes}
        </p>
      )}

      {result.compression.ratio && (
        <p className="mt-3 text-xs tabular text-clay-400">
          Photo stored at {result.compression.ratio}x compression (
          {(result.compression.stored_bytes / 1024).toFixed(0)} KB).
        </p>
      )}
    </section>
  );
}
