import { useEffect, useState } from "react";
import { CheckCircle2, MessageSquareQuote } from "lucide-react";

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
      <div className="flex gap-3 rounded-2xl border border-field-200 bg-field-50 p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-field-600" />
        <p className="text-sm text-field-900">{thanks}</p>
      </div>
    );
  }

  if (!checkin) return null;

  const question = checkin.question;

  return (
    <section className="animate-rise rounded-2xl border border-water-200 bg-water-50 p-5">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-water-700">
        <MessageSquareQuote className="h-4 w-4" />
        Quick check
      </p>

      <p className="mt-2.5 text-lg font-bold text-water-950">
        {question?.question ?? checkin.question_text}
      </p>
      {question?.question_ne && (
        <p className="mt-0.5 text-water-800">{question.question_ne}</p>
      )}

      {/* Answer buttons are full-width blocks on a phone. Three small chips in
          a row is a mis-tap waiting to happen, and a wrong answer here feeds
          straight into the model as an observation. */}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {(question?.options ?? []).map((option) => (
          <button
            key={option.value}
            onClick={() => submit(option.value)}
            disabled={submitting}
            className="min-h-14 rounded-xl border border-water-300 bg-white px-4 py-2 text-center font-semibold text-water-900 transition-colors hover:border-water-500 hover:bg-water-100 disabled:opacity-50"
          >
            <span className="block">{option.label}</span>
            <span className="block text-sm font-normal text-clay-500">
              {option.label_ne}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs text-water-800">
        Your answer corrects the model directly — it is treated the same way as a
        satellite reading.
      </p>
    </section>
  );
}
