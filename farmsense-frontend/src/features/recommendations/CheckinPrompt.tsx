import { useEffect, useState } from "react";
import {
  getDueCheckin,
  answerCheckin,
  type CheckinQuestion,
} from "./recommendations.service";

/**
 * The farmer-as-sensor prompt.
 *
 * One question, three taps, no typing. This is the cheapest real observation
 * the system can get - there is already a human standing in the field, and a
 * weekly yes/no answer is more current than any satellite pass.
 *
 * It renders nothing when nothing is due. Asking for the sake of asking is how
 * you train people to dismiss the prompt without reading it.
 */
export function CheckinPrompt({ cropId }: { cropId: string }) {
  const [checkin, setCheckin] = useState<CheckinQuestion | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [thanks, setThanks] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getDueCheckin(cropId)
      .then((result) => {
        if (active && result.due) setCheckin(result.checkin);
      })
      .catch(() => {
        // A failed check-in fetch must never block the crop page. This is an
        // optional enhancement, not core data.
      });

    return () => {
      active = false;
    };
  }, [cropId]);

  const submit = async (value: string) => {
    if (!checkin) return;

    setSubmitting(true);
    try {
      const result = await answerCheckin(checkin.id, value);
      setThanks(
        result.correction?.note ??
          "Thank you. This helps keep the estimates accurate."
      );
      setCheckin(null);
    } catch {
      setThanks("Could not save your answer. It will be asked again later.");
    } finally {
      setSubmitting(false);
    }
  };

  if (thanks) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-900">
        ✓ {thanks}
      </div>
    );
  }

  if (!checkin) return null;

  const question = checkin.question;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
      <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">
        Quick check
      </p>

      <p className="mt-2 font-medium text-blue-950">
        {question?.question ?? checkin.question_text}
      </p>
      {question?.question_ne && (
        <p className="text-sm text-blue-800">{question.question_ne}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {(question?.options ?? []).map((option) => (
          <button
            key={option.value}
            onClick={() => submit(option.value)}
            disabled={submitting}
            className="px-4 py-2 bg-white border border-blue-300 rounded-lg text-sm hover:bg-blue-100 disabled:opacity-50 transition"
          >
            <span className="block">{option.label}</span>
            <span className="block text-xs text-gray-500">{option.label_ne}</span>
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs text-blue-700">
        Your answer corrects the model directly — it is treated the same way as a
        satellite reading.
      </p>
    </div>
  );
}
