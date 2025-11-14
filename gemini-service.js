const fs = require("fs");
const path = require("path");
const https = require("https");

const PROMPT_FILE = path.join(__dirname, "custom-prompt.txt");

// Default prompt template
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
 * Create default prompt file if it doesn't exist
 */
function createDefaultPromptFile() {
  if (!fs.existsSync(PROMPT_FILE)) {
    fs.writeFileSync(PROMPT_FILE, DEFAULT_PROMPT);
    console.log(`✅ Created custom prompt template at: ${PROMPT_FILE}`);
    console.log("💡 You can edit this file to customize the AI prompt\n");
  }
}

/**
 * Make HTTPS request (no external packages needed)
 * @param {string} url - The URL to request
 * @param {Object} options - Request options
 * @param {string} postData - POST data
 * @returns {Promise<Object>} - Response data
 */
function makeHttpsRequest(url, options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const jsonData = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(jsonData);
          } else {
            reject({
              statusCode: res.statusCode,
              statusMessage: res.statusMessage,
              data: jsonData,
            });
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}

/**
 * Summarize commits using Gemini API
 * @param {Array} projectCommits - Array of objects with {projectName, commits: []}
 * @param {string} apiKey - Gemini API key
 * @param {string} blockerInfo - Blocker information from user
 * @returns {Promise<string|null>} - AI generated summary or null
 */
async function summarizeWithGemini(
  projectCommits,
  apiKey,
  blockerInfo = "None"
) {
  try {
    // STEP 1: Load the custom prompt template (or use default)
    const promptTemplate = loadPromptTemplate();

    // STEP 2: Store all project data in a structured variable
    // This includes: git commits + Jira ticket details + active tickets
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

    // STEP 3: Create the final prompt by combining:
    // - Custom prompt template
    // - Stored project data (commits + tickets)
    // - Blocker information
    let finalPrompt = promptTemplate.replace("{PROJECT_DATA}", projectDataText);
    finalPrompt = finalPrompt.replace("{BLOCKERS}", blockerInfo);

    // Log the data being sent (optional - for debugging)
    console.log("📊 Data Summary:");
    console.log(`   - Projects: ${projectCommits.length}`);
    const totalCommits = projectCommits.reduce(
      (sum, p) => sum + (p.commits?.length || 0),
      0
    );
    const totalTickets = projectCommits.reduce(
      (sum, p) => sum + (p.activeTickets?.length || 0),
      0
    );
    console.log(`   - Total Commits: ${totalCommits}`);
    console.log(`   - Total Active Tickets: ${totalTickets}`);
    console.log(`   - Blocker: ${blockerInfo}`);
    console.log("");

    // STEP 4: Prepare the request payload for Google Gemini LLM
    const postData = JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: finalPrompt, // Send the complete prompt with all data
            },
          ],
        },
      ],
    });

    // STEP 5: Send request to Google Gemini API
    // Using gemini-2.5-pro for better quality responses
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    // STEP 6: Make the API call and get the response
    const responseData = await makeHttpsRequest(url, options, postData);

    // STEP 7: Extract the AI-generated summary from response
    const aiGeneratedSummary =
      responseData.candidates?.[0]?.content?.parts?.[0]?.text;

    // STEP 8: Return the final response
    return aiGeneratedSummary || null;
  } catch (error) {
    if (error.data?.error?.message) {
      throw new Error(
        `Gemini API error: ${error.statusMessage} - ${error.data.error.message}`
      );
    }
    throw new Error(`Failed to generate AI summary: ${error.message}`);
  }
}
/**
 * Display the AI summary in a formatted box
 * @param {string} summary - The AI generated summary
 */
function displaySummary(summary) {
  console.log("\n═══════════════════════════════════════");
  console.log("🤖 AI Summary");
  console.log("═══════════════════════════════════════");
  console.log(summary);
  console.log("═══════════════════════════════════════\n");
}

module.exports = {
  summarizeWithGemini,
  displaySummary,
  createDefaultPromptFile,
  loadPromptTemplate,
};
