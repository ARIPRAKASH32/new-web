/**********************************************
 * MECHCARE BACKEND SERVER - COMPLETE SYSTEM
 * Single File Backend for MechCare Application
 **********************************************/

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

// ========== CONFIGURATION ==========
const PORT = 3000;
const DATA_DIR = './data';
const DATA_FILE = path.join(__dirname, DATA_DIR, 'mechcare-data.json');

// ========== INITIALIZATION ==========
// Create Express app
const app = express();

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`✅ Created data directory: ${DATA_DIR}`);
}

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
        machines: [],
        logs: [],
        settings: {
            companyName: "MechCare Industrial",
            theme: "dark",
            notifications: true,
            language: "en",
            timezone: "UTC",
            version: "1.0.0"
        },
        stats: {
            totalMachines: 0,
            totalLogs: 0,
            lastBackup: null
        }
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    console.log(`✅ Created data file: ${DATA_FILE}`);
}

// ========== MIDDLEWARE ==========
app.use(cors()); // Enable CORS for all routes
app.use(bodyParser.json()); // Parse JSON bodies
app.use(express.static('.')); // Serve static files from current directory

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// ========== DATA HELPER FUNCTIONS ==========
function readData() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('❌ Error reading data:', error);
        return {
            machines: [],
            logs: [],
            settings: {},
            stats: { totalMachines: 0, totalLogs: 0 }
        };
    }
}

function writeData(data) {
    try {
        data.stats.totalMachines = data.machines.length;
        data.stats.totalLogs = data.logs.length;
        data.stats.lastBackup = new Date().toISOString();

        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('❌ Error writing data:', error);
        return false;
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ========== API ROUTES ==========

// 1. HEALTH CHECK
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'MechCare Backend',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        dataFile: DATA_FILE,
        endpoints: [
            '/api/health',
            '/api/machines',
            '/api/machines/:id',
            '/api/logs',
            '/api/data',
            '/api/stats',
            '/api/settings'
        ]
    });
});

// 2. MACHINES API
app.get('/api/machines', (req, res) => {
    const data = readData();
    res.json(data.machines);
});

app.get('/api/machines/:id', (req, res) => {
    const data = readData();
    const machine = data.machines.find(m => m.id === req.params.id);

    if (machine) {
        res.json(machine);
    } else {
        res.status(404).json({ error: 'Machine not found' });
    }
});

app.post('/api/machines', (req, res) => {
    const data = readData();
    const machineData = req.body;

    // Validate required fields
    if (!machineData.name || !machineData.type) {
        return res.status(400).json({ error: 'Name and type are required' });
    }

    const newMachine = {
        id: generateId(),
        name: machineData.name,
        type: machineData.type,
        userName: machineData.userName || 'Not assigned',
        mobileNumber: machineData.mobileNumber || 'Not provided',
        interval: parseInt(machineData.interval) || 30,
        lastMaintenance: machineData.lastMaintenance || new Date().toISOString().split('T')[0],
        runtimeHours: parseFloat(machineData.runtimeHours) || 0,
        location: machineData.location || 'Workshop A',
        status: 'operational',
        createdDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: machineData.notes || ''
    };

    data.machines.push(newMachine);

    if (writeData(data)) {
        res.status(201).json(newMachine);
    } else {
        res.status(500).json({ error: 'Failed to save machine' });
    }
});

app.put('/api/machines/:id', (req, res) => {
    const data = readData();
    const index = data.machines.findIndex(m => m.id === req.params.id);

    if (index === -1) {
        return res.status(404).json({ error: 'Machine not found' });
    }

    // Update machine with new data
    data.machines[index] = {
        ...data.machines[index],
        ...req.body,
        id: req.params.id, // Ensure ID doesn't change
        lastUpdated: new Date().toISOString()
    };

    if (writeData(data)) {
        res.json(data.machines[index]);
    } else {
        res.status(500).json({ error: 'Failed to update machine' });
    }
});

app.delete('/api/machines/:id', (req, res) => {
    const data = readData();
    const initialLength = data.machines.length;

    // Filter out the machine to delete
    data.machines = data.machines.filter(m => m.id !== req.params.id);

    if (data.machines.length < initialLength) {
        // Also delete associated logs
        data.logs = data.logs.filter(l => l.machineId !== req.params.id);

        if (writeData(data)) {
            res.json({
                success: true,
                message: 'Machine and associated logs deleted',
                deletedMachineId: req.params.id
            });
        } else {
            res.status(500).json({ error: 'Failed to delete machine' });
        }
    } else {
        res.status(404).json({ error: 'Machine not found' });
    }
});

