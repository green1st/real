const { GoogleGenerativeAI } = require("@google/generative-ai");

class AIService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY"; // Placeholder for actual key
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    this.executionHistory = []; // Store execution history for learning
  }

  async parseGeminiResponse(text) {
    let cleanText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    try {
      // Attempt to parse directly
      return JSON.parse(cleanText);
    } catch (e) {
      // If direct parse fails, try to find the first and last curly brace
      const firstBrace = cleanText.indexOf("{");
      const lastBrace = cleanText.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        let jsonString = cleanText.substring(firstBrace, lastBrace + 1);
        // Attempt to fix common JSON issues like trailing commas or unquoted keys
        jsonString = jsonString.replace(/,\s*}/g, "}"); // Remove trailing commas before closing brace
        jsonString = jsonString.replace(/,\s*\]/g, "]"); // Remove trailing commas before closing bracket
        jsonString = jsonString.replace(/([\w_\d]+):/g, '"$1":'); // Add quotes to unquoted keys (basic attempt)

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

  async createExecutionPlan(command, context = {}) {
    try {
      // Enhanced prompt with better URL handling and adaptive planning
      const prompt = `You are an AI web automation assistant. Given a natural language command and current context, create a detailed execution plan.
The plan should be adaptive and include steps for self-correction if issues arise, especially for account registration or form filling.

Command: "${command}"
Current Context: ${JSON.stringify(context, null, 2)}

Create a JSON execution plan with the following structure:
{
  "steps": [
    {
      "action": "navigate|click|type|wait|scroll|extract|fill_form|solve_captcha",
      "target": "URL or element selector or text to type or form data object",
      "description": "Human readable description of this step",
      "waitFor": "optional - what to wait for after this action (e.g., 'page load', 'element:selector')",
      "data": "optional - for fill_form action, an object of key-value pairs for form fields",
      "alternatives": "optional - array of alternative selectors or approaches if primary fails"
    }
  ],
  "expectedOutcome": "What should happen when this plan is executed (e.g., 'Account registered successfully', 'Data extracted')",
  "riskLevel": "low|medium|high - based on the actions involved"
}

Focus on common web automation tasks like:
- Account registration (identify common fields like email, password, username, confirm password, submit button)
- Form filling
- Data extraction/scraping
- Online purchases
- File uploads
- Social media interactions

Provide a practical, step-by-step plan that can be executed by a browser automation tool.

IMPORTANT: For 'click', 'type', and 'fill_form' actions, the 'target' field MUST be a valid Playwright selector (CSS or XPath) or a descriptive identifier for 'fill_form'. Do NOT use natural language descriptions for selectors. Examples:
- CSS: 'button#submit-button', 'input[name="username"]', '.my-class'
- XPath: '//button[text()="Sign In"]', '//a[contains(., "Learn More")]'
- For 'fill_form', 'target' can be a general form selector like 'form' or 'form#registrationForm'.

If the command implies account registration, try to include common registration fields in the 'data' object for 'fill_form' action, even if not explicitly mentioned in the command, and suggest placeholders.
For example, if command is "Daftar akun baru di website example.com", the plan might include a 'fill_form' step with data like { email: "placeholder@example.com", password: "SecureP@ss123!" }.

CRUCIAL RULES:
1. If the command specifies a URL (like "manus.ai", "example.com", etc.), the first step MUST be to navigate to that exact URL with proper protocol (https://).
2. Do NOT default to google.com unless explicitly instructed or no other URL is provided.
3. For registration tasks, break down into smaller steps: navigate -> find signup button -> click -> fill form -> submit.
4. Include alternative selectors for critical elements (signup buttons, forms) to handle UI variations.
5. Add appropriate wait conditions between steps.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      try {
        return await this.parseGeminiResponse(text);
      } catch (parseError) {
        console.log("Raw AI response:", text);
        throw parseError; // Re-throw to be caught by outer catch block
      }
    } catch (error) {
      console.error("Error creating execution plan:", error);
      // Improved fallback plan that respects URL in command
      const urlMatch = command.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      const targetUrl = urlMatch ? `https://${urlMatch[1]}` : "https://www.google.com";
      
      return {
        steps: [
          {
            action: "navigate",
            target: targetUrl,
            description: `Navigate to ${targetUrl} to execute command: ${command}`,
            waitFor: "page load"
          }
        ],
        expectedOutcome: `Complete the task: ${command}`,
        riskLevel: "medium"
      };
    }
  }

  async analyzePageContent(content, objective) {
    try {
      const prompt = `Analyze this webpage content and provide guidance for achieving the objective.
Focus on identifying relevant elements for form filling or data extraction.

Objective: "${objective}"

Page Content (truncated to 2000 chars):
${content.substring(0, 2000)}...

Provide a JSON response with:
{
  "relevantElements": ["list of important elements or selectors (e.g., input[name='email'], button#submit)"],
  "nextAction": "what action should be taken next (e.g., 'fill_form', 'click', 'extract')",
  "confidence": "high|medium|low - how confident you are about the next action",
  "reasoning": "explanation of your analysis",
  "alternatives": ["alternative selectors or approaches if primary fails"]
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      try {
        return await this.parseGeminiResponse(text);
      } catch (parseError) {
        console.error("Error parsing page content analysis:", parseError);
        return {
          relevantElements: [],
          nextAction: "continue",
          confidence: "low",
          reasoning: "Unable to parse AI response for page content analysis",
          alternatives: []
        };
      }
    } catch (error) {
      console.error("Error analyzing page content:", error);
      throw new Error("Failed to analyze page content");
    }
  }

  async analyzePageForForm(pageContent, objective = 'Identify and understand form fields for registration or data input.') {
    try {
      const prompt = `You are an AI assistant specialized in web forms. Analyze the provided HTML content to identify form fields and their attributes.
Focus on common registration fields like email, password, username, confirm password, and submit buttons.

HTML Content (truncated to 3000 chars):
${pageContent.substring(0, 3000)}...

Provide a JSON response with the following structure:
{
  "formDetected": true|false,
  "formSelector": "CSS selector for the main form element, if detected",
  "fields": [
    {
      "name": "name attribute or best identifier",
      "type": "input type (text, email, password, submit, etc.)",
      "selector": "CSS selector for this field",
      "placeholder": "placeholder text, if any",
      "label": "associated label text, if any",
      "required": true|false,
      "value": "current value, if any",
      "alternatives": ["alternative selectors for this field"]
    }
  ],
  "submitButtonSelector": "CSS selector for the primary submit button",
  "submitButtonAlternatives": ["alternative selectors for submit button"],
  "captchaDetected": true|false,
  "captchaType": "recaptcha|hcaptcha|image",
  "messages": [
    {
      "type": "success|error|info",
      "text": "message text",
      "selector": "CSS selector for the message element"
    }
  ]
}

If no form is detected, set "formDetected" to false and leave other fields empty.
Prioritize 'name' attribute for field identification, then 'id', then 'placeholder' or 'label'.
Always provide alternative selectors for critical elements.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      try {
        return await this.parseGeminiResponse(text);
      } catch (parseError) {
        console.error("Error parsing form analysis:", parseError);
        return { formDetected: false, fields: [], messages: [] };
      }
    } catch (error) {
      console.error("Error analyzing page for form:", error);
      throw new Error("Failed to analyze page for form");
    }
  }

  async adaptivePlanRevision(originalPlan, currentPageContent, currentUrl, stepIndex, error = null) {
    try {
      const prompt = `You are an AI web automation assistant with adaptive capabilities. A step in the execution plan has failed or needs revision.
Analyze the current situation and provide an improved execution plan that adapts to the current page state.

Original Plan:
${JSON.stringify(originalPlan, null, 2)}

Current Step Index: ${stepIndex}
Current URL: ${currentUrl}
Current Page Content (truncated to 2000 chars):
${currentPageContent.substring(0, 2000)}...

${error ? `Error Encountered: ${error}` : ''}

Based on this information, provide an improved JSON execution plan with the same structure as createExecutionPlan.
The plan should:
1. Adapt to the current page structure and content
2. Use more flexible selectors based on what's actually available on the page
3. Include alternative approaches if the primary method fails
4. Add appropriate wait conditions
5. Handle common UI variations (different button texts, form layouts, etc.)

Focus on making the plan more robust and adaptive to handle real-world website variations.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      try {
        return await this.parseGeminiResponse(text);
      } catch (parseError) {
        console.error("Error parsing adaptive plan revision:", parseError);
        return originalPlan; // Return original if parsing fails
      }
    } catch (error) {
      console.error("Error in adaptive plan revision:", error);
      return originalPlan; // Return original if API call fails
    }
  }

  async handleFormSubmissionResult(originalPlan, pageContent, currentUrl, previousUrl, error = null) {
    try {
      const prompt = `You are an AI web automation assistant. A form submission has just occurred, and here is the current page content and context.
Analyze the outcome and provide an improved or next execution plan.

Original Plan (last step was likely form submission):
${JSON.stringify(originalPlan, null, 2)}

Current Page Content (truncated to 2000 chars):
${pageContent.substring(0, 2000)}...

Current URL: ${currentUrl}
Previous URL: ${previousUrl}

${error ? `Error Encountered during last step: ${error}` : ''}

Based on this information, determine the outcome of the form submission (success, validation error, other error, redirect, captcha, etc.).
Then, provide an improved JSON execution plan with the same structure as createExecutionPlan.

If successful, the plan should indicate completion or next logical steps (e.g., navigate to dashboard).
If there's a validation error, the plan should include steps to correct the input fields based on error messages.
If a captcha is detected, the plan should include a 'solve_captcha' step.
If a redirect occurred, ensure the plan acknowledges the new URL.
If the error is unrecoverable, the plan should reflect that.

Focus on:
- Adapting to the current page structure and messages.
- Correcting any errors from the previous submission.
- Using specific selectors based on the page content and form analysis.
- Adding necessary wait conditions.
- Suggesting alternative data if a specific input (e.g., email) is already taken.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      try {
        return await this.parseGeminiResponse(text);
      } catch (parseError) {
        console.error("Error parsing form submission result:", parseError);
        // Fallback: if parsing fails, try to improve based on generic error
        return await this.improveExecutionPlan(originalPlan, pageContent, error);
      }
    } catch (error) {
      console.error("Error handling form submission result:", error);
      return originalPlan; // Return original if API call fails
    }
  }

  async improveExecutionPlan(originalPlan, pageContent, error = null) {
    try {
      const prompt = `You are an AI web automation assistant. Improve the execution plan based on the current page content and any errors encountered.
This function is a general fallback for plan improvement when a specific form submission context is not available.

Original Plan:
${JSON.stringify(originalPlan, null, 2)}

Current Page Content (truncated to 1500 chars):
${pageContent.substring(0, 1500)}...

${error ? `Error Encountered: ${error}` : ''}

Provide an improved JSON execution plan with the same structure as createExecutionPlan.

Focus on:
- Adapting to the current page structure.
- Fixing any errors in the original plan.
- Using more specific selectors based on the page content.
- Adding necessary wait conditions.
- If the error suggests a fundamental issue (e.g., site down, element consistently missing), consider a 'wait' or 'navigate' to a known good state.
- Include alternative selectors and approaches for robustness.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      try {
        return await this.parseGeminiResponse(text);
      } catch (parseError) {
        console.error("Error parsing improved plan:", parseError);
        return originalPlan; // Return original if parsing fails
      }
    } catch (error) {
      console.error("Error improving execution plan:", error);
      return originalPlan; // Return original if API call fails
    }
  }

  // New method for learning from execution history
  storeExecutionResult(command, plan, result, pageContent, url) {
    this.executionHistory.push({
      timestamp: new Date().toISOString(),
      command,
      plan,
      result,
      pageContent: pageContent.substring(0, 1000), // Store truncated content
      url,
      success: result.success || false
    });

    // Keep only last 100 executions to prevent memory issues
    if (this.executionHistory.length > 100) {
      this.executionHistory = this.executionHistory.slice(-100);
    }
  }

  // New method to get insights from execution history
  async getExecutionInsights(command, url) {
    const relevantHistory = this.executionHistory.filter(h => 
      h.command.toLowerCase().includes(command.toLowerCase()) || 
      h.url.includes(url)
    );

    if (relevantHistory.length === 0) {
      return null;
    }

    const successfulExecutions = relevantHistory.filter(h => h.success);
    const failedExecutions = relevantHistory.filter(h => !h.success);

    return {
      totalExecutions: relevantHistory.length,
      successfulExecutions: successfulExecutions.length,
      failedExecutions: failedExecutions.length,
      successRate: successfulExecutions.length / relevantHistory.length,
      commonFailures: failedExecutions.map(f => f.result.error || 'Unknown error'),
      successfulPatterns: successfulExecutions.map(s => s.plan.steps)
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

module.exports = AIService;

