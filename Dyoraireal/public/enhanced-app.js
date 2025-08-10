class EnhancedAIWebAgentDashboard {
    constructor() {
        this.currentTaskId = null;
        this.logPollingInterval = null;
        this.taskPollingInterval = null;
        this.systemStatsInterval = null;
        this.currentView = 'dashboard';
        this.tasks = [];
        this.filteredTasks = [];
        this.charts = {};
        this.init();
    }

    init() {
        // Initialize Lucide icons
        lucide.createIcons();

        // Bind event listeners
        this.bindEvents();

        // Load initial data
        this.loadTaskHistory();
        this.loadSettings();
        this.updateStats();

        // Start polling intervals
        this.startTaskPolling();
        this.startSystemStatsPolling();

        // Initialize charts
        this.initializeCharts();
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = e.currentTarget.getAttribute('href').substring(1);
                this.switchView(view);
            });
        });

        // Mobile menu
        document.getElementById('mobileMenuBtn').addEventListener('click', () => {
            this.toggleMobileMenu();
        });

        // Execute button
        document.getElementById('executeBtn').addEventListener('click', () => {
            this.executeCommand();
        });

        // Enter key in command input
        document.getElementById('commandInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.executeCommand();
            }
        });

        // Template buttons
        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const template = e.target.getAttribute('data-template');
                document.getElementById('commandInput').value = template;
            });
        });

        // Quick task button
        document.getElementById('quickTaskBtn').addEventListener('click', () => {
            this.switchView('dashboard');
            document.getElementById('commandInput').focus();
        });

        // Stop task button
        document.getElementById('stopTaskBtn').addEventListener('click', () => {
            this.stopCurrentTask();
        });

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadTaskHistory();
        });

        // View all tasks button
        document.getElementById('viewAllTasksBtn').addEventListener('click', () => {
            this.switchView('tasks');
        });

        // Task filtering and search
        document.getElementById('statusFilter').addEventListener('change', () => {
            this.filterTasks();
        });

        document.getElementById('searchTasks').addEventListener('input', () => {
            this.filterTasks();
        });

        // Settings
        document.getElementById('saveAllSettingsBtn').addEventListener('click', () => {
            this.saveAllSettings();
        });

        document.getElementById('resetSettingsBtn').addEventListener('click', () => {
            this.resetSettings();
        });

        document.getElementById('testGeminiBtn').addEventListener('click', () => {
            this.testApiKey('gemini');
        });

        document.getElementById('testCaptchaBtn').addEventListener('click', () => {
            this.testApiKey('captcha');
        });

        document.getElementById('saveProxiesBtn').addEventListener('click', () => {
            this.saveProxies();
        });

        document.getElementById('testProxiesBtn').addEventListener('click', () => {
            this.testProxies();
        });

        // Modal close
        document.getElementById('closeTaskDetails').addEventListener('click', () => {
            this.hideTaskDetailsModal();
        });

        // Close modal on outside click
        document.getElementById('taskDetailsModal').addEventListener('click', (e) => {
            if (e.target.id === 'taskDetailsModal') {
                this.hideTaskDetailsModal();
            }
        });

        // Headless mode toggle
        document.getElementById('headlessMode').addEventListener('change', (e) => {
            this.updateBrowserSetting('headless', e.target.checked);
        });

        // Stealth mode toggle
        document.getElementById('stealthMode').addEventListener('change', (e) => {
            this.updateBrowserSetting('stealth', e.target.checked);
        });
    }

    switchView(viewName) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.add('hidden');
        });

        // Show selected view
        document.getElementById(`${viewName}View`).classList.remove('hidden');

        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('text-blue-600', 'bg-blue-50');
            item.classList.add('text-gray-700');
        });

        const activeNav = document.querySelector(`[href="#${viewName}"]`);
        if (activeNav) {
            activeNav.classList.remove('text-gray-700');
            activeNav.classList.add('text-blue-600', 'bg-blue-50');
        }

        // Update page title
        const titles = {
            dashboard: 'Dashboard',
            tasks: 'Task Management',
            analytics: 'Analytics',
            browser: 'Browser Monitor',
            settings: 'Settings'
        };

        const subtitles = {
            dashboard: 'Monitor and control your AI web automation tasks',
            tasks: 'View and manage all your automation tasks',
            analytics: 'Analyze performance and success metrics',
            browser: 'Monitor browser status and console output',
            settings: 'Configure API keys and system settings'
        };

        document.getElementById('pageTitle').textContent = titles[viewName] || 'Dashboard';
        document.getElementById('pageSubtitle').textContent = subtitles[viewName] || '';

        this.currentView = viewName;

        // Load view-specific data
        if (viewName === 'analytics') {
            this.updateCharts();
        } else if (viewName === 'tasks') {
            this.loadTaskHistory();
        }

        // Close mobile menu
        this.closeMobileMenu();
    }

    toggleMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('open');
    }

    closeMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.remove('open');
    }

    async executeCommand() {
        const command = document.getElementById('commandInput').value.trim();
        if (!command) {
            this.showNotification('Please enter a command', 'error');
            return;
        }

        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ command })
            });

            const result = await response.json();

            if (response.ok) {
                this.currentTaskId = result.taskId;
                this.showCurrentTask(command);
                this.startLogPolling();
                document.getElementById('commandInput').value = '';
                this.showNotification('Task started successfully', 'success');
                this.updateStats();
            } else {
                this.showNotification(result.error || 'Failed to create task', 'error');
            }
        } catch (error) {
            console.error('Error executing command:', error);
            this.showNotification('Network error occurred', 'error');
        }
    }

    showCurrentTask(command) {
        const section = document.getElementById('currentTaskSection');
        const commandDiv = document.getElementById('currentCommand');
        
        commandDiv.textContent = `Command: ${command}`;
        section.classList.remove('hidden');
        
        // Reset progress
        this.updateProgress(0, 0, 'running');
        
        // Clear logs
        const logContainer = document.getElementById('logContainer');
        logContainer.innerHTML = '<div class="text-gray-500">Starting task execution...</div>';
    }

    updateProgress(completed, total, status) {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');

        const percentage = total > 0 ? (completed / total) * 100 : 0;
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${completed}/${total} steps`;

        // Update status
        statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        
        switch (status) {
            case 'running':
                statusIndicator.className = 'w-3 h-3 rounded-full bg-yellow-500 pulse-dot';
                break;
            case 'completed':
                statusIndicator.className = 'w-3 h-3 rounded-full bg-green-500';
                break;
            case 'failed':
                statusIndicator.className = 'w-3 h-3 rounded-full bg-red-500';
                break;
            default:
                statusIndicator.className = 'w-3 h-3 rounded-full bg-gray-500';
        }
    }

    async stopCurrentTask() {
        if (!this.currentTaskId) return;

        try {
            const response = await fetch(`/api/tasks/${this.currentTaskId}/stop`, {
                method: 'POST'
            });

            if (response.ok) {
                this.showNotification('Task stopped successfully', 'info');
                clearInterval(this.logPollingInterval);
                this.currentTaskId = null;
                setTimeout(() => {
                    document.getElementById('currentTaskSection').classList.add('hidden');
                }, 2000);
            } else {
                this.showNotification('Failed to stop task', 'error');
            }
        } catch (error) {
            console.error('Error stopping task:', error);
            this.showNotification('Network error occurred', 'error');
        }
    }

    startLogPolling() {
        if (this.logPollingInterval) {
            clearInterval(this.logPollingInterval);
        }

        this.logPollingInterval = setInterval(async () => {
            if (this.currentTaskId) {
                await this.updateTaskLogs();
            }
        }, 1000);
    }

    async updateTaskLogs() {
        try {
            const response = await fetch(`/api/tasks/${this.currentTaskId}`);
            const task = await response.json();

            if (response.ok) {
                this.displayLogs(task.logs);
                
                // Update progress if task has results
                if (task.result) {
                    try {
                        const result = JSON.parse(task.result);
                        if (result.results) {
                            const completed = result.completedSteps || 0;
                            const total = result.totalSteps || 0;
                            this.updateProgress(completed, total, task.status);
                        }
                    } catch (e) {
                        // Ignore JSON parse errors
                    }
                }

                // Stop polling if task is complete
                if (task.status === 'completed' || task.status === 'failed') {
                    clearInterval(this.logPollingInterval);
                    this.currentTaskId = null;
                    this.loadTaskHistory(); // Refresh history
                    this.updateStats();
                    
                    setTimeout(() => {
                        document.getElementById('currentTaskSection').classList.add('hidden');
                    }, 5000);
                }
            }
        } catch (error) {
            console.error('Error updating task logs:', error);
        }
    }

    displayLogs(logs) {
        const logContainer = document.getElementById('logContainer');
        
        if (!logs || logs.length === 0) {
            logContainer.innerHTML = '<div class="text-gray-500">No logs yet...</div>';
            return;
        }

        const logHTML = logs.map(log => {
            const timestamp = new Date(log.timestamp).toLocaleTimeString();
            const levelColor = this.getLogLevelColor(log.level);
            
            return `
                <div class="log-entry flex gap-2 mb-1">
                    <span class="text-gray-400 text-xs">[${timestamp}]</span>
                    <span class="${levelColor} text-xs uppercase">${log.level}</span>
                    <span class="flex-1">${log.message}</span>
                </div>
            `;
        }).join('');

        logContainer.innerHTML = logHTML;
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    getLogLevelColor(level) {
        switch (level) {
            case 'error': return 'text-red-400';
            case 'warning': return 'text-yellow-400';
            case 'success': return 'text-green-400';
            case 'info': 
            default: return 'text-blue-400';
        }
    }

    async loadTaskHistory() {
        try {
            const response = await fetch('/api/tasks');
            const tasks = await response.json();

            if (response.ok) {
                this.tasks = tasks;
                this.filteredTasks = tasks;
                this.displayTaskHistory(tasks.slice(0, 5), 'recentTasks'); // Show only 5 recent tasks on dashboard
                this.displayTaskHistory(this.filteredTasks, 'taskHistory'); // Show all tasks on tasks page
            } else {
                console.error('Failed to load task history');
            }
        } catch (error) {
            console.error('Error loading task history:', error);
        }
    }

    filterTasks() {
        const statusFilter = document.getElementById('statusFilter').value;
        const searchTerm = document.getElementById('searchTasks').value.toLowerCase();

        this.filteredTasks = this.tasks.filter(task => {
            const matchesStatus = !statusFilter || task.status === statusFilter;
            const matchesSearch = !searchTerm || 
                task.command.toLowerCase().includes(searchTerm) ||
                task.status.toLowerCase().includes(searchTerm);
            
            return matchesStatus && matchesSearch;
        });

        this.displayTaskHistory(this.filteredTasks, 'taskHistory');
    }

    displayTaskHistory(tasks, containerId) {
        const historyContainer = document.getElementById(containerId);
        
        if (!tasks || tasks.length === 0) {
            const message = containerId === 'recentTasks' ? 
                'No recent tasks. Create your first task above!' : 
                'No tasks match your filters.';
            historyContainer.innerHTML = `<div class="text-gray-500 text-center py-8">${message}</div>`;
            return;
        }

        const historyHTML = tasks.map(task => {
            const createdAt = new Date(task.created_at).toLocaleString();
            const statusColor = this.getStatusColor(task.status);
            const statusIcon = this.getStatusIcon(task.status);

            return `
                <div class="task-card border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex-1">
                            <h3 class="font-medium text-gray-800 mb-1">${task.command}</h3>
                            <p class="text-sm text-gray-500">${createdAt}</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <i data-lucide="${statusIcon}" class="w-4 h-4 ${statusColor}"></i>
                            <span class="text-sm font-medium ${statusColor}">${task.status}</span>
                        </div>
                    </div>
                    ${task.result ? `
                        <div class="mt-2 p-2 bg-gray-50 rounded text-sm">
                            <strong>Result:</strong> ${this.formatResult(task.result)}
                        </div>
                    ` : ''}
                    <div class="mt-2 flex gap-2">
                        <button onclick="dashboard.viewTaskDetails('${task.id}')" class="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                            View Details
                        </button>
                        ${task.status === 'failed' ? `
                            <button onclick="dashboard.retryTask('${task.id}')" class="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">
                                Retry
                            </button>
                        ` : ''}
                        <button onclick="dashboard.duplicateTask('${task.id}')" class="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                            Duplicate
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        historyContainer.innerHTML = historyHTML;
        lucide.createIcons(); // Re-initialize icons
    }

    getStatusColor(status) {
        switch (status) {
            case 'completed': return 'text-green-600';
            case 'failed': return 'text-red-600';
            case 'running': return 'text-yellow-600';
            case 'pending': return 'text-gray-600';
            default: return 'text-gray-600';
        }
    }

    getStatusIcon(status) {
        switch (status) {
            case 'completed': return 'check-circle';
            case 'failed': return 'x-circle';
            case 'running': return 'loader';
            case 'pending': return 'clock';
            default: return 'circle';
        }
    }

    formatResult(result) {
        try {
            const parsed = JSON.parse(result);
            if (parsed.completedSteps && parsed.totalSteps) {
                return `Completed ${parsed.completedSteps}/${parsed.totalSteps} steps`;
            }
            return 'Task completed';
        } catch (e) {
            return result.substring(0, 100) + (result.length > 100 ? '...' : '');
        }
    }

    async viewTaskDetails(taskId) {
        try {
            const response = await fetch(`/api/tasks/${taskId}`);
            const task = await response.json();

            if (response.ok) {
                this.showTaskDetailsModal(task);
            }
        } catch (error) {
            console.error('Error loading task details:', error);
        }
    }

    async retryTask(taskId) {
        try {
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                document.getElementById('commandInput').value = task.command;
                this.switchView('dashboard');
                this.showNotification('Command loaded for retry', 'info');
            }
        } catch (error) {
            console.error('Error retrying task:', error);
        }
    }

    async duplicateTask(taskId) {
        try {
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                document.getElementById('commandInput').value = task.command;
                this.switchView('dashboard');
                this.showNotification('Command duplicated', 'info');
            }
        } catch (error) {
            console.error('Error duplicating task:', error);
        }
    }

    showTaskDetailsModal(task) {
        const modal = document.getElementById('taskDetailsModal');
        const content = document.getElementById('taskDetailsContent');
        
        content.innerHTML = `
            <div class="space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h4 class="font-semibold text-gray-800 mb-2">Task Information</h4>
                        <div class="space-y-2 text-sm">
                            <div><strong>ID:</strong> ${task.id}</div>
                            <div><strong>Command:</strong> ${task.command}</div>
                            <div><strong>Status:</strong> <span class="${this.getStatusColor(task.status)}">${task.status}</span></div>
                            <div><strong>Created:</strong> ${new Date(task.created_at).toLocaleString()}</div>
                            ${task.completed_at ? `<div><strong>Completed:</strong> ${new Date(task.completed_at).toLocaleString()}</div>` : ''}
                        </div>
                    </div>
                    <div>
                        <h4 class="font-semibold text-gray-800 mb-2">Execution Details</h4>
                        <div class="space-y-2 text-sm">
                            ${task.result ? `
                                <div>
                                    <strong>Result:</strong>
                                    <pre class="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">${JSON.stringify(JSON.parse(task.result), null, 2)}</pre>
                                </div>
                            ` : '<div class="text-gray-500">No result available</div>'}
                        </div>
                    </div>
                </div>
                
                ${task.logs && task.logs.length > 0 ? `
                    <div>
                        <h4 class="font-semibold text-gray-800 mb-2">Execution Logs</h4>
                        <div class="bg-gray-900 text-green-400 p-4 rounded-lg h-64 overflow-y-auto font-mono text-sm">
                            ${task.logs.map(log => `
                                <div class="mb-1">
                                    <span class="text-gray-400">[${new Date(log.timestamp).toLocaleTimeString()}]</span>
                                    <span class="${this.getLogLevelColor(log.level)} uppercase">${log.level}</span>
                                    ${log.message}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        lucide.createIcons();
    }

    hideTaskDetailsModal() {
        const modal = document.getElementById('taskDetailsModal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    async updateStats() {
        try {
            const response = await fetch('/api/tasks/stats');
            const stats = await response.json();

            if (response.ok) {
                document.getElementById('totalTasks').textContent = stats.total || 0;
                document.getElementById('successRate').textContent = `${stats.successRate || 0}%`;
                document.getElementById('activeTasks').textContent = stats.active || 0;
                document.getElementById('avgDuration').textContent = `${stats.avgDuration || 0}s`;
            }
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    startTaskPolling() {
        this.taskPollingInterval = setInterval(() => {
            this.loadTaskHistory();
            this.updateStats();
        }, 10000); // Refresh every 10 seconds
    }

    startSystemStatsPolling() {
        this.systemStatsInterval = setInterval(() => {
            this.updateSystemStats();
        }, 5000); // Update every 5 seconds
    }

    async updateSystemStats() {
        try {
            // Simulate system stats (in real implementation, this would come from the server)
            const cpuUsage = Math.floor(Math.random() * 30) + 10; // 10-40%
            const memoryUsage = Math.floor(Math.random() * 20) + 30; // 30-50%
            
            document.getElementById('cpuUsage').textContent = cpuUsage;
            document.getElementById('memoryUsage').textContent = memoryUsage;
        } catch (error) {
            console.error('Error updating system stats:', error);
        }
    }

    initializeCharts() {
        // Success Rate Chart
        const successCtx = document.getElementById('successChart');
        if (successCtx) {
            this.charts.success = new Chart(successCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Success', 'Failed'],
                    datasets: [{
                        data: [85, 15],
                        backgroundColor: ['#10B981', '#EF4444'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }

        // Time Chart
        const timeCtx = document.getElementById('timeChart');
        if (timeCtx) {
            this.charts.time = new Chart(timeCtx, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Tasks',
                        data: [12, 19, 3, 5, 2, 3, 9],
                        borderColor: '#3B82F6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    }

    updateCharts() {
        // Update charts with real data
        if (this.charts.success && this.tasks.length > 0) {
            const completed = this.tasks.filter(t => t.status === 'completed').length;
            const failed = this.tasks.filter(t => t.status === 'failed').length;
            
            this.charts.success.data.datasets[0].data = [completed, failed];
            this.charts.success.update();
        }
    }

    async loadSettings() {
        try {
            const response = await fetch('/api/settings');
            const settings = await response.json();

            if (response.ok) {
                document.getElementById('geminiApiKey').value = settings.geminiApiKey || '';
                document.getElementById('captchaApiKey').value = settings.captchaApiKey || '';
                document.getElementById('headlessMode').checked = settings.headless || false;
                document.getElementById('stealthMode').checked = settings.stealth !== false;
                document.getElementById('proxyList').value = settings.proxies ? settings.proxies.join('\n') : '';
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async saveAllSettings() {
        const settings = {
            geminiApiKey: document.getElementById('geminiApiKey').value,
            captchaApiKey: document.getElementById('captchaApiKey').value,
            headless: document.getElementById('headlessMode').checked,
            stealth: document.getElementById('stealthMode').checked,
            proxies: document.getElementById('proxyList').value.split('\n').filter(p => p.trim())
        };

        try {
            const response = await fetch('/api/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });

            const result = await response.json();

            if (response.ok) {
                this.showNotification('Settings saved successfully', 'success');
            } else {
                this.showNotification(result.error || 'Failed to save settings', 'error');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showNotification('Network error occurred', 'error');
        }
    }

    async resetSettings() {
        if (confirm('Are you sure you want to reset all settings to defaults?')) {
            document.getElementById('geminiApiKey').value = '';
            document.getElementById('captchaApiKey').value = '';
            document.getElementById('headlessMode').checked = false;
            document.getElementById('stealthMode').checked = true;
            document.getElementById('proxyList').value = '';
            
            this.showNotification('Settings reset to defaults', 'info');
        }
    }

    async testApiKey(service) {
        const apiKey = service === 'gemini' ? 
            document.getElementById('geminiApiKey').value :
            document.getElementById('captchaApiKey').value;
        
        if (!apiKey) {
            this.showNotification('Please enter an API key first', 'error');
            return;
        }

        try {
            const response = await fetch('/api/settings/test-api-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ apiKey, service })
            });

            const result = await response.json();

            if (response.ok) {
                if (result.valid) {
                    this.showNotification(`${service} API key is valid!`, 'success');
                } else {
                    this.showNotification(`${service} API key is invalid`, 'error');
                }
            } else {
                this.showNotification(result.error || 'Failed to test API key', 'error');
            }
        } catch (error) {
            console.error('Error testing API key:', error);
            this.showNotification('Network error occurred', 'error');
        }
    }

    async saveProxies() {
        const proxies = document.getElementById('proxyList').value.split('\n').filter(p => p.trim());
        
        try {
            const response = await fetch('/api/settings/proxies', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ proxies })
            });

            if (response.ok) {
                this.showNotification('Proxies saved successfully', 'success');
            } else {
                this.showNotification('Failed to save proxies', 'error');
            }
        } catch (error) {
            console.error('Error saving proxies:', error);
            this.showNotification('Network error occurred', 'error');
        }
    }

    async testProxies() {
        try {
            const response = await fetch('/api/settings/test-proxies', {
                method: 'POST'
            });

            const result = await response.json();

            if (response.ok) {
                this.showNotification(`Tested ${result.total} proxies, ${result.working} working`, 'info');
            } else {
                this.showNotification('Failed to test proxies', 'error');
            }
        } catch (error) {
            console.error('Error testing proxies:', error);
            this.showNotification('Network error occurred', 'error');
        }
    }

    async updateBrowserSetting(setting, value) {
        try {
            const response = await fetch('/api/settings/browser', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ [setting]: value })
            });

            if (response.ok) {
                this.showNotification(`Browser ${setting} setting updated`, 'success');
            } else {
                this.showNotification(`Failed to update ${setting} setting`, 'error');
            }
        } catch (error) {
            console.error('Error updating browser setting:', error);
            this.showNotification('Network error occurred', 'error');
        }
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        const notification = document.createElement('div');
        
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };
        
        const icons = {
            success: 'check-circle',
            error: 'x-circle',
            warning: 'alert-triangle',
            info: 'info'
        };
        
        notification.className = `${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg transform translate-x-full transition-transform flex items-center gap-2`;
        notification.innerHTML = `
            <i data-lucide="${icons[type]}" class="w-4 h-4"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" class="ml-2 hover:bg-white hover:bg-opacity-20 rounded p-1">
                <i data-lucide="x" class="w-3 h-3"></i>
            </button>
        `;
        
        container.appendChild(notification);
        lucide.createIcons();
        
        // Slide in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.classList.add('translate-x-full');
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 5000);
    }
}

// Initialize enhanced dashboard
const dashboard = new EnhancedAIWebAgentDashboard();