// Get logs for specific machine
app.get('/api/machines/:id/logs', (req, res) => {
    const data = readData();
    const logs = data.logs
        .filter(l => l.machineId === req.params.id)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(logs);
});

// Update runtime hours for machine
app.patch('/api/machines/:id/runtime', (req, res) => {
    const data = readData();
    const machine = data.machines.find(m => m.id === req.params.id);

    if (!machine) {
        return res.status(404).json({ error: 'Machine not found' });
    }

    const additionalHours = parseFloat(req.body.hours);
    if (isNaN(additionalHours) || additionalHours < 0) {
        return res.status(400).json({ error: 'Valid hours value required' });
    }

    machine.runtimeHours = (machine.runtimeHours || 0) + additionalHours;
    machine.lastUpdated = new Date().toISOString();

    // Add a log entry for the runtime update
    data.logs.push({
        id: generateId(),
        machineId: req.params.id,
        type: 'runtime_update',
        description: `Added ${additionalHours} runtime hours. Total: ${machine.runtimeHours} hours`,
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0]
    });

    if (writeData(data)) {
        res.json({
            success: true,
            message: 'Runtime hours updated',
            machineId: req.params.id,
            newRuntimeHours: machine.runtimeHours,
            runtimeDays: (machine.runtimeHours / 24).toFixed(2)
        });
    } else {
        res.status(500).json({ error: 'Failed to update runtime' });
    }
});

// 3. LOGS API
app.get('/api/logs', (req, res) => {
    const data = readData();
    const logs = data.logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(logs);
});

app.post('/api/logs', (req, res) => {
    const data = readData();
    const logData = req.body;

    if (!logData.machineId || !logData.description) {
        return res.status(400).json({ error: 'Machine ID and description are required' });
    }

    const newLog = {
        id: generateId(),
        machineId: logData.machineId,
        type: logData.type || 'maintenance',
        description: logData.description,
        technician: logData.technician || 'System',
        duration: logData.duration || 0,
        partsUsed: logData.partsUsed || [],
        cost: logData.cost || 0,
        timestamp: new Date().toISOString(),
        date: logData.date || new Date().toISOString().split('T')[0]
    };

    data.logs.push(newLog);

    // If it's a maintenance log, update machine's last maintenance date
    if (newLog.type === 'maintenance') {
        const machineIndex = data.machines.findIndex(m => m.id === logData.machineId);
        if (machineIndex !== -1) {
            data.machines[machineIndex].lastMaintenance = newLog.date;
            data.machines[machineIndex].lastUpdated = new Date().toISOString();
        }
    }

    if (writeData(data)) {
        res.status(201).json(newLog);
    } else {
        res.status(500).json({ error: 'Failed to save log' });
    }
});

// 4. DATA IMPORT/EXPORT
app.get('/api/data', (req, res) => {
    const data = readData();

    // Add export metadata
    const exportData = {
        ...data,
        exportInfo: {
            exportedAt: new Date().toISOString(),
            version: '1.0.0',
            recordCounts: {
                machines: data.machines.length,
                logs: data.logs.length
            }
        }
    };

    res.json(exportData);
});

app.post('/api/data', (req, res) => {
    const incomingData = req.body;

    // Basic validation
    if (!incomingData || !Array.isArray(incomingData.machines) || !Array.isArray(incomingData.logs)) {
        return res.status(400).json({ error: 'Invalid data format. Expected arrays for machines and logs.' });
    }

    // Keep the existing settings if not provided
    const currentData = readData();
    const mergedData = {
        machines: incomingData.machines,
        logs: incomingData.logs,
        settings: incomingData.settings || currentData.settings,
        stats: {
            ...currentData.stats,
            lastImport: new Date().toISOString()
        }
    };

    if (writeData(mergedData)) {
        res.json({
            success: true,
            message: 'Data imported successfully',
            imported: {
                machines: incomingData.machines.length,
                logs: incomingData.logs.length
            }
        });
    } else {
        res.status(500).json({ error: 'Failed to import data' });
    }
});

