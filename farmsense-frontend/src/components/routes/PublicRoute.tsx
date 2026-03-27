import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

interface Props {
  children: React.ReactNode;
}

export default function PublicRoute({ children }: Props) {
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore.persist.hasHydrated();

  if (!hasHydrated) return null;

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
