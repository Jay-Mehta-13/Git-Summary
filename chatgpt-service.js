const fs = require("fs");
const path = require("path");

const PROMPT_FILE = path.join(__dirname, "custom-prompt.txt");

// Default prompt template (shared with Gemini)
const DEFAULT_PROMPT = `You are a technical assistant helping create a daily standup update. Analyze git commits, Jira ticket details, active tickets, and blocker information to provide a comprehensive summary.

You will receive for each project:
1. Git commits with associated Jira ticket details (ticket ID, title, description, status, priority)
2. List of all active "To Do" and "In Progress" Jira tickets assigned to the user (sorted by priority: Highest → High → Medium → Low → None)
3. Blocker information

Provide a summary in the EXACT following format:

Blocker:
   None (or bullet points if blockers exist)

Today's Update:
   PROJECT_NAME:
   • Ticket-ID: Description of work done

Tomorrow's Plan:
   PROJECT_NAME:
   • Ticket-ID: Suggested next steps based on today's work and jira ticket priority

DETAILED INSTRUCTIONS:

1. BLOCKER SECTION:
   - If no blockers: Write exactly "   None"
   - If blockers exist: Add bullet points with project context if needed
   - Do NOT create project sections unless there are actual blockers

2. TODAY'S UPDATE SECTION:
   - For EACH project that has commits, create a section with project name
   - Format: PROJECT_NAME:
   - Each bullet point must start with Ticket-ID followed by description
   - Example: • KAN-123: Implemented user authentication logic
   - Be concise and clear about what was accomplished

3. TOMORROW'S PLAN SECTION:
   - For EACH project, create a section with project name
   - Format: PROJECT_NAME:
   - PRIORITIZE by ticket priority (Highest → High → Medium → Low → None)
   - Each bullet point must start with Ticket-ID followed by next action
   - Consider both: work from today AND other active To Do/In Progress tickets
   - Example: • KAN-456: Complete API integration and add error handling

Data provided (includes git commits with Jira ticket details and active tickets):
{PROJECT_DATA}

Blocker information provided by user:
{BLOCKERS}

IMPORTANT RULES:
- DO NOT use bold formatting (no ** or __) anywhere
- Use plain text only with proper indentation (3 spaces before content)
- Use bullet point character (•) for all lists, NOT asterisks (*)
- Always start bullet points with Ticket-ID
- Keep descriptions concise and actionable
- Follow the EXACT structure shown above
- Use exact project names from the data provided
- For Blocker: Write "   None" if no blockers (NOT "• None")
- Indentation: Project names have 3 spaces, bullet points have 3 spaces`;

/**
 * Load custom prompt from file or use default
 */
function loadPromptTemplate() {
  try {
    if (fs.existsSync(PROMPT_FILE)) {
      const customPrompt = fs.readFileSync(PROMPT_FILE, "utf-8");
      if (customPrompt.trim()) {
        return customPrompt;
      }
    }
  } catch (error) {
    console.warn("⚠️  Could not load custom prompt, using default");
  }
  return DEFAULT_PROMPT;
}

/**
 * Make request using fetch
 * @param {string} url - The URL to request
 * @param {Object} options - Request options
 * @param {string} postData - POST data
 * @returns {Promise<Object>} - Response data
 */
async function makeRequest(url, options, postData) {
  try {
    const response = await fetch(url, {
      method: options.method,
      headers: options.headers,
      body: postData,
    });

    const jsonData = await response.json();

    if (response.ok) {
      return jsonData;
    } else {
      throw {
        statusCode: response.status,
        statusMessage: response.statusText,
        data: jsonData,
      };
    }
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }
    throw new Error(`Failed to make request: ${error.message}`);
  }
}

/**
 * Make a single API call to ChatGPT with a specific model
 * @param {string} model - Model name (e.g., "gpt-4o-mini", "gpt-3.5-turbo")
 * @param {string} apiKey - OpenAI API key
 * @param {string} finalPrompt - Complete prompt to send
 * @returns {Promise<string|null>} - AI generated summary or null
 */
async function callChatGPTAPI(model, apiKey, finalPrompt) {
  const postData = JSON.stringify({
    model: model,
    messages: [
      {
        role: "user",
        content: finalPrompt,
      },
    ],
    temperature: 0.7,
  });

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  };

  const url = "https://api.openai.com/v1/chat/completions";
  const responseData = await makeRequest(url, options, postData);

  const aiGeneratedSummary = responseData.choices?.[0]?.message?.content;
  return aiGeneratedSummary || null;
}

/**
 * Check if error should trigger retry or model fallback
 * @param {Error} error - The error object
 * @returns {Object} - {shouldRetry: boolean, shouldFallback: boolean}
 */
