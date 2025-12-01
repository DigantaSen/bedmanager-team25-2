import React, { useEffect } from "react"
import "./App.css"
import { WavyBackground } from "@/components/ui/wavy-background"
import { HeroHighlight, Highlight } from "@/components/ui/hero-highlight"
import { FloatingNav } from "@/components/ui/floating-navbar"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { motion } from "framer-motion"
import { Home, User, MessageSquare } from "lucide-react"
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { restoreSession, selectIsAuthenticated, selectAuthStatus, selectCurrentUser } from '@/features/auth/authSlice'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ProtectedRoute from './components/ProtectedRoute'
import AdminDashboard from './pages/AdminDashboard'
import ManagerDashboard from './pages/ManagerDashboard'
import StaffDashboard from './pages/StaffDashboard'
import OccupantStatusDashboard from './pages/OccupantStatusDashboard'
import ErStaffDashboard from './pages/ErStaffDashboard'
import ErStaffDashboardTest from './pages/ErStaffDashboardTest'
import Unauthorized from './pages/Unauthorized'
import Profile from './pages/Profile'

function App() {
  const location = useLocation();
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const currentUser = useSelector(selectCurrentUser);
  const authStatus = useSelector((state) => state.auth.status);
  const [hasCheckedSession, setHasCheckedSession] = React.useState(false);

  // Restore session on app load (only once)
  useEffect(() => {
    const checkSession = async () => {
      await dispatch(restoreSession());
      setHasCheckedSession(true);
    };
    if (!hasCheckedSession) {
      checkSession();
    }
  }, [dispatch, hasCheckedSession]);

  const navItems = [
    { name: "Home", link: "/", icon: <Home className="h-4 w-4 text-neutral-500 dark:text-white" /> },
    // { name: "About", link: "/about", icon: <User className="h-4 w-4 text-neutral-500 dark:text-white" /> },
    // { name: "Contact", link: "/contact", icon: <MessageSquare className="h-4 w-4 text-neutral-500 dark:text-white" /> },
  ];

  // Show floating nav on home page and login (when not authenticated)
  const shouldShowNav = !isAuthenticated;

  // Wait for session to be checked before rendering routes (except login page)
  if (!hasCheckedSession && location.pathname !== '/login') {
    return (
      <div className="dark bg-black text-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-neutral-400">Restoring session...</p>
        </div>
      </div>
    );
  }

  // Helper function to get role-based redirect path
  const getRoleDashboard = () => {
    if (!currentUser) return '/dashboard';
    switch (currentUser.role) {
      case 'hospital_admin':
        return '/admin/dashboard';
      case 'manager':
        return '/manager/dashboard';
      case 'ward_staff':
        return '/staff/dashboard';
      case 'er_staff':
        return '/er/dashboard';
      default:
        return '/dashboard';
    }
  };

  return (
    <div className="dark bg-black text-white min-h-screen">
      {shouldShowNav && <FloatingNav navItems={navItems} />}
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Home page - landing page for unauthenticated users */}
        <Route path="/" element={!isAuthenticated ? <HomePage /> : <Navigate to={getRoleDashboard()} />} />

        {/* Dashboard - only accessible when authenticated */}
        <Route
          path="/dashboard"
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />}
        />

        {/* Role-Based Dashboard Routes */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['hospital_admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/dashboard"
          element={
            <ProtectedRoute allowedRoles={['manager']}>
              <ManagerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/occupants"
          element={
            <ProtectedRoute allowedRoles={['manager', 'hospital_admin']}>
              <OccupantStatusDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/dashboard"
          element={
            <ProtectedRoute allowedRoles={['ward_staff']}>
              <StaffDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/er/dashboard"
          element={
            <ProtectedRoute allowedRoles={['er_staff']}>
              <ErStaffDashboard />
            </ProtectedRoute>
          }
        />

        {/* Profile Page - Accessible to all authenticated users */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute allowedRoles={['hospital_admin', 'manager', 'ward_staff', 'er_staff', 'technical_team']}>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* Unauthorized Access Page */}
        <Route path="/unauthorized" element={<Unauthorized />} />
      </Routes>
    </div>
  )
}

// Home page component for unauthenticated users
function HomePage() {
  const features = [
    {
      emoji: "⚡",
      title: "Real-time Updates",
      description: "Live bed status synchronization across all wards with instant notifications",
      span: "col-span-1 row-span-1"
    },
    {
      emoji: "📊",
      title: "Smart Analytics",
      description: "Data-driven insights on occupancy trends and forecasting for better planning",
      span: "col-span-1 row-span-1"
    },
    {
      emoji: "🔒",
      title: "Role-Based Access",
      description: "Secure, customized dashboards for ICU managers, ward staff, and administrators",
      span: "col-span-1 row-span-1"
    },
    {
      emoji: "🏥",
      title: "Ward Management",
      description: "Efficiently manage multiple wards with centralized bed allocation and tracking. Real-time visibility into bed availability, patient status, and operational workflows.",
      span: "col-span-2 row-span-1"
    },
    {
      emoji: "🚨",
      title: "Emergency Requests",
      description: "Quick emergency admission workflows with intelligent bed recommendations",
      span: "col-span-1 row-span-1"
    },
    {
      emoji: "📱",
      title: "Mobile Optimized",
      description: "Full functionality on tablets and mobile devices for on-the-go management",
      span: "col-span-1 row-span-1"
    },
    {
      emoji: "📈",
      title: "Advanced Forecasting",
      description: "Predictive analytics for discharge planning, staff scheduling, and capacity optimization",
      span: "col-span-2 row-span-1"
    }
  ];

  return (
    <HeroHighlight>
      {/* Header with generous padding to avoid navbar overlap */}
      <div className="pt-32 pb-12">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 0.61, 0.36, 1], delay: 0.4 }}
          className="text-2xl px-4 md:text-4xl lg:text-5xl font-bold text-neutral-700 dark:text-white max-w-6xl leading-relaxed lg:leading text-center mx-auto "
        >
          <div className="text-6xl">Bed Manager</div>
          <div className="text-xl leading-10">Real-time clarity for <Highlight className="text-black dark:text-white"> critical decisions.</Highlight></div>
        </motion.h1>
      </div>

      {/* Bento Grid Feature Cards - Responsive */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 0.61, 0.36, 1], delay: 0.6 }}
        className="max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-3 gap-4 auto-rows-max pb-20"
      >
        {features.map((feature, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 + index * 0.1 }}
            className={`${feature.span.replace('col-span-2', 'lg:col-span-2 col-span-1')}`}
          >
            <Card className="h-full border-neutral-800 bg-neutral-900 backdrop-blur hover:bg-neutral-800/50 transition-all hover:shadow-lg hover:shadow-neutral-700/20">
              <CardHeader>
                <div className="text-5xl mb-3">{feature.emoji}</div>
                <CardTitle className="text-white text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-300 text-sm leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Footer that appears at the bottom when scrolling */}
      <motion.footer
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 0.61, 0.36, 1], delay: 0.9 }}
        className="w-full text-center py-6 text-sm font-normal text-neutral-500 dark:text-neutral-400 bg-transparent"
      >
        Built by Team 25 with ❤️
      </motion.footer>
    </HeroHighlight>
  )
}

export default App
