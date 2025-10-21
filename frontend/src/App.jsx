import React from "react"
import "./App.css"
import { WavyBackground } from "@/components/ui/wavy-background"
import { HeroHighlight, Highlight } from "@/components/ui/hero-highlight"
import { FloatingNav } from "@/components/ui/floating-navbar"
import { motion } from "framer-motion"
import { Home, User, MessageSquare } from "lucide-react"
import { Routes, Route, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

function App() {
  const location = useLocation();
  const navItems = [
    { name: "Home", link: "/", icon: <Home className="h-4 w-4 text-neutral-500 dark:text-white" /> },
    { name: "About", link: "/about", icon: <User className="h-4 w-4 text-neutral-500 dark:text-white" /> },
    // { name: "Contact", link: "/contact", icon: <MessageSquare className="h-4 w-4 text-neutral-500 dark:text-white" /> },
  ];

  return (
    <div className="dark bg-black text-white min-h-screen">
      {/* Hide the floating nav on the dashboard (/about) page */}
      {location.pathname !== "/about" && <FloatingNav navItems={navItems} />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/about" element={<Dashboard />} />
        <Route
          path="/"
          element={
            <HeroHighlight>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.22, 0.61, 0.36, 1], delay: 0.4 }}
                className="text-2xl px-4 md:text-4xl lg:text-5xl font-bold text-neutral-700 dark:text-white max-w-6xl leading-relaxed lg:leading text-center mx-auto "
              >
                <div className="text-6xl">Bed Manager</div>
                <div className="text-xl leading-10">Real-time clarity for <Highlight className="text-black dark:text-white"> critical decisions.</Highlight></div>
              </motion.h1>
              <motion.footer
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.22, 0.61, 0.36, 1], delay: 0.9 }}
                className="fixed bottom-0 left-0 w-full text-center py-4 text-sm font-normal text-neutral-500 dark:text-neutral-400 bg-transparent"
              >
                Built by Team 25 with ❤️
              </motion.footer>
            </HeroHighlight>
          }
        />
      </Routes>
    </div>
  )
}

export default App