function analyzeError(error) {
  const errorMessage = error.message || error.toString();
  const errorData = error.data?.error?.message || "";
  const errorCode = error.data?.error?.code || "";

  // Don't retry for quota/billing errors
  if (
    errorMessage.toLowerCase().includes("quota") ||
    errorMessage.toLowerCase().includes("billing") ||
    errorData.toLowerCase().includes("quota") ||
    errorData.toLowerCase().includes("billing") ||
    errorCode === "insufficient_quota"
  ) {
    return { shouldRetry: false, shouldFallback: false };
  }

  // Don't retry for invalid API key
  if (
    errorMessage.toLowerCase().includes("invalid api key") ||
    errorMessage.toLowerCase().includes("unauthorized") ||
    errorData.toLowerCase().includes("invalid api key") ||
    errorCode === "invalid_api_key"
  ) {
    return { shouldRetry: false, shouldFallback: false };
  }

  // Model not found or not available - try fallback models
  if (
    errorMessage.toLowerCase().includes("model") ||
    errorData.toLowerCase().includes("model") ||
    errorCode === "model_not_found"
  ) {
    return { shouldRetry: false, shouldFallback: true };
  }

  // Rate limit - don't retry immediately
  if (
    errorMessage.toLowerCase().includes("rate limit") ||
    errorData.toLowerCase().includes("rate limit") ||
    errorCode === "rate_limit_exceeded"
  ) {
    return { shouldRetry: false, shouldFallback: false };
  }

  // Retry for all other errors (network, timeout, server errors)
  return { shouldRetry: true, shouldFallback: true };
}

/**
 * Summarize commits using ChatGPT API with retry mechanism and model fallback
 * @param {Array} projectCommits - Array of objects with {projectName, commits: []}
 * @param {string} apiKey - OpenAI API key
 * @param {string} blockerInfo - Blocker information from user
 * @returns {Promise<string|null>} - AI generated summary or null
 */
async function summarizeWithChatGPT(
  projectCommits,
  apiKey,
  blockerInfo = "None"
) {
  // STEP 1: Load the custom prompt template (or use default)
  const promptTemplate = loadPromptTemplate();

  // STEP 2: Store all project data in a structured variable
  let projectDataText = "";

  // Loop through each project and build comprehensive data
  for (const project of projectCommits) {
    projectDataText += `\n=== PROJECT: ${project.projectName} ===\n\n`;

    // Store git commits with their associated Jira ticket details
    if (project.commits && project.commits.length > 0) {
      projectDataText += "GIT COMMITS WITH TICKET DETAILS:\n";
      projectDataText += project.commits.join("\n");
      projectDataText += "\n\n";
    }

    // Store all active Jira tickets (To Do and In Progress) sorted by priority
    if (project.activeTickets && project.activeTickets.length > 0) {
      projectDataText +=
        "ACTIVE JIRA TICKETS (To Do & In Progress - Sorted by Priority):\n";
      project.activeTickets.forEach((ticket) => {
        projectDataText += `${ticket.key} [Status: ${ticket.status}] [Priority: ${ticket.priority}]\n`;
        projectDataText += `  Title: ${ticket.summary}\n`;
        projectDataText += `  Description: ${ticket.description}\n`;
        projectDataText += `  Type: ${ticket.type}\n\n`;
      });
    }

    projectDataText += "=".repeat(50) + "\n";
  }

  // STEP 3: Create the final prompt
  let finalPrompt = promptTemplate.replace("{PROJECT_DATA}", projectDataText);
  finalPrompt = finalPrompt.replace("{BLOCKERS}", blockerInfo);

  // STEP 4: Retry mechanism with model fallback
  // Try different models in order of preference
  const retrySequence = [
    {
      model: "gpt-4o-mini",
      attempt: 1,
      description: "GPT-4o Mini (Cost-effective)",
    },
    { model: "gpt-4o-mini", attempt: 2, description: "GPT-4o Mini (Retry)" },
    {
      model: "gpt-3.5-turbo",
      attempt: 1,
      description: "GPT-3.5 Turbo (Fallback)",
    },
    {
      model: "gpt-3.5-turbo",
      attempt: 2,
      description: "GPT-3.5 Turbo (Retry)",
    },
    {
      model: "gpt-4o-mini",
      attempt: 3,
      description: "GPT-4o Mini (Final attempt)",
    },
  ];

  let lastError = null;

  for (let i = 0; i < retrySequence.length; i++) {
    const { model, attempt, description } = retrySequence[i];

    try {
      // Log retry attempts (except first attempt)
      if (i > 0) {
        console.log(`🔄 Retrying with ${description}...`);
      }

      const summary = await callChatGPTAPI("gpt-4o-mini", apiKey, finalPrompt);

      // If successful, return immediately
      if (summary) {
        if (i > 0) {
          console.log(`✅ Successfully generated summary with ${model}`);
        }
        return summary;
      }
    } catch (error) {
      lastError = error;

      // Analyze the error
      const { shouldRetry, shouldFallback } = analyzeError(error);

      // If we shouldn't retry at all, throw immediately
      if (!shouldRetry && !shouldFallback) {
        const errorMsg = error.data?.error?.message || error.message;
        throw new Error(`ChatGPT API error: ${errorMsg}`);
      }

      // Log the error for this attempt
      const errorMsg = error.data?.error?.message || error.message;
      console.log(`⚠️  Attempt ${i + 1} failed with ${model}: ${errorMsg}`);

      // If this is not the last attempt, continue to next retry
      if (i < retrySequence.length - 1) {
        // Small delay before retry (1 second)
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
    }
  }

  // If we've exhausted all retries, throw the last error
  if (lastError) {
    if (lastError.data?.error?.message) {
      throw new Error(
        `ChatGPT API error after ${retrySequence.length} attempts: ${lastError.statusMessage} - ${lastError.data.error.message}`
      );
    }
    throw new Error(
      `Failed to generate AI summary after ${retrySequence.length} attempts: ${lastError.message}`
    );
  }

  throw new Error("Failed to generate AI summary: No response received");
}

module.exports = {
  summarizeWithChatGPT,
  loadPromptTemplate,
};
