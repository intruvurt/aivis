import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import apiFetch from "../utils/api";
import { API_URL } from "../config";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: ""
  });
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const navigate = useNavigate();

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      toast.error("Invalid reset link");
      navigate("/auth?mode=signin");
      return;
    }
    setTokenValid(true);
    setValidating(false);
  }, [token, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (formData.newPassword.length < 10) {
      toast.error("Password must be at least 10 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch(`${API_URL}/api/auth/reset-password/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: formData.newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to reset password");
      }
      toast.success("Password reset successfully!");
      navigate("/auth?mode=signin");
    } catch (error) {
      toast.error(error.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div id="src_pages_ResetPassword_validating" className="min-h-screen flex items-center justify-center">
        <div id="src_pages_ResetPassword_spinner" className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/10"></div>
      </div>
    );
  }

  if (!tokenValid) {
    return null;
  }

  return (
    <div id="src_pages_ResetPassword_main" className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div id="src_pages_ResetPassword_container" className="max-w-md w-full">
        <div id="src_pages_ResetPassword_header" className="text-center mb-8 lonely-text">
          <h2 id="src_pages_ResetPassword_title" className="text-3xl font-bold text-white">Reset Password</h2>
          <p id="src_pages_ResetPassword_subtitle" className="mt-2 text-white/70">Enter your new password</p>
        </div>

        <div id="src_pages_ResetPassword_card" className="card">
          <form id="src_pages_ResetPassword_form" onSubmit={handleSubmit} className="space-y-6">
            <div id="src_pages_ResetPassword_field1">
              <label id="src_pages_ResetPassword_label1" htmlFor="newPassword" className="block text-sm font-medium text-white/80 mb-2">
                New Password
              </label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                required
                className="input-field"
                placeholder="••••••••"
              />
            </div>

            <div id="src_pages_ResetPassword_field2">
              <label id="src_pages_ResetPassword_label2" htmlFor="confirmPassword" className="block text-sm font-medium text-white/80 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="input-field"
                placeholder="••••••••"
              />
            </div>

            <button
              id="src_pages_ResetPassword_submit" type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
