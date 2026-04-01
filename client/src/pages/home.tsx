import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export function Home() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();

  if (!isAuthenticated || !user) {
    return (
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          gap: "2rem",
          padding: "2rem"
        }}
      >
        <section style={{ textAlign: "center", maxWidth: 720 }}>
          <h1 style={{ marginBottom: 12 }}>AI Search Visibility Engine</h1>
          <p style={{ margin: "8px 0" }}>
            Please sign in to continue.
          </p>
          <button
            onClick={() => navigate("/auth")}
            style={{
              marginTop: 16,
              padding: "12px 24px",
              background: "linear-gradient(to right, #06b6d4, #9333ea)",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600
            }}
          >
            Sign In
          </button>
        </section>
      </main>
    );
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        gap: "2rem",
        padding: "2rem"
      }}
    >
      <section style={{ textAlign: "center", maxWidth: 720 }}>
        <h1 style={{ marginBottom: 12 }}>AI Search Visibility Engine</h1>
        <p style={{ margin: "8px 0" }}>
          Welcome back, {user.email}!
        </p>
        <p style={{ margin: "8px 0" }}>Visit our quiet place for builders:</p>

        <a
          href="https://intruvurt.space"
          target="_blank"
          rel="noreferrer"
          style={{ display: "inline-block", marginTop: 8 }}
        >
          https://intruvurt.space
        </a>

        <div style={{ marginTop: 18, display: "flex", justifyContent: "center", gap: 12 }}>
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              padding: "10px 20px",
              background: "#06b6d4",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer"
            }}
          >
            Dashboard
          </button>
          <button
            onClick={() => { logout(); navigate("/auth"); }}
            style={{
              padding: "10px 20px",
              background: "#64748b",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer"
            }}
          >
            Sign Out
          </button>
        </div>
      </section>
    </main>
  );
}
