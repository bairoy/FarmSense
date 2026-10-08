import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { LogoMark } from "../../brand";

interface Props {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: Props) {
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore.persist.hasHydrated();

  // Rehydrating the persisted session takes a frame or two. It used to render
  // the bare word "Loading..." against a white page, which on a slow phone
  // reads as a broken app rather than a brand that is starting up.
  if (!hasHydrated) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center bg-clay-50"
        role="status"
        aria-label="Loading FarmSense"
      >
        <LogoMark className="h-10 w-10 animate-pulse text-field-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
