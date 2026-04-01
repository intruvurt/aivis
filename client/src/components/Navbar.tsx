import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useDarkMode } from "../context/DarkModeContext";
import toast from "react-hot-toast";

const LOGO_URL = "https://teal-passing-reindeer-818.mypinata.cloud/ipfs/bafybeiadi7af2wdrseaualzvjkjm6gdswowwqp3bniznrfyf6o3cz2odfy?pinataGatewayToken=3QZVqN53_IqLl-7ymJB2F9etizklu216GT0QH8e-WThYkLBcwHhTVE-xZJITrwQn";

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  
  const isOnDashboardRoute = location.pathname !== '/' && location.pathname !== '/login' && location.pathname !== '/register';

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/");
    setMobileOpen(false);
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <nav id="src_components_Navbar_za5o" className="sticky top-0 z-50 bg-white dark:bg-gray-800 shadow-md transition-colors duration-200 backdrop-blur-xl bg-opacity-95 dark:bg-opacity-95">
      <div id="src_components_Navbar_0dff" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div id="src_components_Navbar_6crv" className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3 sm:gap-6">
            <Link to="/" className="flex items-center space-x-3" onClick={closeMobile}>
              <img
                src={LOGO_URL}
                alt="AiVis Logo"
                width={52}
                height={52}
                className="w-10 h-10 sm:w-[52px] sm:h-[52px] object-contain"
                id="src_components_Navbar_logo"
              />
              <span id="src_components_Navbar_3ccy" className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">AiVis</span>
            </Link>
            
            {/* Back to Home link when on dashboard routes — hidden on mobile */}
            {isOnDashboardRoute && (
              <Link
                to="/"
                className="hidden sm:flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Home
              </Link>
            )}
          </div>

          {/* Desktop nav */}
          <div id="src_components_Navbar_u1bf" className="hidden md:flex items-center space-x-4">
            <button
              id="src_components_Navbar_dm01"
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? (
                <svg id="src_components_Navbar_9lvf" className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path id="src_components_Navbar_et6v" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" fillRule="evenodd" clipRule="evenodd"></path>
                </svg>
              ) : (
                <svg id="src_components_Navbar_ah9j" className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path id="src_components_Navbar_p7xk" d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>
                </svg>
              )}
            </button>
            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  className="text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors px-3 py-2 min-h-[44px] inline-flex items-center"
                >
                  Dashboard
                </Link>
                <Link
                  to="/profile"
                  className="text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors px-3 py-2 min-h-[44px] inline-flex items-center"
                >
                  Profile
                </Link>
                <button
                  id="src_components_Navbar_os2c" onClick={handleLogout}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors min-h-[44px]"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors px-3 py-2 min-h-[44px] inline-flex items-center"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors min-h-[44px] inline-flex items-center"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 pb-4 pt-2 space-y-1">
          <button
            onClick={toggleDarkMode}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-h-[44px]"
          >
            {darkMode ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" fillRule="evenodd" clipRule="evenodd" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
            )}
            {darkMode ? 'Light mode' : 'Dark mode'}
          </button>
          {isOnDashboardRoute && (
            <Link to="/" onClick={closeMobile} className="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-h-[44px]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Home
            </Link>
          )}
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" onClick={closeMobile} className="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-h-[44px]">Dashboard</Link>
              <Link to="/profile" onClick={closeMobile} className="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-h-[44px]">Profile</Link>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors min-h-[44px] font-medium">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={closeMobile} className="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-h-[44px]">Login</Link>
              <Link to="/register" onClick={closeMobile} className="flex items-center gap-3 px-3 py-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors min-h-[44px] font-medium">Get Started</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
