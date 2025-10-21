"use client";;
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";

const SidebarContext = createContext(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...(props)} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <motion.div
      className={cn(
        "h-full px-4 py-4 hidden md:flex md:flex-col bg-neutral-100 dark:bg-neutral-800 w-[300px] flex-shrink-0",
        className
      )}
      animate={{
        width: animate ? (open ? "300px" : "80px") : "300px",
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}>
      {children}
    </motion.div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}) => {
  const { open, setOpen } = useSidebar();
  return (
    <>
      <div
        className={cn(
          "h-10 px-4 py-4 flex flex-row md:hidden items-center justify-between bg-neutral-100 dark:bg-neutral-800 w-full"
        )}
        {...props}>
        <div className="flex justify-end z-20 w-full">
          <Menu
            className="text-neutral-800 dark:text-neutral-200 cursor-pointer"
            onClick={() => setOpen(!open)} />
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: "easeInOut",
              }}
              className={cn(
                "fixed h-full w-full inset-0 bg-white dark:bg-neutral-900 p-10 z-[100] flex flex-col justify-between",
                className
              )}>
              <div
                className="absolute right-10 top-10 z-50 text-neutral-800 dark:text-neutral-200 cursor-pointer"
                onClick={() => setOpen(!open)}>
                <X />
              </div>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
  ...props
}) => {
  const { open, animate } = useSidebar();
  return (
    <Link
      to={link.href}
      className={cn("flex items-center justify-start gap-2 group/sidebar py-3 px-3", className)}
      {...props}>
      {/* fixed-size icon container so icon remains visible when sidebar is collapsed */}
      <span className="h-6 w-6 flex-shrink-0 text-neutral-700 dark:text-neutral-200 flex items-center justify-center">
        {link.icon}
      </span>

      {/* label: absolutely positioned so it does not reflow the icon when toggling open state */}
      <div className="relative flex-1">
        <motion.span
          aria-hidden={!open}
          animate={{
            opacity: animate ? (open ? 1 : 0) : 1,
            x: animate ? (open ? 0 : -3) : 0,
          }}
          transition={{ duration: 0.18 }}
          className={cn(
            "absolute left-5 top-1/2 -translate-y-1/2 text-neutral-700 dark:text-neutral-200 text-sm transition-transform duration-150 whitespace-pre group-hover/sidebar:translate-x-1",
            !open && "pointer-events-none"
          )}
        >
          {link.label}
        </motion.span>
      </div>
    </Link>
  );
};

// Simple Logo components used in the Dashboard
export const Logo = () => {
  const { open, animate } = useSidebar();
  return (
    <div className="group/sidebar flex items-center justify-start gap-2 py-2 px-3">
      <span className="h-6 w-6 flex-shrink-0 bg-white/90 rounded-md" />
      <div className="relative flex-1">
        <motion.span
          aria-hidden={!open}
          animate={{
            opacity: animate ? (open ? 1 : 0) : 1,
            x: animate ? (open ? 0 : -3) : 0,
          }}
          transition={{ duration: 0.18 }}
          className={cn(
            "absolute left-5 top-1/2 -translate-y-1/2 font-medium text-neutral-700 dark:text-neutral-200 text-sm whitespace-pre transition-transform duration-150 group-hover/sidebar:translate-x-1",
            !open && "pointer-events-none"
          )}
        >
          Bed Manager
        </motion.span>
      </div>
    </div>
  );
};

export const LogoIcon = () => (
  <div className="flex items-center gap-2 px-3 py-2">
    <div className="h-6 w-6 bg-white/90 rounded-md" />
  </div>
);

export const ProfileLink = () => {
  const { open, animate } = useSidebar();
  return (
    <div className="group/sidebar flex items-center justify-start gap-2 py-4 px-3">
      <span className="h-6 w-6 rounded-full bg-sky-500 flex-shrink-0" />
      <div className="relative flex-1">
        <motion.span
          aria-hidden={!open}
          animate={{
            opacity: animate ? (open ? 1 : 0) : 1,
            x: animate ? (open ? 0 : -3) : 0,
          }}
          transition={{ duration: 0.18 }}
          className={cn(
            "absolute left-5 top-1/2 -translate-y-1/2 text-neutral-700 dark:text-neutral-200 text-sm whitespace-pre transition-transform duration-150 group-hover/sidebar:translate-x-1",
            !open && "pointer-events-none"
          )}
        >
          John Doe
        </motion.span>
      </div>
    </div>
  );
};
