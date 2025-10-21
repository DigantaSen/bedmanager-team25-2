import React from "react"
import "./App.css"
import { WavyBackground } from "@/components/ui/wavy-background"
import { FloatingNav } from "@/components/ui/floating-navbar"
import { Home, User, MessageSquare } from "lucide-react"

function App() {
  const navItems = [
    { name: "Home", link: "/", icon: <Home className="h-4 w-4 text-neutral-500 dark:text-white" /> },
    { name: "About", link: "/about", icon: <User className="h-4 w-4 text-neutral-500 dark:text-white" /> },
    { name: "Contact", link: "/contact", icon: <MessageSquare className="h-4 w-4 text-neutral-500 dark:text-white" /> },
  ];

  return (
    <div className="bg-black text-white min-h-screen">
      <FloatingNav navItems={navItems} />
      <WavyBackground className="max-w-4xl mx-auto pb-40" backgroundFill="black" blur={12} speed="fast" waveOpacity={0.6}>
        <p className="text-2xl md:text-4xl lg:text-7xl text-white font-bold inter-var text-center">
          Bed Manager
        </p>
        <p className="text-base md:text-lg mt-4 text-white font-normal inter-var text-center">
          Real-Time Hospital Bed and ICU Occupancy Management
          Dashboard
        </p>
      </WavyBackground>
    </div>
  )
}

export default App
