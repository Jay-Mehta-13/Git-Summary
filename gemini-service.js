const fs = require("fs");
const path = require("path");
const https = require("https");

const PROMPT_FILE = path.join(__dirname, "custom-prompt.txt");

// Default prompt template
const DEFAULT_PROMPT = `You are a technical assistant helping create a daily standup update. Analyze these git commits (organized by project) and blocker information to provide a summary in the following format:

Blocker:
   [Analyze the blocker information and determine which project(s) it affects. ONLY show projects that have actual blockers. If there are no blockers at all, just output "   • None". Do NOT list projects with "None" - only include projects that have real blockers]
   
   Project Name (only if it has blockers):
   • [Project-specific blocker description]

Today's Update:
   [For EACH project that has commits, create a section with project name and bullet points]
   
   Project Name 1:
   • [Create bullet points from the git commits - each commit should be a concise bullet point describing what was done]
   
   Project Name 2:
   • [Create bullet points for this project's commits]

Tomorrow's Plan:
   [Organize tomorrow's plan by project, suggesting next steps for each project based on today's commits]
   
   Project Name 1:
   • [Based on this project's commits, suggest what might be the next logical steps]
   
   Project Name 2:
   • [Based on this project's commits, suggest what might be the next logical steps]

Git commits organized by project:
{COMMITS}

Blocker information provided by user:
{BLOCKERS}

Important:
- DO NOT use bold formatting (no ** or __) anywhere in the response
- Use plain text only with proper indentation
- For the Blocker section: ONLY list projects that have actual blockers. If no blockers at all, just write "   • None". Do NOT write "Project Name: • None" for projects without blockers. Only show project sections when there are real blockers for that project. Use proper indentation (3 spaces before the bullet).
- For Today's Update: Create separate sections for EACH project. Use the exact project names from the commits above
- For Tomorrow's Plan: Create separate sections for EACH project with next steps specific to that project's work
- When creating bullet points for Today's Update, first search for ticket ID patterns (like AY1Q-T296, PROJ-123, etc.) in the git commit and include it at the start of the bullet point, followed by the description (Example: • AY1Q-T296: Fixed view creation logic)
- Use bullet point character (•) for all lists (blockers, todays update and tomorrow's plan), not asterisks (*)
- Keep all bullet points concise and professional
- Focus on what was accomplished based on the commits for each project
- Suggest logical next steps for Tomorrow's Plan specific to each project's context`;

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
    const promptTemplate = loadPromptTemplate();

    // Build commits text organized by project
    let commitsText = "";
    let projectNames = [];

    for (const project of projectCommits) {
      projectNames.push(project.projectName);
      commitsText += `\n=== ${project.projectName} ===\n`;
      commitsText += project.commits.join("\n");
      commitsText += "\n";
    }

    // Replace placeholders with actual data
    let prompt = promptTemplate.replace("{COMMITS}", commitsText);
    prompt = prompt.replace("{PROJECT_NAMES}", projectNames.join(", "));
    prompt = prompt.replace("{BLOCKERS}", blockerInfo);

    const postData = JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
    });

    // Use gemini-2.5-flash (fast and free tier available)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const data = await makeHttpsRequest(url, options, postData);
    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;

    return summary || null;
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
