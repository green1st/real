const AdaptiveAIService = require('../services/aiService_adaptive');
const AdaptiveBrowserService = require('../services/browserService_adaptive');
const StealthService = require('../services/stealthService');

class AdaptiveTaskController {
  constructor() {
    this.aiService = new AdaptiveAIService();
    this.browserService = new AdaptiveBrowserService();
    this.stealthService = new StealthService();
    this.isExecuting = false;
    this.currentTask = null;
    this.maxIterations = 20; // Maksimum iterasi untuk mencegah loop tak terbatas
    this.maxConsecutiveFailures = 3; // Maksimum kegagalan berturut-turut sebelum adaptasi strategi
  }

  async executeTask(taskData) {
    if (this.isExecuting) {
      throw new Error('Another task is already executing');
    }

    this.isExecuting = true;
    this.currentTask = taskData;
    
    const startTime = Date.now();
    let result = {
      success: false,
      message: '',
      executionTime: 0,
      iterations: 0,
      adaptations: 0,
      learningStats: {}
    };

    try {
      console.log('info', `Task created: ${taskData.command}`);
      console.log('info', 'Starting adaptive task execution');

      // Reset AI untuk tugas baru
      this.aiService.resetForNewTask(taskData.command);

      // Inisialisasi browser
      await this.browserService.initBrowser();
      console.log('info', 'Browser opened in non-headless mode');

      // Eksekusi adaptif
      result = await this.executeAdaptively(taskData.command);
      
    } catch (error) {
      console.error('error', `Task execution failed: ${error.message}`);
      result.success = false;
      result.message = `Execution failed: ${error.message}`;
    } finally {
      // Cleanup
      try {
        await this.browserService.closeBrowser();
        console.log('info', 'Browser closed');
      } catch (cleanupError) {
        console.error('error', `Browser cleanup failed: ${cleanupError.message}`);
      }
      
      result.executionTime = Date.now() - startTime;
      result.learningStats = this.aiService.getLearningStats();
      
      this.isExecuting = false;
      this.currentTask = null;
      
      console.log('info', `Task finished with status: ${result.success ? 'completed' : 'failed'}`);
      return result;
    }
  }

  async executeAdaptively(objective) {
    let iterations = 0;
    let consecutiveFailures = 0;
    let adaptations = 0;
    let initialState = null;
    let lastSuccessfulState = null;

    while (iterations < this.maxIterations) {
      iterations++;
      console.log('info', `Adaptive iteration ${iterations}: Observing current state`);

      try {
        // 1. Observasi keadaan saat ini
        const pageContent = await this.browserService.getPageContent();
        const currentUrl = await this.browserService.getCurrentUrl();
        const visibleElements = await this.browserService.getVisibleElements();
        
        const currentState = await this.aiService.observeCurrentState(
          pageContent, 
          currentUrl, 
          visibleElements
        );

        if (iterations === 1) {
          initialState = currentState;
        }

        // 2. Evaluasi kemajuan
        const progress = await this.aiService.evaluateProgress(
          objective, 
          initialState, 
          currentState, 
          this.aiService.actionHistory
        );

        console.log('info', `Progress evaluation: ${(progress.progressScore * 100).toFixed(1)}% complete`);

        // 3. Cek apakah tujuan sudah tercapai
        if (progress.isCompleted || progress.progressScore >= 0.9) {
          console.log('info', 'Objective completed successfully');
          return {
            success: true,
            message: 'Task completed successfully through adaptive execution',
            iterations: iterations,
            adaptations: adaptations,
            finalState: currentState
          };
        }

        // 4. Cek apakah terjebak
        if (progress.stuckIndicator && consecutiveFailures >= this.maxConsecutiveFailures) {
          console.log('info', 'Stuck detected, attempting strategy adaptation');
          
          const recentFailures = this.aiService.actionHistory
            .slice(-this.maxConsecutiveFailures)
            .filter(h => !h.success);
          
          const adaptation = await this.aiService.adaptStrategy(
            objective, 
            currentState, 
            recentFailures
          );
          
          console.log('info', `New strategy: ${adaptation.newStrategy}`);
          adaptations++;
          consecutiveFailures = 0; // Reset counter setelah adaptasi
          
          // Eksekusi tindakan dari strategi baru
          if (adaptation.nextAction) {
            const actionResult = await this.executeAction(adaptation.nextAction);
            await this.aiService.provideFeedback(
              adaptation.nextAction, 
              actionResult.outcome, 
              actionResult.success, 
              actionResult.error
            );
            
            if (!actionResult.success) {
              consecutiveFailures++;
            } else {
              lastSuccessfulState = currentState;
              consecutiveFailures = 0;
            }
          }
          
          continue;
        }

        // 5. Putuskan tindakan berikutnya
        const decision = await this.aiService.decideNextAction(
          objective, 
          currentState, 
          this.aiService.actionHistory
        );

        console.log('info', `Next action decided: ${decision.action.type} - ${decision.action.description}`);

        // 6. Eksekusi tindakan
        const actionResult = await this.executeAction(decision.action);
        
        // 7. Berikan umpan balik ke AI
        await this.aiService.provideFeedback(
          decision.action, 
          actionResult.outcome, 
          actionResult.success, 
          actionResult.error
        );

        // 8. Update counter kegagalan
        if (!actionResult.success) {
          consecutiveFailures++;
          console.log('info', `Action failed. Consecutive failures: ${consecutiveFailures}`);
        } else {
          lastSuccessfulState = currentState;
          consecutiveFailures = 0;
        }

        // 9. Cek apakah harus berhenti
        if (!decision.shouldContinue) {
          console.log('info', 'AI decided to stop execution');
          break;
        }

        // 10. Tunggu sebentar sebelum iterasi berikutnya
        await this.sleep(1000);

      } catch (error) {
        console.error('error', `Error in adaptive iteration ${iterations}: ${error.message}`);
        consecutiveFailures++;
        
        if (consecutiveFailures >= this.maxConsecutiveFailures) {
          console.log('error', 'Too many consecutive failures, stopping execution');
          break;
        }
        
        await this.sleep(2000); // Tunggu lebih lama jika ada error
      }
    }

    // Jika sampai di sini, berarti tidak berhasil menyelesaikan tugas
    return {
      success: false,
      message: `Task not completed after ${iterations} iterations. ${adaptations} strategy adaptations were attempted.`,
      iterations: iterations,
      adaptations: adaptations,
      finalState: this.aiService.currentState,
      lastSuccessfulState: lastSuccessfulState
    };
  }

