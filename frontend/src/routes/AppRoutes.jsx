import { Route, Routes } from "react-router-dom";

import Layout from "../components/layout/Layout.jsx";
import {
  GuestRoute,
  ProtectedRoute,
} from "../components/routes/ProtectedRoute.jsx";
import Dashboard from "../pages/Dashboard.jsx";
import Projects from "../pages/Projects.jsx";
import ProjectDetail from "../pages/ProjectDetail.jsx";
import Tasks from "../pages/Tasks.jsx";
import Board from "../pages/Board.jsx";
import NotFound from "../pages/NotFound.jsx";
import Login from "../pages/auth/Login.jsx";
import Signup from "../pages/auth/Signup.jsx";
import ForgotPassword from "../pages/auth/ForgotPassword.jsx";
import ResetPassword from "../pages/auth/ResetPassword.jsx";

/**
 * App routes.
 *
 * - Protected: everything inside the app shell requires a session,
 *   otherwise the user is redirected to /login (returning to `from` after).
 * - Guest-only: /login and /signup bounce authenticated users to the app.
 * - Public: password reset stays reachable (the link may be opened
 *   from another browser/device).
 */
export default function AppRoutes() {
  return (
    <Routes>
      {/* Authenticated app shell */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/board" element={<Board />} />
        </Route>
      </Route>

      {/* Logged-out visitors only */}
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Route>

      {/* Always reachable */}
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Full-page 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
