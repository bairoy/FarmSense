import { BrowserRouter, Routes, Route } from "react-router-dom";

import ProtectedRoute from "../components/routes/ProtectedRoute";
import PublicRoute from "../components/routes/PublicRoute";
import Layout from "../components/layout/Layout";

import Login from "../features/auth/pages/Login";
import Register from "../features/auth/pages/Register";
import Dashboard from "../features/dashboard/Dashboard";
import AddField from "../features/fields/pages/AddField";
import FieldDetails from "../features/fields/pages/FieldDetails";
import FieldsList from "../features/fields/pages/FieldsList";
import CropDetail from "../features/crops/pages/CropDetail";
import CropsByField from "../features/crops/pages/CropsByField";
import CreateCrop from "../features/crops/pages/CreateCrop";
import FertilizerHistory from "../features/fertilizer/pages/FertilizerHistory";
import AddFertilizer from "../features/fertilizer/pages/AddFertilizer";
import IrrigationHistory from "../features/irrigation/pages/IrrigationHistory";
import AddIrrigation from "../features/irrigation/pages/AddIrrigation";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ========== PROTECTED (with Layout/Header) ========== */}
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
          <Route path="/field/:fieldId" element={<FieldDetails />}>
            <Route path="crops" element={<CropsByField />} />
            <Route path="crops/new" element={<CreateCrop />} />
          </Route>
          <Route path="/crop/:cropId" element={<CropDetail />} >
          <Route path="fertilizer" element={<FertilizerHistory />} />
          <Route path="fertilizer/new" element={<AddFertilizer />} />
          <Route path="irrigation" element={<IrrigationHistory/>}/>
          <Route path="irrigation/new" element={<AddIrrigation/>}/>
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
        <Route path="*" element={<div>Page Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}
