const { summarizeWithGemini } = require("./gemini-service");
const { summarizeWithChatGPT } = require("./chatgpt-service");
const { createDefaultPromptFile } = require("./gemini-service");

/**
 * Unified LLM service that routes to the correct provider
 * @param {Array} projectCommits - Array of objects with {projectName, commits: []}
 * @param {Object} config - Configuration object
 * @param {string} blockerInfo - Blocker information from user
 * @returns {Promise<string|null>} - AI generated summary or null
 */
async function summarizeWithLLM(projectCommits, config, blockerInfo = "None") {
  const llmProvider = config.llmProvider || "gemini"; // Default to Gemini

  // Log data summary first
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

  // Then show which LLM provider is being used
  console.log(`🤖 Using LLM Provider: ${llmProvider.toUpperCase()}`);
  console.log("🤖 Generating AI summary...\n");

  // Validate API key exists before making the call
  if (llmProvider === "gemini") {
    if (!config.geminiApiKey || !config.geminiApiKey.trim()) {
      throw new Error(
        "Gemini API key is not configured. Please run --setup or --switch-llm to configure it."
      );
    }
    return await summarizeWithGemini(
      projectCommits,
      config.geminiApiKey,
      blockerInfo
    );
  } else if (llmProvider === "chatgpt") {
    if (!config.chatgptApiKey || !config.chatgptApiKey.trim()) {
      throw new Error(
        "ChatGPT API key is not configured. Please run --setup or --switch-llm to configure it."
      );
    }
    return await summarizeWithChatGPT(
      projectCommits,
      config.chatgptApiKey,
      blockerInfo
    );
  } else {
    throw new Error(
      `Unknown LLM provider: ${llmProvider}. Supported providers: gemini, chatgpt`
    );
  }
}

/**
 * Display the AI summary in a formatted box
 * @param {string} summary - The AI generated summary
 * @param {string} provider - The LLM provider used
 */
function displaySummary(summary, provider = "AI") {
  console.log("\n═══════════════════════════════════════");
  console.log(`🤖 ${provider.toUpperCase()} Summary`);
  console.log("═══════════════════════════════════════");
  console.log(summary);
  console.log("═══════════════════════════════════════\n");
}

module.exports = {
  summarizeWithLLM,
  displaySummary,
  createDefaultPromptFile,
};
