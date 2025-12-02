"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Link, useLocation } from 'react-router-dom'

export const FloatingNav = ({ navItems, className }) => {
    const location = useLocation();
    const [visible] = useState(true);
    
    // Determine which item is active based on current path
    const isHomeActive = location.pathname === '/';
    const isLoginActive = location.pathname === '/login';

    return (
        <AnimatePresence mode="wait">
            <motion.div
                initial={{ opacity: 1, x: 0, scale: 1 }}
                animate={{ x: visible ? 0 : 0, opacity: visible ? 1 : 0, scale: 1 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className={cn(
                    "fixed top-10 left-1/2 -translate-x-1/2 max-w-fit rounded-full bg-neutral-950/75 backdrop-blur-sm border border-neutral-700/40 text-white shadow-lg z-[5000] px-4 py-2 flex items-center justify-center space-x-2",
                    className
                )}
            >
                <div className="relative flex items-center space-x-2">
                    {/* Sliding background indicator */}
                    <motion.div
                        className="absolute inset-y-0 rounded-full bg-white/10 border border-white/20"
                        initial={false}
                        animate={{
                            x: isLoginActive ? '100%' : '0%',
                            width: isLoginActive ? '80px' : '70px'
                        }}
                        transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 30
                        }}
                        style={{ left: 0 }}
                    />
                    
                    {/* Home Link */}
                    {navItems?.map((navItem, idx) => (
                        <Link
                            key={`link=${idx}`}
                            to={navItem.link}
                            className={cn(
                                "relative z-10 items-center flex space-x-1 px-4 py-2 rounded-full transition-colors",
                                isHomeActive ? "text-white" : "text-neutral-400 hover:text-neutral-200"
                            )}
                        >
                            <span className="block sm:hidden">{navItem.icon}</span>
                            <span className="hidden sm:block text-sm font-medium">{navItem.name}</span>
                        </Link>
                    ))}
                    
                    {/* Login Link */}
                    <Link 
                        to="/login" 
                        className={cn(
                            "relative z-10 text-sm font-medium px-4 py-2 rounded-full transition-colors",
                            isLoginActive ? "text-white" : "text-neutral-400 hover:text-neutral-200"
                        )}
                    >
                        <span>Login</span>
                    </Link>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
