import React from "react";
import {
    Sidebar,
    DesktopSidebar,
    MobileSidebar,
    SidebarBody,
    SidebarLink,
    Logo,
    LogoIcon,
    ProfileLink,
} from "@/components/ui/sidebar";
import { Home, Settings, Users, BarChart2 } from "lucide-react";

const links = [
    { label: "Overview", href: "#overview", icon: <BarChart2 className="h-4 w-4" /> },
    { label: "Settings", href: "#settings", icon: <Settings className="h-4 w-4" /> },
    { label: "Logout", href: "/login", icon: <Home className="h-4 w-4" /> },
];

export default function Dashboard() {
    return (
        <Sidebar>
            <div className="flex h-screen w-full bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50">
                <DesktopSidebar className="hidden md:flex flex-col justify-between">
                    <div className="flex flex-col gap-2">
                        {/* Logo */}
                        <div className="mt-2"><Logo /></div>

                        <div className="mt-6 flex flex-col gap-2 px-1">
                            {links.map((l) => (
                                <SidebarLink key={l.href} link={l} className="rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800" />
                            ))}
                        </div>
                    </div>

                    {/* Profile */}
                    <div className="mb-4">
                        <ProfileLink />
                    </div>
                </DesktopSidebar>

                {/* Mobile header / drawer handled by MobileSidebar inside the SidebarBody if needed */}
                <div className="flex-1 p-8 overflow-auto">
                    <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
                    <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-6">This is the dashboard main area. Replace with charts, tables and widgets.</p>

                    <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-6 rounded-lg bg-white/5 border border-neutral-200/5">Placeholder widget 1</div>
                        <div className="p-6 rounded-lg bg-white/5 border border-neutral-200/5">Placeholder widget 2</div>
                    </section>
                </div>
            </div>
        </Sidebar>
    );
}
