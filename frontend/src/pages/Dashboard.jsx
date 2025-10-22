import React, { useState, useMemo } from "react";
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
import { motion, AnimatePresence } from 'framer-motion';
import { BedSelection } from '@/components/ui/bed-selection';
import { Button } from '@/components/ui/button';

const links = [
    { label: "Overview", href: "#overview", icon: <BarChart2 className="h-4 w-4" /> },
    { label: "Settings", href: "#settings", icon: <Settings className="h-4 w-4" /> },
    { label: "Logout", href: "/login", icon: <Home className="h-4 w-4" /> },
];

// Helper to generate beds for a row
const generateBeds = (start, end, rowId) => {
    const beds = [];
    for (let i = start; i <= end; i++) beds.push({ id: `${rowId}${i}`, number: i });
    return beds;
};

const bedLayoutData = [
    {
        categoryName: 'ICU',
        rows: [
            { rowId: 'iA', beds: [...generateBeds(1, 6, 'iA'), { id: 'iA-spacer', isSpacer: true }, ...generateBeds(7, 12, 'iA')] },
            { rowId: 'iB', beds: [...generateBeds(1, 6, 'iB'), { id: 'iB-spacer', isSpacer: true }, ...generateBeds(7, 12, 'iB')] },

        ],
    },
    {
        categoryName: 'FLOOR 1',
        rows: [
            { rowId: 'A', beds: [...generateBeds(1, 9, 'A'), { id: 'A-spacer', isSpacer: true }, ...generateBeds(10, 21, 'A')] },
            { rowId: 'B', beds: [...generateBeds(1, 9, 'B'), { id: 'B-spacer', isSpacer: true }, ...generateBeds(10, 21, 'B')] },
            { rowId: 'C', beds: [...generateBeds(1, 9, 'C'), { id: 'C-spacer', isSpacer: true }, ...generateBeds(10, 21, 'C')] },
            { rowId: 'D', beds: [...generateBeds(1, 9, 'D'), { id: 'D-spacer', isSpacer: true }, ...generateBeds(10, 21, 'D')] },
        ],
    },
    {
        categoryName: 'FLOOR 2',
        rows: [
            { rowId: 'E', beds: [...generateBeds(1, 9, 'E'), { id: 'E-spacer', isSpacer: true }, ...generateBeds(10, 21, 'E')] },
            { rowId: 'F', beds: [...generateBeds(1, 9, 'F'), { id: 'F-spacer', isSpacer: true }, ...generateBeds(10, 21, 'F')] },
            { rowId: 'G', beds: [...generateBeds(1, 9, 'G'), { id: 'G-spacer', isSpacer: true }, ...generateBeds(10, 21, 'G')] },
            { rowId: 'H', beds: [...generateBeds(1, 9, 'H'), { id: 'H-spacer', isSpacer: true }, ...generateBeds(10, 21, 'H')] },
        ],
    },
];

const Legend = () => (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-4 p-4 rounded-md border bg-card text-card-foreground">
        <div className="flex items-center gap-2"><div className="w-5 h-5 rounded border-emerald-600 bg-emerald-600" /><span className="text-sm">Available</span></div>
        <div className="flex items-center gap-2"><div className="w-5 h-5 rounded border-primary bg-primary" /><span className="text-sm">Selected</span></div>
        <div className="flex items-center gap-2"><div className="w-5 h-5 rounded border-red-600 bg-red-600" /><span className="text-sm">Occupied</span></div>
    </div>
);

export default function Dashboard() {
    const [selectedBeds, setSelectedBeds] = useState(['iA4']);
    const occupiedBeds = useMemo(() => ['F17', 'F18', 'F19', 'iA1', 'C2', 'C10', 'C11', 'E9'], []);

    const handleBedSelect = (bedId) => {
        setSelectedBeds((prev) => prev.includes(bedId) ? prev.filter(id => id !== bedId) : [...prev, bedId]);
    };

    // Pricing removed for hospital bed allocation; no totalPrice calculation

    return (
        <Sidebar>
            <div className="flex h-screen w-full bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50">
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

                <div className="flex-1 p-8 overflow-auto">
                    <h1 className="text-4xl font-bold mb-4">Dashboard</h1>
                    <p className="text-md text-neutral-600 dark:text-neutral-300 mb-6">Below is the bed selection demo.</p>

                    <div className="w-full max-w-5xl mx-auto flex flex-col items-center py-4">
                        <BedSelection
                            layout={bedLayoutData}
                            selectedBeds={selectedBeds}
                            occupiedBeds={occupiedBeds}
                            onBedSelect={handleBedSelect}
                        />

                        <Legend />

                        <AnimatePresence>
                            {selectedBeds.length > 0 && (
                                <motion.div
                                    className="mt-8 w-full max-w-md p-4 bg-card border rounded-lg shadow-lg"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <h3 className="text-lg font-semibold mb-2 text-foreground">Your Selection</h3>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {selectedBeds.slice().sort().map(bedId => (
                                            <span key={bedId} className="bg-primary text-primary-foreground text-sm font-medium px-3 py-1 rounded-full">
                                                {bedId}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="border-t pt-4" />
                                    <Button className="w-full mt-4">Proceed to Book</Button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </Sidebar>
    );
}
