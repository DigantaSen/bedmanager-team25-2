"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { cn } from "@/lib/utils";
import { Link } from 'react-router-dom'

export const FloatingNav = ({ navItems, className }) => {
    // Always visible by default
    const [visible] = useState(true);

    return (
        <AnimatePresence mode="wait">
            <motion.div
                initial={{ opacity: 1, y: 0, scale: 1 }}
                animate={{ y: visible ? 0 : -100, opacity: visible ? 1 : 0, scale: 1 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className={cn(
                    // dark, slightly translucent pill with backdrop blur for legibility
                    "fixed top-10 inset-x-0 mx-auto max-w-fit rounded-full bg-black/75 backdrop-blur-sm border border-white/10 text-white shadow-lg z-[5000] pr-3 pl-8 py-2 flex items-center justify-center space-x-4",
                    className
                )}
            >
                {navItems?.map((navItem, idx) => (
                    <Link
                        key={`link=${idx}`}
                        to={navItem.link}
                        className={cn(
                            "relative items-center flex space-x-1 text-white hover:text-neutral-200",
                        )}
                    >
                        <span className="block sm:hidden">{navItem.icon}</span>
                        <span className="hidden sm:block text-sm font-medium">{navItem.name}</span>
                    </Link>
                ))}
                <Link to="/login" className="relative text-sm font-medium px-4 py-2 rounded-full bg-white/8 border border-white/20 text-white hover:bg-white/12">
                    <span>Login</span>
                    <span className="absolute inset-x-0 w-1/2 mx-auto -bottom-px bg-gradient-to-r from-transparent via-sky-400 to-transparent h-px" />
                </Link>
            </motion.div>
        </AnimatePresence>
    );
};
