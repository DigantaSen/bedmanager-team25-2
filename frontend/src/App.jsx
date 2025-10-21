import React from "react"
import "./App.css"
import { WavyBackground } from "@/components/ui/wavy-background"
import { HeroHighlight, Highlight } from "@/components/ui/hero-highlight"
import { FloatingNav } from "@/components/ui/floating-navbar"
import { motion } from "framer-motion"
import { Home, User, MessageSquare } from "lucide-react"

function App() {
  const navItems = [
    { name: "Home", link: "/", icon: <Home className="h-4 w-4 text-neutral-500 dark:text-white" /> },
    { name: "About", link: "/about", icon: <User className="h-4 w-4 text-neutral-500 dark:text-white" /> },
    // { name: "Contact", link: "/contact", icon: <MessageSquare className="h-4 w-4 text-neutral-500 dark:text-white" /> },
  ];

  return (
    <div className="dark bg-black text-white min-h-screen">
      <FloatingNav navItems={navItems} />
      <HeroHighlight>
        <motion.h1
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: [20, -5, 0],
          }}
          transition={{
            duration: 0.5,
            ease: [0.4, 0.0, 0.2, 1],
          }}
          className="text-2xl px-4 md:text-4xl lg:text-5xl font-bold text-neutral-700 dark:text-white max-w-6xl leading-relaxed lg:leading text-center mx-auto "
        >
          Bed Manager<br />Real-time clarity for <Highlight className="text-black dark:text-white"> critical decisions. </Highlight>
        </motion.h1>
      </HeroHighlight>
    </div>
  )
}

export default App
