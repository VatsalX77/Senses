const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export async function loginRequest({ email, password}) {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
            "Content-Type":"application/json"
        },
        body: JSON.stringify({ email,password})
    });

    const data = await res.json();

    if(!res.ok || data.ok === false) {
        // adjust error shape if your backend sends something else
            throw new Error(data.msg || "Login failed")
    }

    // expecting { ok: true, token, user: {role,name,email}}
    return data;
}

export async function registerRequest({ name, email, password, role = "user" }) {
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, role })
  });

  const data = await res.json();

  if (!res.ok || data.ok === false) {
    throw new Error(data.msg || (data.error && data.error.message) || "Registration failed");
  }

  // expecting { ok: true, token, user: { role, name, email, ... } }
  return data;
}


