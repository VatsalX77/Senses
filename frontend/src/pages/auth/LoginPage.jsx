import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { loginRequest } from "@/lib/apiClient";

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }

    try {
      setLoading(true);
      const data = await loginRequest({ email, password });

      // store token & role in localStorage
      localStorage.setItem("auth_token", data.token);
      if (data.user && data.user.role) {
        localStorage.setItem("auth_role", data.user.role);
      } else {
        localStorage.removeItem("auth_role");
      }

      // redirect based on role
      const role = data.user?.role;
      if (role === "admin") {
        navigate("/admin", { replace: true });
      } else if (role === "employee") {
        navigate("/employee", { replace: true });
      } else if (role === "offline") {
        navigate("/offline", { replace: true });
      } else {
        navigate("/user", { replace: true });
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Clinic Panel Login</CardTitle>
          <CardDescription>
            Sign in to access your dashboard.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex justify-between text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Clinic Management</span>
          <span>v1.0</span>
        </CardFooter>
      </Card>
    </div>
  );
}

export default LoginPage;
