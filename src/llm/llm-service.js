const { summarizeWithGemini } = require('./gemini-service');
const { summarizeWithChatGPT } = require('./chatgpt-service');
const { createDefaultPromptFile } = require('./gemini-service');
const { prompt } = require('../utils');

/**
 * Unified LLM service that routes to the correct provider
 * @param {Array} projectCommits - Array of objects with {projectName, commits: []}
 * @param {Object} config - Configuration object
 * @param {string} blockerInfo - Blocker information from user
 * @returns {Promise<string|null>} - AI generated summary or null
 */
async function summarizeWithLLM(projectCommits, config, blockerInfo = 'None') {
  const llmProvider = config.llmProvider || 'gemini'; // Default to Gemini

  // Log data summary first
  console.log('📊 Data Summary:');
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
  console.log('');

  // Then show which LLM provider is being used
  console.log(`🤖 Using LLM Provider: ${llmProvider.toUpperCase()}`);
  console.log('🤖 Generating AI summary...\n');

  // Validate API key exists before making the call
  if (llmProvider === 'gemini') {
    if (!config.geminiApiKey || !config.geminiApiKey.trim()) {
      throw new Error(
        'Gemini API key is not configured. Please run --setup or --switch-llm to configure it.'
      );
    }
    return await summarizeWithGemini(
      projectCommits,
      config.geminiApiKey,
      blockerInfo
    );
  } else if (llmProvider === 'chatgpt') {
    if (!config.chatgptApiKey || !config.chatgptApiKey.trim()) {
      throw new Error(
        'ChatGPT API key is not configured. Please run --setup or --switch-llm to configure it.'
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
function displaySummary(summary, provider = 'AI') {
  console.log('\n═══════════════════════════════════════');
  console.log(`🤖 ${provider.toUpperCase()} Summary`);
  console.log('═══════════════════════════════════════');
  console.log(summary);
  console.log('═══════════════════════════════════════\n');
}

/**
 * Switch between LLM providers (Gemini <-> ChatGPT)
 */
async function switchLLM() {
  const config = loadConfig();

  if (!config) {
    console.error('❌ No configuration found. Please run initial setup first.');
    console.log('💡 Run: node git-log.js --setup\n');
    process.exit(1);
  }

  const currentProvider = config.llmProvider || 'gemini';
  console.log(`\n🔄 Current LLM Provider: ${currentProvider.toUpperCase()}\n`);

  console.log('Choose your preferred LLM provider:');
  console.log('1. Gemini (Google)');
  console.log('2. ChatGPT (OpenAI)');

  let llmChoice = '';
  while (!['1', '2'].includes(llmChoice)) {
    llmChoice = await prompt('Enter your choice (1 or 2): ');
    if (!['1', '2'].includes(llmChoice)) {
      console.log('❌ Invalid choice. Please enter 1 or 2.');
    }
  }

  if (llmChoice === '1') {
    config.llmProvider = 'gemini';
    console.log('\n✓ Switched to: Gemini');

    // Check if API key exists, if not ask for it
    if (!config.geminiApiKey || !config.geminiApiKey.trim()) {
      console.log('⚠️  Gemini API key not found in config');
      let geminiApiKey = '';
      while (!geminiApiKey.trim()) {
        geminiApiKey = await prompt('Enter your Gemini API key: ');
        if (!geminiApiKey.trim()) {
          console.log(
            '❌ Gemini API key is required. Please provide a valid key.'
          );
        }
      }
      config.geminiApiKey = geminiApiKey.trim();
    } else {
      console.log('✓ Using existing Gemini API key');
    }
  } else {
    config.llmProvider = 'chatgpt';
    console.log('\n✓ Switched to: ChatGPT');

    // Check if API key exists, if not ask for it
    if (!config.chatgptApiKey || !config.chatgptApiKey.trim()) {
      console.log('⚠️  ChatGPT API key not found in config');
      let chatgptApiKey = '';
      while (!chatgptApiKey.trim()) {
        chatgptApiKey = await prompt('Enter your OpenAI API key: ');
        if (!chatgptApiKey.trim()) {
          console.log(
            '❌ OpenAI API key is required. Please provide a valid key.'
          );
        }
      }
      config.chatgptApiKey = chatgptApiKey.trim();
    } else {
      console.log('✓ Using existing OpenAI API key');
    }
  }

  saveConfig(config);
  console.log(
    `\n✅ LLM provider switched to ${config.llmProvider.toUpperCase()}!\n`
  );
}

module.exports = {
  summarizeWithLLM,
  displaySummary,
  createDefaultPromptFile,
  switchLLM,
};