  async executeAction(action) {
    try {
      console.log('info', `Executing action: ${action.type} on ${action.target}`);
      
      let result = { success: false, outcome: '', error: null };

      switch (action.type) {
        case 'navigate':
          await this.browserService.navigateToUrl(action.target);
          await this.sleep(3000); // Tunggu halaman dimuat
          result.success = true;
          result.outcome = `Navigated to ${action.target}`;
          break;

        case 'click':
          try {
            await this.browserService.clickElement(action.target);
            await this.sleep(2000); // Tunggu respons setelah klik
            result.success = true;
            result.outcome = `Clicked element: ${action.target}`;
          } catch (clickError) {
            // Coba alternatif jika klik gagal
            const alternatives = await this.findAlternativeElements(action.target);
            if (alternatives.length > 0) {
              await this.browserService.clickElement(alternatives[0]);
              result.success = true;
              result.outcome = `Clicked alternative element: ${alternatives[0]}`;
            } else {
              throw clickError;
            }
          }
          break;

        case 'type':
          await this.browserService.typeText(action.target, action.value || '');
          result.success = true;
          result.outcome = `Typed text in ${action.target}`;
          break;

        case 'fill_form':
          if (typeof action.target === 'object') {
            // action.target berisi data form
            for (const [field, value] of Object.entries(action.target)) {
              try {
                await this.browserService.fillField(field, value);
              } catch (fillError) {
                console.log('warning', `Failed to fill field ${field}: ${fillError.message}`);
              }
            }
            result.success = true;
            result.outcome = 'Form filled with provided data';
          } else {
            result.success = false;
            result.error = 'Invalid form data format';
          }
          break;

        case 'wait':
          const waitTime = parseInt(action.target) || 3000;
          await this.sleep(waitTime);
          result.success = true;
          result.outcome = `Waited for ${waitTime}ms`;
          break;

        case 'scroll':
          await this.browserService.scrollPage(action.target || 'down');
          result.success = true;
          result.outcome = `Scrolled ${action.target || 'down'}`;
          break;

        case 'complete':
          result.success = true;
          result.outcome = 'Task marked as complete by AI';
          break;

        default:
          result.success = false;
          result.error = `Unknown action type: ${action.type}`;
      }

      return result;

    } catch (error) {
      console.error('error', `Action execution failed: ${error.message}`);
      return {
        success: false,
        outcome: '',
        error: error.message
      };
    }
  }

  async findAlternativeElements(originalSelector) {
    try {
      // Coba beberapa variasi selector
      const alternatives = [];
      
      // Jika selector mengandung teks, coba variasi
      if (originalSelector.includes('text()')) {
        const textMatch = originalSelector.match(/text\(\)="([^"]+)"/);
        if (textMatch) {
          const text = textMatch[1];
          alternatives.push(`//button[contains(text(), "${text}")]`);
          alternatives.push(`//a[contains(text(), "${text}")]`);
          alternatives.push(`//*[contains(text(), "${text}")]`);
        }
      }
      
      // Jika selector CSS, coba variasi
      if (!originalSelector.startsWith('//')) {
        alternatives.push(`[aria-label*="${originalSelector}"]`);
        alternatives.push(`[title*="${originalSelector}"]`);
      }

      return alternatives;
    } catch (error) {
      return [];
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Backward compatibility
  async executeTaskWithPlan(taskData) {
    return await this.executeTask(taskData);
  }

  getExecutionStatus() {
    return {
      isExecuting: this.isExecuting,
      currentTask: this.currentTask,
      learningStats: this.aiService.getLearningStats()
    };
  }
}

module.exports = AdaptiveTaskController;

