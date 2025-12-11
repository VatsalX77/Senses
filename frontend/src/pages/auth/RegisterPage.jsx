import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { registerRequest } from "@/lib/apiClient";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState("user"); // default role; admin creation should ideally be server-only
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!name || !email || !password) {
      setError("Name, email and password are required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const data = await registerRequest({ name, email, password, role });

      // save token & role if returned
      if (data.token) {
        localStorage.setItem("auth_token", data.token);
      }
      if (data.user && data.user.role) {
        localStorage.setItem("auth_role", data.user.role);
      }

      // redirect based on role (if backend auto-creates admin it's fine; otherwise default to login)
      const r = data.user?.role || role;
      if (r === "admin") navigate("/admin", { replace: true });
      else if (r === "employee") navigate("/employee", { replace: true });
      else if (r === "offline") navigate("/offline", { replace: true });
      else navigate("/user", { replace: true });
    } catch (err) {
      console.error(err);
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Create an account</CardTitle>
          <CardDescription>Register to use the Clinic Management system.</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-type password" />
            </div>

            {/* Role selector (optional; in production don't let users pick admin) */}
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-md border p-2"
              >
                <option value="user">User (Patient)</option>
                <option value="employee">Employee</option>
                <option value="offline">Receptionist (Offline)</option>
              </select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Create account"}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex justify-between text-xs text-muted-foreground">
          <span>
            Already have an account? <Link to="/login" className="text-primary underline">Sign in</Link>
          </span>
          <span>v1.0</span>
        </CardFooter>
      </Card>
    </div>
  );
}
