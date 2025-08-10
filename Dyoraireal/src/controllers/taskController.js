const { v4: uuidv4 } = require("uuid");
const Database = require("../models/database");
const BrowserService = require("../services/browserService");
const AIService = require("../services/aiService");

class TaskController {
  constructor() {
    this.db = new Database();
    this.browserService = new BrowserService();
    this.aiService = new AIService();
    this.activeTasks = new Map();
  }

  async createTask(req, res) {
    try {
      const { command } = req.body;

      if (!command) {
        return res.status(400).json({ error: "Command is required" });
      }

      const taskId = uuidv4();
      await this.db.createTask(taskId, command);
      await this.db.addLog(taskId, `Task created: ${command}`, "info");

      this.executeTask(taskId, command);

      res.json({
        taskId,
        status: "created",
        message: "Task created and started execution",
      });
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  }

  async getTask(req, res) {
    try {
      const { taskId } = req.params;
      const task = await this.db.getTask(taskId);

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const logs = await this.db.getTaskLogs(taskId);

      res.json({
        ...task,
        logs,
      });
    } catch (error) {
      console.error("Error getting task:", error);
      res.status(500).json({ error: "Failed to get task" });
    }
  }

  async getAllTasks(req, res) {
    try {
      const tasks = await this.db.getAllTasks();
      res.json(tasks);
    } catch (error) {
      console.error("Error getting tasks:", error);
      res.status(500).json({ error: "Failed to get tasks" });
    }
  }

  async getTaskLogs(req, res) {
    try {
      const { taskId } = req.params;
      const logs = await this.db.getTaskLogs(taskId);
      res.json(logs);
    } catch (error) {
      console.error("Error getting task logs:", error);
      res.status(500).json({ error: "Failed to get task logs" });
    }
  }

  async executeTask(taskId, command) {
    let currentPlan = null;
    let currentStepIndex = 0;
    let previousUrl = null;

    try {
      this.activeTasks.set(taskId, { status: "running", startTime: Date.now() });

      await this.db.updateTaskStatus(taskId, "running");
      await this.db.addLog(taskId, "Starting task execution", "info");

      // Initialize browser service for this task (visible mode)
      await this.browserService.initBrowser({
        headless: false, // Changed to headless: false
        contextOptions: { viewport: { width: 1280, height: 720 } },
      });
      await this.db.addLog(taskId, "Browser opened in non-headless mode", "info");

      // Set up captcha service if API key is available
      const captchaApiKey = await this.db.getSetting("captcha_api_key");
      const captchaService = await this.db.getSetting("captcha_service") || "2captcha";
      if (captchaApiKey) {
        this.browserService.setCaptchaService(captchaApiKey, captchaService);
        await this.db.addLog(taskId, "Captcha service configured", "info");
      }

      // Set up proxy service if configured
      const proxySettings = JSON.parse(await this.db.getSetting("proxy_settings") || "{}");
      if (proxySettings.proxies && proxySettings.proxies.length > 0) {
        this.browserService.setProxyService(proxySettings.proxies, proxySettings.rotationEnabled);
        await this.db.addLog(taskId, "Proxy service configured", "info");
      }

      // Initial plan creation
      currentPlan = await this.aiService.createExecutionPlan(command);
      await this.db.addLog(taskId, `Initial execution plan created: ${JSON.stringify(currentPlan)}`, "info");

      while (currentStepIndex < currentPlan.steps.length) {
        const step = currentPlan.steps[currentStepIndex];
        await this.db.addLog(taskId, `Executing step ${currentStepIndex + 1}: ${step.description}`, "info");

        let stepError = null;
        try {
          await this.browserService.executeStep(step, (message, level) => {
            this.db.addLog(taskId, message, level);
          });
        } catch (error) {
          stepError = error;
          await this.db.addLog(taskId, `Step ${currentStepIndex + 1} failed: ${error.message}`, "error");
          // Take screenshot on error, handled by browserService now
        }

        const currentPageContent = await this.browserService.getPageContent();
        const currentUrl = await this.browserService.getCurrentUrl();

        // AI analyzes the result and provides next steps or an improved plan
        let newPlan = null;
        if (step.action.toLowerCase() === 'fill_form' && stepError === null) {
          // If form was just filled and no immediate error, analyze submission result
          newPlan = await this.aiService.handleFormSubmissionResult(
            currentPlan,
            currentPageContent,
            currentUrl,
            previousUrl,
            stepError?.message
          );
        } else {
          // General plan improvement for other steps or if form submission had an error
          newPlan = await this.aiService.improveExecutionPlan(
            currentPlan,
            currentPageContent,
            stepError?.message
          );
        }

        if (newPlan && JSON.stringify(newPlan) !== JSON.stringify(currentPlan)) {
          await this.db.addLog(taskId, `Plan updated. New plan: ${JSON.stringify(newPlan)}`, "info");
          currentPlan = newPlan;
          currentStepIndex = 0; // Reset index to re-evaluate the new plan from start
        } else if (stepError) {
          // If plan didn't improve and there was an error, break or handle unrecoverable error
          await this.db.addLog(taskId, `Failed to recover from error at step ${currentStepIndex + 1}. Task may be stuck or unrecoverable.`, "error");
          break; // Exit loop if unable to recover
        } else {
          currentStepIndex++; // Move to next step if no error and no plan change
        }
        previousUrl = currentUrl;
      }

      // Determine final status
      const finalStatus = currentStepIndex >= currentPlan.steps.length ? "completed" : "failed";
      await this.db.updateTaskStatus(taskId, finalStatus, JSON.stringify(currentPlan));
      await this.db.addLog(taskId, `Task finished with status: ${finalStatus}`, finalStatus === "completed" ? "success" : "error");

      // Close browser after task completion
      await this.browserService.closeBrowser();
      await this.db.addLog(taskId, "Browser closed", "info");

      this.activeTasks.delete(taskId);
    } catch (error) {
      console.error(`Error executing task ${taskId}:`, error);
      await this.db.updateTaskStatus(taskId, "failed", error.message);
      await this.db.addLog(taskId, `Task failed: ${error.message}`, "error");
      this.activeTasks.delete(taskId);
      try {
        await this.browserService.closeBrowser();
      } catch (closeError) {
        console.error("Error closing browser after task failure:", closeError);
      }
    }
  }

  async getActiveTasksStatus(req, res) {
    try {
      const activeTasks = Array.from(this.activeTasks.entries()).map(([taskId, info]) => ({
        taskId,
        ...info,
        duration: Date.now() - info.startTime,
      }));

      res.json(activeTasks);
    } catch (error) {
      console.error("Error getting active tasks:", error);
      res.status(500).json({ error: "Failed to get active tasks" });
    }
  }
}

module.exports = TaskController;