// Backup endpoint
app.post('/api/data/backup', (req, res) => {
    const data = readData();
    const backupFileName = `mechcare-backup-${Date.now()}.json`;
    const backupPath = path.join(__dirname, DATA_DIR, backupFileName);

    try {
        fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
        res.json({
            success: true,
            message: 'Backup created successfully',
            backupFile: backupFileName,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create backup', details: error.message });
    }
});

// 5. STATISTICS API
app.get('/api/stats', (req, res) => {
    const data = readData();
    const machines = data.machines;

    // Calculate status counts
    let healthy = 0, dueSoon = 0, overdue = 0;
    const today = new Date();

    machines.forEach(machine => {
        const lastMaint = new Date(machine.lastMaintenance);
        const nextMaint = new Date(lastMaint);
        nextMaint.setDate(lastMaint.getDate() + machine.interval);

        const diffTime = nextMaint - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) overdue++;
        else if (diffDays <= 7) dueSoon++;
        else healthy++;
    });

    // Calculate runtime statistics
    const totalRuntime = machines.reduce((sum, m) => sum + (m.runtimeHours || 0), 0);
    const avgRuntime = machines.length > 0 ? totalRuntime / machines.length : 0;

    // Machine types distribution
    const types = {};
    machines.forEach(m => {
        const type = m.type || 'Unknown';
        types[type] = (types[type] || 0) + 1;
    });

    // Recent activity
    const recentLogs = data.logs
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10);

    res.json({
        summary: {
            totalMachines: machines.length,
            healthy,
            dueSoon,
            overdue,
            totalLogs: data.logs.length
        },
        runtime: {
            totalHours: totalRuntime,
            averageHours: avgRuntime.toFixed(2),
            totalDays: (totalRuntime / 24).toFixed(2)
        },
        distribution: {
            byType: types,
            byStatus: { healthy, dueSoon, overdue }
        },
        recentActivity: recentLogs.map(log => ({
            id: log.id,
            machineId: log.machineId,
            type: log.type,
            description: log.description.substring(0, 50) + '...',
            date: log.date,
            timestamp: log.timestamp
        })),
        lastUpdated: data.stats.lastBackup
    });
});

// 6. SETTINGS API
app.get('/api/settings', (req, res) => {
    const data = readData();
    res.json(data.settings || {});
});

