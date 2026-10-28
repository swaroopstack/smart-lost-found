import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth, RequireRole } from "@/auth/AuthProvider";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { BrowsePage } from "@/pages/BrowsePage";
import { NewReportPage } from "@/pages/NewReportPage";
import { ReportDetailPage } from "@/pages/ReportDetailPage";
import { MyReportsPage } from "@/pages/MyReportsPage";
import { MyClaimsPage } from "@/pages/MyClaimsPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { ForbiddenPage } from "@/pages/ForbiddenPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { AdminDashboardPage } from "@/pages/admin/AdminDashboardPage";
import { AdminMatchesPage } from "@/pages/admin/AdminMatchesPage";
import { AdminMatchDetailPage } from "@/pages/admin/AdminMatchDetailPage";
import { AdminClaimsPage } from "@/pages/admin/AdminClaimsPage";
import { AdminUsersPage } from "@/pages/admin/AdminUsersPage";
import { AdminAuditPage } from "@/pages/admin/AdminAuditPage";

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="browse" element={<BrowsePage />} />
          <Route path="reports/new" element={<NewReportPage />} />
          <Route path="reports/:id" element={<ReportDetailPage />} />
          <Route path="my-reports" element={<MyReportsPage />} />
          <Route path="my-claims" element={<MyClaimsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="forbidden" element={<ForbiddenPage />} />

          <Route path="admin">
            <Route
              index
              element={
                <RequireRole roles={["STAFF", "ADMIN"]}>
                  <AdminDashboardPage />
                </RequireRole>
              }
            />
            <Route
              path="matches"
              element={
                <RequireRole roles={["STAFF", "ADMIN"]}>
                  <AdminMatchesPage />
                </RequireRole>
              }
            />
            <Route
              path="matches/:id"
              element={
                <RequireRole roles={["STAFF", "ADMIN"]}>
                  <AdminMatchDetailPage />
                </RequireRole>
              }
            />
            <Route
              path="claims"
              element={
                <RequireRole roles={["STAFF", "ADMIN"]}>
                  <AdminClaimsPage />
                </RequireRole>
              }
            />
            <Route
              path="users"
              element={
                <RequireRole roles={["ADMIN"]}>
                  <AdminUsersPage />
                </RequireRole>
              }
            />
            <Route
              path="audit"
              element={
                <RequireRole roles={["ADMIN"]}>
                  <AdminAuditPage />
                </RequireRole>
              }
            />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}
