import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { authService } from "../services/authService";
import toast from "react-hot-toast";

interface LoginFormData {
  email: string;
  password: string;
}

const Login: React.FC = () => {
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: ""
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [magicLinkMode, setMagicLinkMode] = useState<boolean>(false);
  const [searchParams] = useSearchParams();
  const { login, loginWithMagicLink } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");
    const email = searchParams.get("email");

    if (token && email) {
      handleMagicLinkVerification(token, email);
    }
  }, [searchParams]);

  const handleMagicLinkVerification = async (token: string, email: string): Promise<void> => {
    setLoading(true);
    try {
      await loginWithMagicLink(token, email);
      toast.success("Successfully logged in with magic link!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Magic link verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setLoading(true);

    try {
      if (magicLinkMode) {
        await authService.sendMagicLink(formData.email);
        toast.success("Magic link sent! Check your email.");
      } else {
        await login(formData.email, formData.password);
        toast.success("Login successful!");
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = (provider: string): void => {
    toast.info(`OAuth with ${provider} - Integration pending`);
    // TODO: Implement OAuth flow with passport
  };

  return (
    <div id="src_pages_Login_g9oz" className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div id="src_pages_Login_1qdu" className="max-w-md w-full">
        <div id="src_pages_Login_gfv3" className="text-center mb-8">
          <h2 id="src_pages_Login_qer0" className="text-3xl font-bold text-gray-900">Welcome Back</h2>
          <p id="src_pages_Login_iqb3" className="mt-2 text-gray-600">Sign in to your account</p>
        </div>

        <div id="src_pages_Login_fql5" className="card">
          <form id="src_pages_Login_8vpj" onSubmit={handleSubmit} className="space-y-6">
            <div id="src_pages_Login_yd3x">
              <label id="src_pages_Login_9cjc" htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="input-field"
                placeholder="you@example.com"
              />
            </div>

            {!magicLinkMode && (
              <div id="src_pages_Login_rz0d">
                <label id="src_pages_Login_kuv1" htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="input-field"
                  placeholder="••••••••"
                />
              </div>
            )}

            <div id="src_pages_Login_mode_toggle" className="text-center">
              <button
                id="src_pages_Login_t4vg" type="button"
                onClick={() => setMagicLinkMode(!magicLinkMode)}
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                {magicLinkMode ? "Use password instead" : "Use magic link instead"}
              </button>
            </div>

            <button
              id="src_pages_Login_yt6z" type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (magicLinkMode ? "Sending..." : "Signing in...") : (magicLinkMode ? "Send Magic Link" : "Sign In")}
            </button>

            <div id="src_pages_Login_oauth_divider" className="relative my-6">
              <div id="src_pages_Login_j1zd" className="absolute inset-0 flex items-center">
                <div id="src_pages_Login_p9hm" className="w-full border-t border-gray-300"></div>
              </div>
              <div id="src_pages_Login_9zrq" className="relative flex justify-center text-sm">
                <span id="src_pages_Login_gek5" className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <div id="src_pages_Login_oauth_buttons" className="space-y-3">
              <button
                id="src_pages_Login_r1ey" type="button"
                onClick={() => handleOAuthLogin("google")}
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <svg id="src_pages_Login_m4nk" className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path id="src_pages_Login_9qkb" fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path id="src_pages_Login_m2kh" fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path id="src_pages_Login_nc9s" fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path id="src_pages_Login_i4gt" fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <button
                id="src_pages_Login_cop9" type="button"
                onClick={() => handleOAuthLogin("github")}
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <svg id="src_pages_Login_2vic" className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path id="src_pages_Login_0awl" fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
                </svg>
                Continue with GitHub
              </button>
            </div>
          </form>

          <div id="src_pages_Login_z8si" className="mt-6 text-center">
            <p id="src_pages_Login_p4ij" className="text-sm text-gray-600">
              Don't have an account?{" "}
              <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
