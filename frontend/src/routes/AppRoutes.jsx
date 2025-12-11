import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import EmployeeDashboard from "@/pages/employee/EmployeeDashboard";
import ReceptionDashboard from "@/pages/offline/ReceptionDashboard";
import UserDashboard from "@/pages/user/UserDashboard";

function AppRoutes() {
  // later we’ll replace this with real auth check
  const token = localStorage.getItem("auth_token");
  const role = localStorage.getItem("auth_role"); // we’ll set this on login

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      

      {/* Simple role-based redirects for now */}
      <Route
        path="/"
        element={
          token ? (
            role === "admin" ? (
              <Navigate to="/admin" replace />
            ) : role === "employee" ? (
              <Navigate to="/employee" replace />
            ) : role === "offline" ? (
              <Navigate to="/offline" replace />
            ) : (
              <Navigate to="/user" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/employee" element={<EmployeeDashboard />} />
      <Route path="/offline" element={<ReceptionDashboard />} />
      <Route path="/user" element={<UserDashboard />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default AppRoutes;
