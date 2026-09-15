import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectCurrentUser, selectIsAuthenticated, logout } from '@/features/auth/authSlice';
import api from '@/services/api';
import {
    Sidebar,
    SidebarBody,
    SidebarLink,
    Logo,
    ProfileLink,
} from "@/components/ui/sidebar";
import { Home, Settings, BarChart2, Bell } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { BedSelection } from '@/components/ui/bed-selection';
import {
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

// Wards in the hospital's usual order; any other ward follows alphabetically
const WARD_ORDER = ['ICU', 'General', 'Emergency'];
const wardRank = (ward) => (WARD_ORDER.includes(ward) ? WARD_ORDER.indexOf(ward) : WARD_ORDER.length);
const byNaturalOrder = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });

// Bed map built from the beds in the database: a section per ward and a row per bed ID prefix (e.g. "iA" in "iA5")
const buildBedLayout = (beds) => {
    const wards = new Map();
    beds.forEach((bed) => {
        const match = /^(.*?)-?(\d+)$/.exec(bed.bedId);
        const rowId = match && match[1] ? match[1] : bed.ward;
        if (!wards.has(bed.ward)) wards.set(bed.ward, new Map());
        const rows = wards.get(bed.ward);
        if (!rows.has(rowId)) rows.set(rowId, []);
        rows.get(rowId).push({ id: bed.bedId, number: match ? Number(match[2]) : bed.bedId });
    });

    return [...wards.entries()]
        .sort(([a], [b]) => wardRank(a) - wardRank(b) || a.localeCompare(b))
        .map(([ward, rows]) => ({
            categoryName: ward,
            rows: [...rows.entries()]
                .sort(([a], [b]) => byNaturalOrder(a, b))
                .map(([rowId, rowBeds]) => ({ rowId, beds: rowBeds.sort((a, b) => byNaturalOrder(a.id, b.id)) })),
        }));
};

const Legend = () => (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-4 p-4 rounded-md border bg-card text-card-foreground">
        <div className="flex items-center gap-2"><div className="w-5 h-5 rounded border-emerald-600 bg-emerald-600" /><span className="text-sm">Available</span></div>
        <div className="flex items-center gap-2"><div className="w-5 h-5 rounded border-primary bg-primary" /><span className="text-sm">Selected</span></div>
        <div className="flex items-center gap-2"><div className="w-5 h-5 rounded border-red-600 bg-red-600" /><span className="text-sm">Occupied</span></div>
        <div className="flex items-center gap-2"><div className="w-5 h-5 rounded border-yellow-500 bg-yellow-500" /><span className="text-sm">Cleaning</span></div>
    </div>
);

