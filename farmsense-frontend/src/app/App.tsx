import { useEffect, useRef } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigationType,
} from "react-router-dom";

import ProtectedRoute from "../components/routes/ProtectedRoute";
import PublicRoute from "../components/routes/PublicRoute";
import Layout from "../components/layout/Layout";

import Login from "../features/auth/pages/Login";
import Register from "../features/auth/pages/Register";
import Dashboard from "../features/dashboard/Dashboard";
import AddField from "../features/fields/pages/AddField";
import EditField from "../features/fields/pages/EditField";
import FieldDetails from "../features/fields/pages/FieldDetails";
import FieldsList from "../features/fields/pages/FieldsList";
import CropDetail from "../features/crops/pages/CropDetail";
import CropsByField from "../features/crops/pages/CropsByField";
import CreateCrop from "../features/crops/pages/CreateCrop";
import FertilizerHistory from "../features/fertilizer/pages/FertilizerHistory";
import AddFertilizer from "../features/fertilizer/pages/AddFertilizer";
import IrrigationHistory from "../features/irrigation/pages/IrrigationHistory";
import AddIrrigation from "../features/irrigation/pages/AddIrrigation";
import CropDiagnosis from "../features/disease/pages/CropDiagnosis";
import NotFound from "../features/misc/NotFound";

/** `/crop/<id>` - the crop page and everything nested under it. */
const cropScope = (pathname: string) => /^\/crop\/[^/]+/.exec(pathname)?.[0] ?? null;

/**
 * React Router keeps the previous page's scroll offset, so following a link
 * from the bottom of a long page used to open the next page scrolled to the
 * bottom. Reset to the top on every new page.
 *
 * Two exceptions:
 *   - Back/forward (POP): let the browser restore where the user was.
 *   - Moving within one crop page (its diagnose / log forms are nested routes
 *     rendered below the timeline): CropDetail scrolls to the form itself, and
 *     jumping to the top here would fight it.
 */
function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const previous = useRef(pathname);

  useEffect(() => {
    const scope = cropScope(pathname);
    const sameCropPage = scope !== null && scope === cropScope(previous.current);
    previous.current = pathname;

    if (navigationType !== "POP" && !sameCropPage) window.scrollTo(0, 0);
  }, [pathname, navigationType]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* ========== PROTECTED (inside the app shell) ========== */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/fields" element={<FieldsList />} />
          <Route path="/fields/new" element={<AddField />} />
          {/* Must precede /field/:fieldId - "edit" would otherwise be captured
              as a field id and render FieldDetails for a field that doesn't
              exist. FieldsList has linked here all along with no route to match. */}
          <Route path="/field/edit/:fieldId" element={<EditField />} />
          <Route path="/field/:fieldId" element={<FieldDetails />}>
            {/* Landing on a field with no child route left the panel empty.
                The crop list is what that page is for. */}
            <Route index element={<Navigate to="crops" replace />} />
            <Route path="crops" element={<CropsByField />} />
            <Route path="crops/new" element={<CreateCrop />} />
          </Route>
          <Route path="/crop/:cropId" element={<CropDetail />}>
            <Route path="diagnose" element={<CropDiagnosis />} />
            <Route path="fertilizer" element={<FertilizerHistory />} />
            <Route path="fertilizer/new" element={<AddFertilizer />} />
            <Route path="irrigation" element={<IrrigationHistory />} />
            <Route path="irrigation/new" element={<AddIrrigation />} />
          </Route>
        </Route>

        {/* ========== PUBLIC ========== */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />

        {/* ========== FALLBACK ========== */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
