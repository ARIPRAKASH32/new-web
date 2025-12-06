// MechCare - Main Application Logic
// Frontend-only version with localStorage

const MechCare = (() => {
    const STORAGE_KEY = 'mechcare_data';

    // Demo data - sample machines
    const DEMO_MACHINES = [
        {
            id: 'm1',
            name: 'CNC Mill 3000',
            type: 'CNC Milling Machine',
            interval: 30,
            lastMaintenance: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
            installedDate: '2023-01-15',
            location: 'Workshop A',
            manufacturer: 'Haas Automation',
            model: 'VF-3'
        },
        {
            id: 'm2',
            name: 'Hydraulic Press HP-500',
            type: 'Hydraulic Press',
            interval: 45,
            lastMaintenance: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(), // 40 days ago
            installedDate: '2022-06-20',
            location: 'Workshop B',
            manufacturer: 'Schuler',
            model: 'HP-500'
        },
        {
            id: 'm3',
            name: 'Lathe Machine LT-200',
            type: 'CNC Lathe',
            interval: 60,
            lastMaintenance: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString(), // 70 days ago (overdue)
            installedDate: '2021-03-10',
            location: 'Workshop A',
            manufacturer: 'DMG MORI',
            model: 'NLX-2500'
        },
        {
            id: 'm4',
            name: 'Welding Robot WR-100',
            type: 'Robotic Welder',
            interval: 90,
            lastMaintenance: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
            installedDate: '2023-08-05',
            location: 'Assembly Line 1',
            manufacturer: 'FANUC',
            model: 'ARC Mate 100iD'
        },
        {
            id: 'm5',
            name: 'Conveyor Belt CB-50',
            type: 'Conveyor System',
            interval: 30,
            lastMaintenance: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), // 25 days ago
            installedDate: '2022-11-12',
            location: 'Assembly Line 2',
            manufacturer: 'Dorner',
            model: '2200 Series'
        },
        {
            id: 'm6',
            name: 'Air Compressor AC-750',
            type: 'Air Compressor',
            interval: 120,
            lastMaintenance: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 days ago
            installedDate: '2020-05-18',
            location: 'Utility Room',
            manufacturer: 'Atlas Copco',
            model: 'GA 75'
        }
    ];

    // Demo logs
    const DEMO_LOGS = [
        {
            id: 'log1',
            machineId: 'm1',
            date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            type: 'Routine Maintenance',
            description: 'Replaced coolant, cleaned filters, checked alignment',
            technician: 'John Smith',
            cost: 250
        },
        {
            id: 'log2',
            machineId: 'm2',
            date: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
            type: 'Routine Maintenance',
            description: 'Hydraulic fluid change, pressure test',
            technician: 'Sarah Johnson',
            cost: 450
        },
        {
            id: 'log3',
            machineId: 'm3',
            date: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString(),
            type: 'Routine Maintenance',
            description: 'Spindle inspection, tool holder cleaning',
            technician: 'Mike Davis',
            cost: 320
        }
    ];

    // Initialize data from localStorage or use demo data
    function initializeData() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error('Error parsing stored data:', e);
            }
        }
        // Return demo data if nothing in localStorage
        return {
            machines: DEMO_MACHINES,
            logs: DEMO_LOGS
        };
    }

    // Save data to localStorage
    function saveData(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    // Get current data
    function getData() {
        return initializeData();
    }

    // Calculate machine status based on maintenance schedule
    function getMachineStatus(machine) {
        const lastMaint = new Date(machine.lastMaintenance);
        const now = new Date();
        const daysSinceMaint = Math.floor((now - lastMaint) / (1000 * 60 * 60 * 24));
        const daysUntilNext = machine.interval - daysSinceMaint;

        if (daysUntilNext < 0) {
            return {
                status: 'Overdue',
                color: 'danger',
                days: Math.abs(daysUntilNext)
            };
        } else if (daysUntilNext <= 7) {
            return {
                status: 'Due Soon',
                color: 'accent',
                days: daysUntilNext
            };
        } else {
            return {
                status: 'Healthy',
                color: 'success',
                days: daysUntilNext
            };
        }
    }

    // Public API
    return {
        // Get all machines
        getAllMachines() {
            const data = getData();
            return data.machines || [];
        },

        // Get single machine by ID
        getMachine(id) {
            const data = getData();
            return data.machines.find(m => m.id === id) || null;
        },

        // Add new machine
        addMachine(machineData) {
            const data = getData();
            const newMachine = {
                id: 'm' + Date.now(),
                ...machineData,
                installedDate: machineData.installedDate || new Date().toISOString().split('T')[0]
            };
            data.machines.push(newMachine);
            saveData(data);
            return newMachine;
        },

        // Update machine
        updateMachine(id, machineData) {
            const data = getData();
            const index = data.machines.findIndex(m => m.id === id);
            if (index !== -1) {
                data.machines[index] = { ...data.machines[index], ...machineData };
                saveData(data);
                return data.machines[index];
            }
            return null;
        },

        // Delete machine
        deleteMachine(id) {
            const data = getData();
            const index = data.machines.findIndex(m => m.id === id);
            if (index !== -1) {
                data.machines.splice(index, 1);
                // Also delete associated logs
                data.logs = data.logs.filter(log => log.machineId !== id);
                saveData(data);
                return true;
            }
            return false;
        },

        // Get machine status
        getMachineStatus,

        // Get logs for a machine
        getLogsForMachine(machineId) {
            const data = getData();
            return (data.logs || []).filter(log => log.machineId === machineId);
        },

        // Get all logs
        getAllLogs() {
            const data = getData();
            return data.logs || [];
        },

        // Add log entry
        addLog(logData) {
            const data = getData();
            const newLog = {
                id: 'log' + Date.now(),
                date: new Date().toISOString(),
                ...logData
            };
            if (!data.logs) data.logs = [];
            data.logs.push(newLog);

            // Update machine's lastMaintenance if this is a maintenance log
            if (logData.type === 'Routine Maintenance' || logData.type === 'Repair') {
                const machine = data.machines.find(m => m.id === logData.machineId);
                if (machine) {
                    machine.lastMaintenance = newLog.date;
                }
            }

            saveData(data);
            return newLog;
        },

        // Delete log
        deleteLog(id) {
            const data = getData();
            const index = data.logs.findIndex(log => log.id === id);
            if (index !== -1) {
                data.logs.splice(index, 1);
                saveData(data);
                return true;
            }
            return false;
        },

        // Export all data
        exportData() {
            return getData();
        },

        // Import data
        importData(importedData) {
            saveData(importedData);
            return true;
        },

        // Reset to demo data
        resetToDemo() {
            const demoData = {
                machines: DEMO_MACHINES,
                logs: DEMO_LOGS
            };
            saveData(demoData);
            return true;
        }
    };
})();

// Initialize on page load
console.log('MechCare initialized with', MechCare.getAllMachines().length, 'machines');
