# Dyoraireal - AI Web Agent Installation Guide

This guide will walk you through the steps to set up and run the Dyoraireal AI Web Agent on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 18 or higher (LTS recommended)
- **npm** (Node Package Manager): Comes bundled with Node.js
- **Git**: For cloning the repository

## Installation Steps

Follow these steps to get Dyoraireal up and running:

### 1. Clone the Repository

Open your terminal or command prompt and run the following command to clone the Dyoraireal repository:

```bash
git clone https://github.com/green1st/real.git
cd real
```

### 2. Install Dependencies

Navigate into the cloned directory and install the necessary Node.js dependencies:

```bash
cd Dyoraireal
npm install
```

### 3. Environment Configuration

Dyoraireal uses environment variables for configuration, such as API keys for Gemini and Captcha services. Create a `.env` file in the `Dyoraireal` directory (the same directory as `index.js`) and add your configurations. An example `.env` file might look like this:

```
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
CAPTCHA_API_KEY=YOUR_CAPTCHA_API_KEY
```

- Replace `YOUR_GEMINI_API_KEY` with your actual Google Gemini API key.
- Replace `YOUR_CAPTCHA_API_KEY` with your actual Captcha service API key (e.g., 2Captcha).

### 4. Run the Application

Once the dependencies are installed and the `.env` file is configured, you can start the Dyoraireal backend server:

```bash
node index.js
```

### 5. Access the Frontend Dashboard

After the backend server starts, you can access the enhanced web dashboard by opening your web browser and navigating to:

```
http://localhost:3000/enhanced-index.html
```

### 6. Monitor Browser Automation (Non-Headless Mode)

Dyoraireal is configured to run the browser in non-headless mode by default, meaning you will see the browser window pop up and perform actions as the AI executes tasks. This allows for visual monitoring of the automation process.

## Important Notes

- **API Keys**: Ensure your API keys are valid and have the necessary permissions.
- **Proxy Configuration**: You can configure proxy settings directly from the frontend dashboard under the "Settings" section.
- **Troubleshooting**: If you encounter any issues, check the terminal where `node index.js` is running for error messages. You can also inspect the browser console for frontend-related errors.

Enjoy automating your web tasks with Dyoraireal!