function Dashboard() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const currentUser = useSelector(selectCurrentUser);
    const isAuthenticated = useSelector(selectIsAuthenticated);
    const [selectedBeds, setSelectedBeds] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('ALL');
    const [isBooking, setIsBooking] = useState(false);
    const [allBeds, setAllBeds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [showSettings, setShowSettings] = useState(false);

    const links = [
        { label: "Overview", href: "#overview", icon: <BarChart2 className="h-4 w-4" /> },
        { label: "Requests", href: "#requests", icon: <Bell className="h-4 w-4" /> },
        {
            label: "Settings",
            href: "#settings",
            icon: <Settings className="h-4 w-4" />,
            onClick: (e) => {
                e.preventDefault();
                setShowSettings(true);
            }
        },
        {
            label: "Logout",
            href: "/login",
            icon: <Home className="h-4 w-4" />,
            onClick: (e) => {
                e.preventDefault();
                // Clear session and logout
                dispatch(logout());
                navigate('/login');
            }
        },
    ];

    // Fetch beds from backend on mount
    useEffect(() => {
        fetchBeds();
    }, []);

    const fetchBeds = async () => {
        try {
            setLoading(true);
            const response = await api.get('/beds');
            setAllBeds(response.data?.data?.beds || []);
            setLoadError(null);
        } catch (error) {
            console.error('Error fetching beds:', error);
            setLoadError(error.response?.data?.message || 'Could not load beds from the server');
        } finally {
            setLoading(false);
        }
    };

    const occupiedBeds = useMemo(() => allBeds.filter(bed => bed.status === 'occupied').map(bed => bed.bedId), [allBeds]);
    const cleaningBeds = useMemo(() => allBeds.filter(bed => bed.status === 'cleaning').map(bed => bed.bedId), [allBeds]);
    const bedLayout = useMemo(() => buildBedLayout(allBeds), [allBeds]);

    const filteredLayout = useMemo(() => {
        if (selectedCategory === 'ALL') return bedLayout;
        return bedLayout.filter((c) => c.categoryName === selectedCategory);
    }, [bedLayout, selectedCategory]);

    const categories = useMemo(() => ['ALL', ...bedLayout.map(c => c.categoryName)], [bedLayout]);

    const handleBedSelect = (bedId) => {
        // Prevent selecting occupied beds or beds being cleaned
        if (occupiedBeds.includes(bedId)) {
            alert(`Bed ${bedId} is already occupied and cannot be selected.`);
            return;
        }
        if (cleaningBeds.includes(bedId)) {
            alert(`Bed ${bedId} is being cleaned and cannot be selected yet.`);
            return;
        }
        setSelectedBeds((prev) => prev.includes(bedId) ? prev.filter(id => id !== bedId) : [...prev, bedId]);
    };

    const handleProceedToBook = async () => {
        if (selectedBeds.length === 0) {
            alert("Please select at least one bed to proceed.");
            return;
        }

        // Check if user is logged in
        if (!isAuthenticated || !currentUser) {
            alert("Please log in to book beds.");
            navigate('/login');
            return;
        }

        // Staff can assign beds - prompt for patient information
        const patientName = prompt("Enter patient name:");
        if (!patientName || patientName.trim() === '') {
            alert("Patient name is required to assign a bed.");
            return;
        }

        const patientId = prompt("Enter patient ID (optional):");

        // Double-check no unavailable beds are selected
        const invalidBeds = selectedBeds.filter(bedId => occupiedBeds.includes(bedId) || cleaningBeds.includes(bedId));
        if (invalidBeds.length > 0) {
            alert(`Cannot book beds that are occupied or being cleaned: ${invalidBeds.join(', ')}`);
            setSelectedBeds(selectedBeds.filter(bedId => !invalidBeds.includes(bedId)));
            return;
        }

        setIsBooking(true);

        try {
            const results = [];
            const errors = [];

            // Book each bed via backend API
            for (const bedId of selectedBeds) {
                try {
                    const response = await api.patch(`/beds/${bedId}/status`, {
                        status: 'occupied',
                        patientName: patientName.trim(),
                        patientId: patientId?.trim() || null
                    });
                    results.push({ bedId, success: true, data: response.data });
                } catch (error) {
                    console.error(`Failed to book bed ${bedId}:`, error);
                    const errorMsg = error.response?.data?.message ||
                        error.response?.data?.errors?.[0]?.message ||
                        'Booking failed';
                    errors.push({ bedId, error: errorMsg });
                }
            }

            // Show results
            if (errors.length === 0) {
                alert(`✅ Successfully booked ${results.length} bed(s):\n${selectedBeds.join(', ')}`);
                setSelectedBeds([]);
            } else {
                const successCount = results.length;
                const errorCount = errors.length;
                const errorDetails = errors.map(e => `${e.bedId}: ${e.error}`).join('\n');

                alert(
                    `Booking completed with some errors:\n\n` +
                    `✅ Success: ${successCount} bed(s)\n` +
                    `❌ Failed: ${errorCount} bed(s)\n\n` +
                    `Failed beds:\n${errorDetails}`
                );

                // Remove successfully booked beds from selection
                setSelectedBeds(errors.map(e => e.bedId));
            }

            // Refresh bed data from backend so the map shows the saved statuses
            await fetchBeds();
        } catch (error) {
            console.error('Booking error:', error);
            alert('Failed to process booking. Please try again.');
        } finally {
            setIsBooking(false);
        }
    };

    // Pricing removed for hospital bed allocation; no totalPrice calculation

    return (
        <Sidebar>
            <div className="flex h-screen w-full bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50">
                <SidebarBody className="flex-col justify-between">
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
                </SidebarBody>

                <div className="flex-1 p-8 overflow-auto">
                    <div className="w-full max-w-5xl mx-auto flex flex-col md:flex-row items-center md:items-start justify-between mb-6 gap-4">
                        <div className="w-full md:w-auto text-center md:text-left">
                            <h1 className="text-4xl font-bold">Dashboard</h1>
                            <p className="text-md text-neutral-600 dark:text-neutral-300">
                                {loading ? 'Loading beds...' : `Select available beds to book`}
                            </p>
                        </div>

                        <div className="flex gap-2 items-center">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={fetchBeds}
                                disabled={loading}
                            >
                                {loading ? 'Refreshing...' : 'Refresh'}
                            </Button>
                            <div className="w-48">
                                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Show All" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map(cat => (
                                            <SelectItem key={cat} value={cat}>{cat === 'ALL' ? 'Show All' : cat}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="w-full max-w-5xl mx-auto flex flex-col items-center py-4">
                        {loadError && (
                            <div className="w-full mb-4 p-4 rounded-md border border-red-500/40 bg-red-500/10 text-center">
                                <p className="text-sm text-red-500">{loadError}</p>
                                <Button variant="outline" size="sm" className="mt-2" onClick={fetchBeds} disabled={loading}>
                                    Try again
                                </Button>
                            </div>
                        )}

                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                                    <p className="text-neutral-600 dark:text-neutral-400">Loading beds...</p>
                                </div>
                            </div>
                        ) : allBeds.length === 0 ? (
                            !loadError && (
                                <p className="py-20 text-neutral-600 dark:text-neutral-400">No beds have been added yet.</p>
                            )
                        ) : (
                            <>
                                <BedSelection
                                    key={`${selectedCategory}-${occupiedBeds.length}-${cleaningBeds.length}`}
                                    layout={filteredLayout}
                                    selectedBeds={selectedBeds}
                                    occupiedBeds={occupiedBeds}
                                    cleaningBeds={cleaningBeds}
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
                                            <Button
                                                className="w-full mt-4"
                                                onClick={handleProceedToBook}
                                                disabled={isBooking}
                                            >
                                                {isBooking ? 'Processing...' : 'Proceed to Book'}
                                            </Button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowSettings(false)}>
                    <div className="bg-neutral-900 border border-zinc-800 rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-white">User Profile</h2>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="text-zinc-400 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-zinc-400">Name</label>
                                <p className="text-white font-medium">{currentUser?.name || 'N/A'}</p>
                            </div>

                            <div>
                                <label className="text-sm text-zinc-400">Email</label>
                                <p className="text-white font-medium">{currentUser?.email || 'N/A'}</p>
                            </div>

                            <div>
                                <label className="text-sm text-zinc-400">Role</label>
                                <p className="text-white font-medium capitalize">
                                    {currentUser?.role?.replace(/_/g, ' ') || 'N/A'}
                                </p>
                            </div>

                            <div>
                                <label className="text-sm text-zinc-400">User ID</label>
                                <p className="text-white font-mono text-xs">{currentUser?.id || 'N/A'}</p>
                            </div>
                        </div>

                        <div className="mt-6 flex gap-2">
                            <Button
                                onClick={() => setShowSettings(false)}
                                className="flex-1"
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Sidebar>
    );
}

export default Dashboard;
