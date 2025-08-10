const { GoogleGenerativeAI } = require("@google/generative-ai");

class AIService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY"; // Placeholder for actual key
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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
      const prompt = "You are an AI web automation assistant. Given a natural language command and current context, create a detailed execution plan.\n" +
      "The plan should be adaptive and include steps for self-correction if issues arise, especially for account registration or form filling.\n\n" +
      "Command: \"" + command + "\"\n" +
      "Current Context: " + JSON.stringify(context, null, 2) + "\n\n" +
      "Create a JSON execution plan with the following structure:\n" +
      "{\n" +
      "  \"steps\": [\n" +
      "    {\n" +
      "      \"action\": \"navigate|click|type|wait|scroll|extract|fill_form|solve_captcha\",\n" +
      "      \"target\": \"URL or element selector or text to type or form data object\",\n" +
      "      \"description\": \"Human readable description of this step\",\n" +
      "      \"waitFor\": \"optional - what to wait for after this action (e.g., 'page load', 'element:selector')\",\n" +
      "      \"data\": \"optional - for fill_form action, an object of key-value pairs for form fields\"\n" +
      "    }\n" +
      "  ],\n" +
      "  \"expectedOutcome\": \"What should happen when this plan is executed (e.g., 'Account registered successfully', 'Data extracted')\",\n" +
      "  \"riskLevel\": \"low|medium|high - based on the actions involved\"\n" +
      "}\n\n" +
      "Focus on common web automation tasks like:\n" +
      "- Account registration (identify common fields like email, password, username, confirm password, submit button)\n" +
      "- Form filling\n" +
      "- Data extraction/scraping\n" +
      "- Online purchases\n" +
      "- File uploads\n" +
      "- Social media interactions\n\n" +
      "Provide a practical, step-by-step plan that can be executed by a browser automation tool.\n\n" +
      "IMPORTANT: For 'click', 'type', and 'fill_form' actions, the 'target' field MUST be a valid Playwright selector (CSS or XPath) or a descriptive identifier for 'fill_form'. Do NOT use natural language descriptions for selectors. Examples:\n" +
      "- CSS: 'button#submit-button', 'input[name=\"username\"]', '.my-class'\n" +
      "- XPath: '//button[text()=\"Sign In\"]', '//a[contains(., \"Learn More\")]'\n" +
      "- For 'fill_form', 'target' can be a general form selector like 'form' or 'form#registrationForm'.\n\n" +
      "If the command implies account registration, try to include common registration fields in the 'data' object for 'fill_form' action, even if not explicitly mentioned in the command, and suggest placeholders.\n" +
      "For example, if command is \"Daftar akun baru di website example.com\", the plan might include a 'fill_form' step with data like { email: \"placeholder@example.com\", password: \"SecureP@ss123!\" }.\n" +
      "Crucially, if the command specifies a URL, the first step MUST be to navigate to that exact URL. Do NOT default to google.com unless explicitly instructed or no other URL is provided.";

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
      // Fallback plan if AI fails to generate a valid plan
      return {
        steps: [
          {
            action: "navigate",
            target: "https://www.google.com",
            description: `Execute command: ${command}`,
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
      const prompt = "Analyze this webpage content and provide guidance for achieving the objective.\n" +
      "Focus on identifying relevant elements for form filling or data extraction.\n\n" +
      "Objective: \"" + objective + "\"\n\n" +
      "Page Content (truncated to 2000 chars):\n" +
      content.substring(0, 2000) + "...\n\n" +
      "Provide a JSON response with:\n" +
      "{\n" +
      "  \"relevantElements\": [\"list of important elements or selectors (e.g., input[name='email'], button#submit)\"],\n" +
      "  \"nextAction\": \"what action should be taken next (e.g., 'fill_form', 'click', 'extract')\",\n" +
      "  \"confidence\": \"high|medium|low - how confident you are about the next action\",\n" +
      "  \"reasoning\": \"explanation of your analysis\"\n" +
      "}\n";

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
          reasoning: "Unable to parse AI response for page content analysis"
        };
      }
    } catch (error) {
      console.error("Error analyzing page content:", error);
      throw new Error("Failed to analyze page content");
    }
  }

  async analyzePageForForm(pageContent, objective = 'Identify and understand form fields for registration or data input.') {
    try {
      const prompt = "You are an AI assistant specialized in web forms. Analyze the provided HTML content to identify form fields and their attributes.\n" +
      "Focus on common registration fields like email, password, username, confirm password, and submit buttons.\n\n" +
      "HTML Content (truncated to 3000 chars):\n" +
      pageContent.substring(0, 3000) + "...\n\n" +
      "Provide a JSON response with the following structure:\n" +
      "{\n" +
      "  \"formDetected\": true|false,\n" +
      "  \"formSelector\": \"CSS selector for the main form element, if detected\",\n" +
      "  \"fields\": [\n" +
      "    {\n" +
      "      \"name\": \"name attribute or best identifier\",\n" +
      "      \"type\": \"input type (text, email, password, submit, etc.)\",\n" +
      "      \"selector\": \"CSS selector for this field\",\n" +
      "      \"placeholder\": \"placeholder text, if any\",\n" +
      "      \"label\": \"associated label text, if any\",\n" +
      "      \"required\": true|false,\n" +
      "      \"value\": \"current value, if any\"\n" +
      "    }\n" +
      "  ],\n" +
      "  \"submitButtonSelector\": \"CSS selector for the primary submit button\",\n" +
      "  \"captchaDetected\": true|false,\n" +
      "  \"captchaType\": \"recaptcha|hcaptcha|image\",\n" +
      "  \"messages\": [\n" +
      "    {\n" +
      "      \"type\": \"success|error|info\",\n" +
      "      \"text\": \"message text\",\n" +
      "      \"selector\": \"CSS selector for the message element\"\n" +
      "    }\n" +
      "  ]\n" +
      "}\n\n" +
      "If no form is detected, set \"formDetected\" to false and leave other fields empty.\n" +
      "Prioritize 'name' attribute for field identification, then 'id', then 'placeholder' or 'label'.\n";

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

  async handleFormSubmissionResult(originalPlan, pageContent, currentUrl, previousUrl, error = null) {
    try {
      const prompt = "You are an AI web automation assistant. A form submission has just occurred, and here is the current page content and context.\n" +
      "Analyze the outcome and provide an improved or next execution plan.\n\n" +
      "Original Plan (last step was likely form submission):\n" +
      JSON.stringify(originalPlan, null, 2) + "\n\n" +
      "Current Page Content (truncated to 2000 chars):\n" +
      pageContent.substring(0, 2000) + "...\n\n" +
      "Current URL: " + currentUrl + "\n" +
      "Previous URL: " + previousUrl + "\n\n" +
      (error ? `Error Encountered during last step: ${error}` : '') + "\n\n" +
      "Based on this information, determine the outcome of the form submission (success, validation error, other error, redirect, captcha, etc.).\n" +
      "Then, provide an improved JSON execution plan with the same structure as createExecutionPlan.\n\n" +
      "If successful, the plan should indicate completion or next logical steps (e.g., navigate to dashboard).\n" +
      "If there's a validation error, the plan should include steps to correct the input fields based on error messages.\n" +
      "If a captcha is detected, the plan should include a 'solve_captcha' step.\n" +
      "If a redirect occurred, ensure the plan acknowledges the new URL.\n" +
      "If the error is unrecoverable, the plan should reflect that.\n\n" +
      "Focus on:\n" +
      "- Adapting to the current page structure and messages.\n" +
      "- Correcting any errors from the previous submission.\n" +
      "- Using specific selectors based on the page content and form analysis.\n" +
      "- Adding necessary wait conditions.\n" +
      "- Suggesting alternative data if a specific input (e.g., email) is already taken.\n";

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
      const prompt = "You are an AI web automation assistant. Improve the execution plan based on the current page content and any errors encountered.\n" +
      "This function is a general fallback for plan improvement when a specific form submission context is not available.\n\n" +
      "Original Plan:\n" +
      JSON.stringify(originalPlan, null, 2) + "\n\n" +
      "Current Page Content (truncated to 1500 chars):\n" +
      pageContent.substring(0, 1500) + "...\n\n" +
      (error ? `Error Encountered: ${error}` : '') + "\n\n" +
      "Provide an improved JSON execution plan with the same structure as createExecutionPlan.\n\n" +
      "Focus on:\n" +
      "- Adapting to the current page structure.\n" +
      "- Fixing any errors in the original plan.\n" +
      "- Using more specific selectors based on the page content.\n" +
      "- Adding necessary wait conditions.\n" +
      "- If the error suggests a fundamental issue (e.g., site down, element consistently missing), consider a 'wait' or 'navigate' to a known good state.\n";

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