app.put('/api/settings', (req, res) => {
    const data = readData();
    data.settings = {
        ...data.settings,
        ...req.body,
        updatedAt: new Date().toISOString()
    };

    if (writeData(data)) {
        res.json({
            success: true,
            message: 'Settings updated',
            settings: data.settings
        });
    } else {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// 7. SEARCH API
app.get('/api/search', (req, res) => {
    const query = req.query.q || '';
    const data = readData();

    if (!query.trim()) {
        return res.json({ machines: [], logs: [] });
    }

    const searchTerm = query.toLowerCase();

    // Search in machines
    const machineResults = data.machines.filter(machine =>
        machine.name.toLowerCase().includes(searchTerm) ||
        machine.type.toLowerCase().includes(searchTerm) ||
        machine.location.toLowerCase().includes(searchTerm) ||
        (machine.notes && machine.notes.toLowerCase().includes(searchTerm))
    );

    // Search in logs
    const logResults = data.logs.filter(log =>
        log.description.toLowerCase().includes(searchTerm) ||
        log.type.toLowerCase().includes(searchTerm)
    );

    res.json({
        query,
        results: {
            machines: machineResults,
            logs: logResults,
            total: machineResults.length + logResults.length
        }
    });
});

// 8. AI ASSISTANT ENDPOINTS (Mock)
app.post('/api/ai/ask', (req, res) => {
    const question = req.body.question || '';

    // Mock AI responses based on keywords
    const lowerQuestion = question.toLowerCase();

    if (lowerQuestion.includes('checklist') || lowerQuestion.includes('maintenance')) {
        return res.json({
            response: `**Maintenance Checklist**\n1. ✅ Inspect safety guards\n2. ✅ Check lubrication levels\n3. ✅ Clean air filters\n4. ✅ Tighten all bolts\n5. ✅ Test emergency stops\n6. ✅ Run diagnostic cycle\n\nFrequency: Every 30 days or 720 runtime hours`,
            suggestions: ['Generate detailed checklist', 'Schedule maintenance']
        });
    }

    if (lowerQuestion.includes('noise') || lowerQuestion.includes('sound')) {
        return res.json({
            response: `**Troubleshooting: Unusual Noises**\n\nPossible causes:\n• Loose components or bolts\n• Worn bearings\n• Insufficient lubrication\n• Foreign object in mechanism\n• Motor alignment issues\n\n**Immediate actions:**\n1. 🔧 Stop machine immediately\n2. 🔍 Perform visual inspection\n3. 📏 Check alignment\n4. 🛢 Verify lubrication\n5. 🎯 Tighten all fasteners`,
            suggestions: ['Check bearing specifications', 'Review maintenance log']
        });
    }

    if (lowerQuestion.includes('runtime') || lowerQuestion.includes('hours')) {
        return res.json({
            response: `**Runtime Management**\n\nOptimal maintenance intervals:\n• Light use: Every 90 days\n• Moderate use: Every 60 days\n• Heavy use: Every 30 days\n• Continuous use: Every 15 days\n\nTrack runtime hours to schedule predictive maintenance and avoid unexpected breakdowns.`,
            suggestions: ['Set runtime alerts', 'Generate runtime report']
        });
    }

    // Default response
    res.json({
        response: `I'm your MechCare AI assistant. I can help with:\n• Maintenance schedules and checklists\n• Troubleshooting guidance\n• Runtime analysis\n• Preventive maintenance planning\n\nPlease ask me a specific question about your machinery.`,
        suggestions: [
            'Generate maintenance checklist',
            'Troubleshoot unusual noise',
            'Check oil change interval',
            'Review safety procedures'
        ]
    });
});

// Generate maintenance report
app.post('/api/ai/report', (req, res) => {
    const { machineId } = req.body;
    const data = readData();
    const machine = data.machines.find(m => m.id === machineId);

    if (!machine) {
        return res.status(404).json({ error: 'Machine not found' });
    }

    const logs = data.logs.filter(l => l.machineId === machineId);
    const lastMaintenance = logs.filter(l => l.type === 'maintenance')
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    const report = {
        machineName: machine.name,
        machineType: machine.type,
        generatedAt: new Date().toISOString(),
        runtimeHours: machine.runtimeHours,
        runtimeDays: (machine.runtimeHours / 24).toFixed(2),
        lastMaintenance: lastMaintenance ? lastMaintenance.date : 'Never',
        totalMaintenanceLogs: logs.filter(l => l.type === 'maintenance').length,
        totalRepairLogs: logs.filter(l => l.type === 'repair').length,
        recommendations: [
            'Schedule next maintenance within 7 days',
            'Check all safety mechanisms',
            'Review lubrication schedule',
            'Inspect electrical connections'
        ],
        healthScore: Math.min(100, 100 - (machine.runtimeHours / (machine.interval * 24) * 100)),
        nextMaintenanceDue: (() => {
            const lastDate = new Date(machine.lastMaintenance);
            lastDate.setDate(lastDate.getDate() + machine.interval);
            return lastDate.toISOString().split('T')[0];
        })()
    };

    res.json(report);
});

// 9. FRONTEND API CLIENT (Embedded in response headers for easy access)
app.get('/api/client.js', (req, res) => {
    res.set('Content-Type', 'application/javascript');
    res.send(`
        // MechCare Frontend API Client
        const MechCareAPI = {
            baseUrl: 'http://localhost:${PORT}/api',
            
            async request(endpoint, options = {}) {
                const url = this.baseUrl + endpoint;
                try {
                    const response = await fetch(url, {
                        headers: {
                            'Content-Type': 'application/json',
                            ...options.headers
                        },
                        ...options
                    });
                    return await response.json();
                } catch (error) {
                    console.error('API Error:', error);
                    throw error;
                }
            },
            
            // Machines
            async getAllMachines() {
                return this.request('/machines');
            },
            
            async getMachine(id) {
                return this.request(\`/machines/\${id}\`);
            },
            
            async addMachine(machineData) {
                return this.request('/machines', {
                    method: 'POST',
                    body: JSON.stringify(machineData)
                });
            },
            
            async updateMachine(id, machineData) {
                return this.request(\`/machines/\${id}\`, {
                    method: 'PUT',
                    body: JSON.stringify(machineData)
                });
            },
            
            async deleteMachine(id) {
                return this.request(\`/machines/\${id}\`, {
                    method: 'DELETE'
                });
            },
            
            // Logs
            async getLogs() {
                return this.request('/logs');
            },
            
            async getMachineLogs(machineId) {
                return this.request(\`/machines/\${machineId}/logs\`);
            },
            
            async addLog(logData) {
                return this.request('/logs', {
                    method: 'POST',
                    body: JSON.stringify(logData)
                });
            },
            
            // Data
            async exportData() {
                return this.request('/data');
            },
            
            async importData(data) {
                return this.request('/data', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
            },
            
            // Stats
            async getStats() {
                return this.request('/stats');
            },
            
            // AI
            async askAI(question) {
                return this.request('/ai/ask', {
                    method: 'POST',
                    body: JSON.stringify({ question })
                });
            },
            
            async generateReport(machineId) {
                return this.request('/ai/report', {
                    method: 'POST',
                    body: JSON.stringify({ machineId })
                });
            },
            
            // Utility
            getMachineStatus(machine) {
                const today = new Date();
                const lastMaint = new Date(machine.lastMaintenance);
                const nextMaint = new Date(lastMaint);
                nextMaint.setDate(lastMaint.getDate() + machine.interval);
                
                const diffTime = nextMaint - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays < 0) return { status: 'Overdue', days: Math.abs(diffDays), color: 'danger' };
                if (diffDays <= 7) return { status: 'Due Soon', days: diffDays, color: 'warning' };
                return { status: 'Healthy', days: diffDays, color: 'success' };
            },
            
            formatDate(dateString) {
                return new Date(dateString).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            }
        };
        
        // Make it globally available
        window.MechCareAPI = MechCareAPI;
        console.log('MechCare API client loaded');
    `);
});

// 10. SERVE FRONTEND FILES
app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
        return next();
    }

    const filePath = path.join(__dirname, req.path);

    // If root path, serve index.html
    if (req.path === '/' || req.path === '/index.html') {
        return res.sendFile(path.join(__dirname, 'index.html'));
    }

    // Check if file exists
    if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
        res.sendFile(filePath);
    } else {
        // For SPA routing, fall back to index.html
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

// 11. ERROR HANDLING
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.url}`,
        timestamp: new Date().toISOString()
    });
});

// ========== START SERVER ==========
function startServer() {
    const server = app.listen(PORT, () => {
        console.log('\n' + '='.repeat(60));
        console.log('🚀 MECHCARE BACKEND SERVER STARTED');
        console.log('='.repeat(60));
        console.log(`📡 Server URL: http://localhost:${PORT}`);
        console.log(`🌐 Frontend: http://localhost:${PORT}/index.html`);
        console.log(`📊 API Base: http://localhost:${PORT}/api`);
        console.log(`💾 Data File: ${DATA_FILE}`);
        console.log('='.repeat(60));
        console.log('\n📋 AVAILABLE ENDPOINTS:');
        console.log('  • GET    /api/health          - Health check');
        console.log('  • GET    /api/machines        - List all machines');
        console.log('  • POST   /api/machines        - Add new machine');
        console.log('  • GET    /api/machines/:id    - Get machine details');
        console.log('  • PUT    /api/machines/:id    - Update machine');
        console.log('  • DELETE /api/machines/:id    - Delete machine');
        console.log('  • GET    /api/logs            - List all logs');
        console.log('  • POST   /api/logs            - Add log entry');
        console.log('  • GET    /api/data            - Export all data');
        console.log('  • POST   /api/data            - Import data');
        console.log('  • GET    /api/stats           - Get statistics');
        console.log('  • GET    /api/settings        - Get settings');
        console.log('  • PUT    /api/settings        - Update settings');
        console.log('  • GET    /api/search?q=...    - Search machines/logs');
        console.log('  • POST   /api/ai/ask          - Ask AI assistant');
        console.log('  • GET    /api/client.js       - Frontend API client');
        console.log('='.repeat(60));
        console.log('\n⚡ Ready to accept connections...\n');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('🛑 SIGTERM received. Shutting down gracefully...');
        server.close(() => {
            console.log('✅ Server closed');
            process.exit(0);
        });
    });

    return server;
}

// Export for testing
module.exports = { app, startServer, readData, writeData, generateId };

// Auto-start if run directly
if (require.main === module) {
    startServer();
}
