import type { ReactNode } from "react";
import { CloudSun, Satellite, ShieldCheck } from "lucide-react";

import { Photo } from "../../../components/ui";
import { Wordmark } from "../../../brand";

const PROOF = [
  { icon: CloudSun, text: "Water and fertilizer from FAO-56 physics, not rules of thumb" },
  { icon: Satellite, text: "Checked against Sentinel satellite passes over your own field" },
  { icon: ShieldCheck, text: "Every number carries how much you should trust it" },
];

/**
 * The signed-out frame.
 *
 * Login and Register were two 384px white boxes on an empty green page, giving
 * a first-time visitor nothing that says what this product does or why its
 * numbers can be relied on. The panel on the right does that work; on a phone
 * it collapses to a slim banner so the form stays above the fold.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-clay-50 lg:grid lg:grid-cols-[1fr_1.1fr]">
      {/* ---- Form ---- */}
      <div className="flex flex-col px-5 py-8 sm:px-10 lg:px-14 lg:py-12">
        <Wordmark markClassName="h-8 w-8" />

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-extrabold text-clay-900">{title}</h1>
          <p className="mt-2 text-clay-600">{subtitle}</p>

          <div className="mt-8">{children}</div>

          <p className="mt-8 text-center text-sm text-clay-600">{footer}</p>
        </div>

        <p className="text-center text-xs text-clay-400 lg:text-left">
          Calibrated for Gorakhpur district, Uttar Pradesh &middot; rice and wheat
        </p>
      </div>

      {/* ---- Proof panel ---- */}
      <div className="relative order-first min-h-44 overflow-hidden lg:order-last lg:min-h-dvh">
        <Photo
          name="paddyFarmer"
          priority
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="absolute inset-0 h-full w-full"
        />

        {/* Two stops, dark at the bottom, so the copy has a guaranteed contrast
            floor no matter which part of the photo sits behind it. */}
        <div className="absolute inset-0 bg-gradient-to-t from-field-950/90 via-field-950/45 to-field-950/25" />

        <div className="relative flex h-full flex-col justify-end p-6 sm:p-10 lg:p-14">
          <h2 className="max-w-md text-xl font-bold text-white sm:text-3xl">
            A digital twin of your field, with no sensors to buy.
          </h2>

          <ul className="mt-5 hidden space-y-3 sm:block">
            {PROOF.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-white/90">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-harvest-300" />
                <span className="text-sm">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
