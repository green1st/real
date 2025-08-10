class AdaptiveWebAgent {
    constructor() {
        this.isExecuting = false;
        this.currentTaskId = null;
        this.statusInterval = null;
        this.logBuffer = [];
        this.initializeEventListeners();
        this.loadLearningStats();
    }

    initializeEventListeners() {
        const taskForm = document.getElementById('taskForm');
        const executeBtn = document.getElementById('executeBtn');
        const refreshStatsBtn = document.getElementById('refreshStatsBtn');

        taskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.executeTask();
        });

        refreshStatsBtn.addEventListener('click', () => {
            this.loadLearningStats();
        });

        // Auto-refresh stats every 30 seconds
        setInterval(() => {
            if (!this.isExecuting) {
                this.loadLearningStats();
            }
        }, 30000);
    }

    async executeTask() {
        if (this.isExecuting) {
            this.showNotification('Task is already executing', 'warning');
            return;
        }

        const command = document.getElementById('command').value.trim();
        if (!command) {
            this.showNotification('Please enter a command', 'error');
            return;
        }

        this.isExecuting = true;
        this.updateExecuteButton(true);
        this.clearLogs();
        this.addLog('Starting adaptive task execution...', 'info');
        this.updateStatus('Executing');

        try {
            const response = await fetch('/api/tasks/adaptive', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    command: command,
                    timestamp: new Date().toISOString()
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.addLog(`Task completed successfully!`, 'success');
                this.addLog(`Iterations: ${result.iterations}`, 'info');
                this.addLog(`Adaptations: ${result.adaptations}`, 'info');
                this.addLog(`Execution time: ${(result.executionTime / 1000).toFixed(2)}s`, 'info');
                this.updateStatus('Completed');
                this.updateProgress(100);
                this.showNotification('Task completed successfully!', 'success');
            } else {
                this.addLog(`Task failed: ${result.message}`, 'error');
                this.updateStatus('Failed');
                this.showNotification('Task execution failed', 'error');
            }

            // Update stats after execution
            this.loadLearningStats();
            
        } catch (error) {
            this.addLog(`Execution error: ${error.message}`, 'error');
            this.updateStatus('Error');
            this.showNotification('Execution error occurred', 'error');
        } finally {
            this.isExecuting = false;
            this.updateExecuteButton(false);
        }
    }

    async loadLearningStats() {
        try {
            const response = await fetch('/api/learning/stats');
            const stats = await response.json();
            
            document.getElementById('totalActions').textContent = stats.totalActions || 0;
            document.getElementById('successPatterns').textContent = stats.successPatterns || 0;
            document.getElementById('failurePatterns').textContent = stats.failurePatterns || 0;
            document.getElementById('overallSuccessRate').textContent = 
                `${((stats.successRate || 0) * 100).toFixed(1)}%`;
                
        } catch (error) {
            console.error('Error loading learning stats:', error);
        }
    }

    updateExecuteButton(executing) {
        const btn = document.getElementById('executeBtn');
        if (executing) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Executing...';
            btn.disabled = true;
        } else {
            btn.innerHTML = '<i class="fas fa-rocket"></i> Execute Adaptively';
            btn.disabled = false;
        }
    }

    updateStatus(status) {
        document.getElementById('currentStatus').textContent = status;
    }

    updateProgress(percentage) {
        const progressFill = document.getElementById('progressFill');
        progressFill.style.width = `${percentage}%`;
    }

    addLog(message, type = 'info') {
        const logsContainer = document.getElementById('logsContainer');
        const timestamp = new Date().toLocaleTimeString();
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        
        let icon = '';
        switch (type) {
            case 'error':
                icon = '<i class="fas fa-exclamation-triangle"></i>';
                break;
            case 'warning':
                icon = '<i class="fas fa-exclamation-circle"></i>';
                break;
            case 'success':
                icon = '<i class="fas fa-check-circle"></i>';
                break;
            case 'info':
            default:
                icon = '<i class="fas fa-info-circle"></i>';
                break;
        }
        
        logEntry.innerHTML = `[${timestamp}] ${icon} ${message}`;
        logsContainer.appendChild(logEntry);
        
        // Auto-scroll to bottom
        logsContainer.scrollTop = logsContainer.scrollHeight;
        
        // Limit log entries to prevent memory issues
        const logEntries = logsContainer.querySelectorAll('.log-entry');
        if (logEntries.length > 100) {
            logEntries[0].remove();
        }
    }

    clearLogs() {
        const logsContainer = document.getElementById('logsContainer');
        logsContainer.innerHTML = '<div class="log-entry info">System ready for adaptive execution...</div>';
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;
        
        // Set background color based on type
        switch (type) {
            case 'success':
                notification.style.background = 'linear-gradient(45deg, #28a745, #20c997)';
                break;
            case 'error':
                notification.style.background = 'linear-gradient(45deg, #dc3545, #fd7e14)';
                break;
            case 'warning':
                notification.style.background = 'linear-gradient(45deg, #ffc107, #fd7e14)';
                break;
            default:
                notification.style.background = 'linear-gradient(45deg, #007bff, #6610f2)';
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Add slide-in animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        // Remove notification after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    // Utility method to format time
    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    // Method to reset learning data (for testing)
    async resetLearningData() {
        if (confirm('Are you sure you want to reset all learning data? This action cannot be undone.')) {
            try {
                const response = await fetch('/api/learning/reset', {
                    method: 'POST'
                });
                const result = await response.json();
                
                if (result.success) {
                    this.showNotification('Learning data reset successfully', 'success');
                    this.loadLearningStats();
                } else {
                    this.showNotification('Failed to reset learning data', 'error');
                }
            } catch (error) {
                this.showNotification('Error resetting learning data', 'error');
            }
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.adaptiveAgent = new AdaptiveWebAgent();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+Enter to execute task
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            if (!window.adaptiveAgent.isExecuting) {
                window.adaptiveAgent.executeTask();
            }
        }
        
        // Ctrl+R to refresh stats
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            window.adaptiveAgent.loadLearningStats();
        }
    });
    
    // Add development tools in console
    if (typeof window !== 'undefined') {
        window.resetLearning = () => window.adaptiveAgent.resetLearningData();
        console.log('🤖 Dyoraireal Adaptive Mode loaded!');
        console.log('💡 Use Ctrl+Enter to execute tasks');
        console.log('🔄 Use Ctrl+R to refresh stats');
        console.log('🧹 Use resetLearning() to reset learning data');
    }
});

