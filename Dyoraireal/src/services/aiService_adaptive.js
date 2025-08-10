const { GoogleGenerativeAI } = require("@google/generative-ai");

class AdaptiveAIService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY";
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Memory untuk pembelajaran dan adaptasi
    this.actionHistory = [];
    this.successPatterns = new Map();
    this.failurePatterns = new Map();
    this.currentObjective = null;
    this.currentState = null;
  }

  async parseGeminiResponse(text) {
    let cleanText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    try {
      return JSON.parse(cleanText);
    } catch (e) {
      const firstBrace = cleanText.indexOf("{");
      const lastBrace = cleanText.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        let jsonString = cleanText.substring(firstBrace, lastBrace + 1);
        jsonString = jsonString.replace(/,\s*}/g, "}");
        jsonString = jsonString.replace(/,\s*\]/g, "]");
        jsonString = jsonString.replace(/([\w_\d]+):/g, '"$1":');

        try {
          return JSON.parse(jsonString);
        } catch (e2) {
          console.error("Failed to parse JSON even after extracting braces and basic fixes:", e2);
          throw new Error("Malformed JSON response from AI");
        }
      } else {
        throw new Error("No valid JSON structure found in AI response");
      }
    }
  }

  // Fungsi untuk mengobservasi keadaan halaman web saat ini
  async observeCurrentState(pageContent, url, visibleElements = [], error = null) {
    try {
      const prompt = `You are an adaptive AI web automation agent. Analyze the current state of the webpage and provide a structured observation.

Current URL: ${url}
Page Content (first 2000 chars): ${pageContent.substring(0, 2000)}...
Visible Elements: ${JSON.stringify(visibleElements.slice(0, 10))}
${error ? `Recent Error: ${error}` : ''}

Provide a JSON response with:
{
  "pageType": "login|registration|form|dashboard|error|loading|search|product|checkout|other",
  "availableActions": [
    {
      "type": "click|type|navigate|wait|scroll",
      "target": "selector or URL",
      "description": "what this action would do",
      "confidence": 0.0-1.0
    }
  ],
  "formFields": [
    {
      "name": "field name",
      "type": "input type",
      "selector": "CSS selector",
      "required": true|false,
      "currentValue": "current value if any"
    }
  ],
  "messages": [
    {
      "type": "success|error|warning|info",
      "text": "message content",
      "selector": "element selector"
    }
  ],
  "navigationOptions": [
    {
      "text": "link text",
      "url": "destination URL",
      "selector": "link selector"
    }
  ],
  "pageReadiness": "ready|loading|error|blocked",
  "captchaPresent": true|false,
  "loginRequired": true|false
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const observation = await this.parseGeminiResponse(text);
      this.currentState = observation;
      return observation;
    } catch (error) {
      console.error("Error observing current state:", error);
      return {
        pageType: "unknown",
        availableActions: [],
        formFields: [],
        messages: [],
        navigationOptions: [],
        pageReadiness: "error",
        captchaPresent: false,
        loginRequired: false
      };
    }
  }

  // Fungsi untuk memutuskan tindakan berikutnya berdasarkan observasi dan tujuan
  async decideNextAction(objective, currentState, actionHistory = []) {
    try {
      const recentHistory = actionHistory.slice(-5); // Ambil 5 tindakan terakhir
      const successContext = this.getSuccessContext(objective);
      const failureContext = this.getFailureContext(objective);

      const prompt = `You are an adaptive AI web automation agent. Based on the current state and objective, decide the next best action.

OBJECTIVE: ${objective}

CURRENT STATE:
${JSON.stringify(currentState, null, 2)}

RECENT ACTION HISTORY:
${JSON.stringify(recentHistory, null, 2)}

SUCCESS PATTERNS (from previous similar tasks):
${successContext}

FAILURE PATTERNS (to avoid):
${failureContext}

Provide a JSON response with:
{
  "action": {
    "type": "click|type|navigate|wait|scroll|fill_form|solve_captcha|complete",
    "target": "selector, URL, or form data",
    "value": "text to type or form values",
    "description": "human readable description",
    "reasoning": "why this action was chosen",
    "confidence": 0.0-1.0,
    "expectedOutcome": "what should happen after this action"
  },
  "alternativeActions": [
    {
      "type": "action type",
      "target": "target",
      "description": "description",
      "confidence": 0.0-1.0
    }
  ],
  "riskAssessment": "low|medium|high",
  "progressTowardsGoal": 0.0-1.0,
  "shouldContinue": true|false,
  "adaptationNeeded": true|false
}

IMPORTANT GUIDELINES:
1. If the objective involves registration/signup and you see a "Sign up" button, click it first
2. If you see Google sign-in option after clicking sign up, use it if the objective mentions Google
3. Always prioritize actions that directly advance towards the objective
4. If stuck or no clear path, try alternative approaches
5. Use form filling for multiple fields at once when possible
6. If action type is "complete", it means the objective has been achieved`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return await this.parseGeminiResponse(text);
    } catch (error) {
      console.error("Error deciding next action:", error);
      return {
        action: {
          type: "wait",
          target: "3000",
          description: "Wait due to decision error",
          reasoning: "AI decision failed, waiting to reassess",
          confidence: 0.1,
          expectedOutcome: "Time to recover from error"
        },
        alternativeActions: [],
        riskAssessment: "high",
        progressTowardsGoal: 0.0,
        shouldContinue: true,
        adaptationNeeded: true
      };
    }
  }

  // Fungsi untuk memberikan umpan balik (reward/penalty) setelah tindakan
  async provideFeedback(action, outcome, success, error = null) {
    const feedback = {
      action: action,
      outcome: outcome,
      success: success,
      error: error,
      timestamp: new Date().toISOString()
    };

    this.actionHistory.push(feedback);

    // Simpan pola sukses dan kegagalan
    const actionKey = `${action.type}_${action.target}`;
    
    if (success) {
      if (!this.successPatterns.has(actionKey)) {
        this.successPatterns.set(actionKey, []);
      }
      this.successPatterns.get(actionKey).push(feedback);
    } else {
      if (!this.failurePatterns.has(actionKey)) {
        this.failurePatterns.set(actionKey, []);
      }
      this.failurePatterns.get(actionKey).push(feedback);
    }

    // Batasi ukuran history untuk performa
    if (this.actionHistory.length > 100) {
      this.actionHistory = this.actionHistory.slice(-50);
    }

    return feedback;
  }

  // Fungsi untuk mendapatkan konteks sukses dari pola yang dipelajari
  getSuccessContext(objective) {
    const relevantSuccesses = [];
    for (const [actionKey, feedbacks] of this.successPatterns.entries()) {
      const successfulFeedbacks = feedbacks.filter(f => f.success);
      if (successfulFeedbacks.length > 0) {
        relevantSuccesses.push({
          action: actionKey,
          count: successfulFeedbacks.length,
          lastSuccess: successfulFeedbacks[successfulFeedbacks.length - 1]
        });
      }
    }
    return JSON.stringify(relevantSuccesses.slice(0, 5));
  }

  // Fungsi untuk mendapatkan konteks kegagalan dari pola yang dipelajari
  getFailureContext(objective) {
    const relevantFailures = [];
    for (const [actionKey, feedbacks] of this.failurePatterns.entries()) {
      const failedFeedbacks = feedbacks.filter(f => !f.success);
      if (failedFeedbacks.length > 0) {
        relevantFailures.push({
          action: actionKey,
          count: failedFeedbacks.length,
          lastFailure: failedFeedbacks[failedFeedbacks.length - 1]
        });
      }
    }
    return JSON.stringify(relevantFailures.slice(0, 5));
  }

  // Fungsi untuk adaptasi strategi berdasarkan pembelajaran
  async adaptStrategy(objective, currentState, recentFailures) {
    try {
      const prompt = `You are an adaptive AI agent that needs to change strategy due to repeated failures.

OBJECTIVE: ${objective}
CURRENT STATE: ${JSON.stringify(currentState, null, 2)}
RECENT FAILURES: ${JSON.stringify(recentFailures, null, 2)}

The current approach is not working. Suggest a completely different strategy.

Provide a JSON response with:
{
  "newStrategy": "description of the new approach",
  "reasoning": "why the current approach failed and why this new one should work",
  "alternativeObjective": "if the original objective needs to be modified",
  "nextAction": {
    "type": "action type",
    "target": "target",
    "description": "description",
    "confidence": 0.0-1.0
  },
  "riskLevel": "low|medium|high"
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return await this.parseGeminiResponse(text);
    } catch (error) {
      console.error("Error adapting strategy:", error);
      return {
        newStrategy: "Wait and retry with basic navigation",
        reasoning: "Strategy adaptation failed, falling back to simple approach",
        alternativeObjective: objective,
        nextAction: {
          type: "wait",
          target: "5000",
          description: "Wait before retrying",
          confidence: 0.3
        },
        riskLevel: "medium"
      };
    }
  }

  // Fungsi untuk evaluasi kemajuan menuju tujuan
  async evaluateProgress(objective, initialState, currentState, actionHistory) {
    try {
      const prompt = `Evaluate the progress towards the objective based on state changes and actions taken.

OBJECTIVE: ${objective}
INITIAL STATE: ${JSON.stringify(initialState, null, 2)}
CURRENT STATE: ${JSON.stringify(currentState, null, 2)}
ACTIONS TAKEN: ${JSON.stringify(actionHistory.slice(-10), null, 2)}

Provide a JSON response with:
{
  "progressScore": 0.0-1.0,
  "isCompleted": true|false,
  "stuckIndicator": true|false,
  "nextMilestone": "what should happen next to progress",
  "estimatedStepsRemaining": 1-10,
  "confidence": 0.0-1.0
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return await this.parseGeminiResponse(text);
    } catch (error) {
      console.error("Error evaluating progress:", error);
      return {
        progressScore: 0.0,
        isCompleted: false,
        stuckIndicator: true,
        nextMilestone: "Unknown",
        estimatedStepsRemaining: 5,
        confidence: 0.1
      };
    }
  }

  // Fungsi untuk reset state (untuk tugas baru)
  resetForNewTask(objective) {
    this.currentObjective = objective;
    this.currentState = null;
    // Jangan reset actionHistory dan patterns karena itu adalah pembelajaran
  }

  // Fungsi untuk mendapatkan statistik pembelajaran
  getLearningStats() {
    return {
      totalActions: this.actionHistory.length,
      successPatterns: this.successPatterns.size,
      failurePatterns: this.failurePatterns.size,
      successRate: this.actionHistory.length > 0 ? 
        this.actionHistory.filter(a => a.success).length / this.actionHistory.length : 0
    };
  }

  // Backward compatibility dengan interface lama
  async createExecutionPlan(command, context = {}) {
    // Untuk kompatibilitas, buat rencana sederhana yang akan dieksekusi secara adaptif
    return {
      steps: [
        {
          action: "adaptive_execute",
          target: command,
          description: `Execute adaptively: ${command}`,
          waitFor: "completion"
        }
      ],
      expectedOutcome: `Complete the task: ${command}`,
      riskLevel: "medium"
    };
  }

  async testApiKey(apiKey = null) {
    try {
      const testKey = apiKey || this.apiKey;
      if (!testKey || testKey === 'YOUR_GEMINI_API_KEY') {
        console.warn('Gemini API key is not set or is a placeholder.');
        return false;
      }
      const testGenAI = new GoogleGenerativeAI(testKey);
      const testModel = testGenAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const result = await testModel.generateContent('Hello, this is a test.');
      const response = await result.response;
      const text = response.text();
      
      return text && text.length > 0;
    } catch (error) {
      console.error('API key test failed:', error);
      return false;
    }
  }
}

module.exports = AdaptiveAIService;

