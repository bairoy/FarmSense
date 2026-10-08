import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Camera,
  Droplets,
  Leaf,
  MapPin,
  Plus,
  Sprout,
} from "lucide-react";

import { useAuthStore } from "../../store/authStore";
import { getFields } from "../fields/field.service";
import type { Field } from "../fields/field.types";
import {
  Alert,
  ButtonLink,
  Card,
  Photo,
  Skeleton,
} from "../../components/ui";

/**
 * The dashboard.
 *
 * What stood here was a marketing page: a stock hero, a headline about
 * precision farming, and two cards describing features to a person who had
 * already bought them. It rendered identically whether the farmer had eleven
 * fields or none, because it never fetched anything.
 *
 * A signed-in home screen has one job - say what is on this farm right now and
 * offer the next action. So this reads the farmer's real fields and branches:
 * an empty account gets a single setup path, an established one gets its land
 * and a way in.
 */
export default function Dashboard() {
  const user = useAuthStore((state) => state.user);

  const [fields, setFields] = useState<Field[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getFields()
      .then((res) => active && setFields(res.data))
      .catch(() => active && setError("Could not load your fields."));

    return () => {
      active = false;
    };
  }, []);

  const firstName = user?.name?.trim().split(/\s+/)[0];
  const hectares = (fields ?? []).reduce(
    (total, field) => total + (field.area?.hectares ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      <Greeting name={firstName} />

      {error && <Alert tone="error">{error}</Alert>}

      {fields === null ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : fields.length === 0 ? (
        <FirstRun />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Tile
              icon={<MapPin className="h-5 w-5" />}
              value={String(fields.length)}
              label={fields.length === 1 ? "field" : "fields"}
            />
            <Tile
              icon={<Leaf className="h-5 w-5" />}
              value={hectares > 0 ? hectares.toFixed(2) : "—"}
              label="hectares under management"
            />
            <Tile
              icon={<Sprout className="h-5 w-5" />}
              value={fields.filter((f) => f.area_sqm).length + "/" + fields.length}
              label="fields with a recorded area"
              // Area is not a nicety: without it there is no denominator for a
              // fertilizer dose, and the backend refuses to compute one.
              warn={fields.some((f) => !f.area_sqm)}
            />
          </div>

          <FieldStrip fields={fields} />
        </>
      )}

      <HowItWorks />
    </div>
  );
}

function Greeting({ name }: { name?: string }) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <Photo
        name="goldenField"
        priority
        sizes="(min-width: 1024px) 1024px, 100vw"
        className="h-44 w-full sm:h-56"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-field-950/90 via-field-950/65 to-field-950/25" />

      <div className="absolute inset-0 flex flex-col justify-center p-6 sm:p-8">
        <p className="text-sm font-semibold text-harvest-300">
          {part}
          {name ? `, ${name}` : ""}
        </p>
        <h1 className="mt-1 max-w-lg text-2xl font-extrabold text-white sm:text-3xl">
          Here is what your land looks like today
        </h1>
        <p className="mt-2 max-w-md text-sm text-white/80">
          Open a crop to see its water balance, what fertilizer is due, and how
          confident the estimate is.
        </p>
      </div>
    </div>
  );
}

function Tile({
  icon,
  value,
  label,
  warn = false,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  warn?: boolean;
}) {
  return (
    <Card className="p-5">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
          warn ? "bg-harvest-100 text-harvest-800" : "bg-field-50 text-field-700"
        }`}
      >
        {icon}
      </span>
      <p className="mt-3 text-3xl font-extrabold tabular text-clay-900">{value}</p>
      <p className="mt-0.5 text-sm text-clay-600">{label}</p>
    </Card>
  );
}

function FieldStrip({ fields }: { fields: Field[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-clay-100 px-5 py-4">
        <h2 className="text-lg font-bold text-clay-900">Your fields</h2>
        <ButtonLink to="/fields" variant="ghost" size="sm">
          See all
          <ArrowRight className="h-4 w-4" />
        </ButtonLink>
      </div>

      <ul className="divide-y divide-clay-100">
        {fields.slice(0, 4).map((field) => (
          <li key={field.id}>
            <Link
              to={`/field/${field.id}/crops`}
              className="flex min-h-16 items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-field-50/60"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold text-clay-900">
                  {field.location_name}
                </span>
                <span className="block truncate text-sm text-clay-500">
                  {field.area?.area_label ?? "area not recorded"} &middot;{" "}
                  {field.soil_type}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-clay-400" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function FirstRun() {
  return (
    <Card className="overflow-hidden md:flex">
      <Photo
        name="seedlings"
        sizes="(min-width: 768px) 40vw, 100vw"
        className="h-40 w-full md:h-auto md:w-2/5"
      />

      <div className="p-6 sm:p-8 md:w-3/5">
        <h2 className="text-xl font-bold text-clay-900">
          Start with one field
        </h2>
        <p className="mt-2 text-clay-600">
          Add the plot as it is written on your khatauni — in bigha, katha and
          dhur. Everything after that follows from it: the water balance, the
          fertilizer amounts, the satellite check.
        </p>

        <ol className="mt-5 space-y-3">
          {[
            "Add a field and its area",
            "Record the crop and its sowing date",
            "Get irrigation and fertilizer guidance each week",
          ].map((step, index) => (
            <li key={step} className="flex items-start gap-3 text-sm text-clay-700">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-field-100 text-xs font-bold text-field-800">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>

        <ButtonLink to="/fields/new" size="lg" className="mt-6">
          <Plus className="h-5 w-5" />
          Add my first field
        </ButtonLink>
      </div>
    </Card>
  );
}

const CAPABILITIES = [
  {
    icon: Droplets,
    title: "Water, in pump hours",
    body: "An irrigation depth in millimetres is also given as litres and as hours on a 10 L/s pump, because that is the number you can act on.",
  },
  {
    icon: Camera,
    title: "Diagnosis from a photo",
    body: "Photograph an affected leaf. Below the confidence threshold no treatment is shown at all — a guess about a chemical is worse than no answer.",
  },
  {
    icon: Sprout,
    title: "Your answer corrects the model",
    body: "One question a week about what you can see. It is treated exactly like a satellite reading, and it is more current than one.",
  },
];

function HowItWorks() {
  return (
    <section>
      <h2 className="mb-4 text-lg font-bold text-clay-900">
        What FarmSense does for you
      </h2>

      <div className="grid gap-4 md:grid-cols-3">
        {CAPABILITIES.map(({ icon: Icon, title, body }) => (
          <Card key={title} className="p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-field-50 text-field-700">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-3 font-bold text-clay-900">{title}</h3>
            <p className="mt-1.5 text-sm text-clay-600">{body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
