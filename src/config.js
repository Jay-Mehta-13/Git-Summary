const path = require('path');
const { prompt } = require('./utils');
const fs = require('fs');

const CONFIG_FILE = path.join(__dirname, '../config.json');

// Function to load config
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading config file:', error.message);
  }
  return null;
}

// Function to save config
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log('✅ Configuration saved successfully!\n');

    // Create default prompt file
    createDefaultPromptFile();
  } catch (error) {
    console.error('Error saving config file:', error.message);
  }
}

// Function to run initial setup
async function setupConfig() {
  console.log("\n🔧 First-time setup - Let's configure your environment\n");

  const config = {
    projects: [],
    customTicketPatterns: [],
  };

  // Author
  config.author = await prompt('Enter your git author name: ');

  // AI/LLM Configuration
  console.log('\n🤖 AI Configuration:');
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
    console.log('\n✓ Selected: Gemini');
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
    config.llmProvider = 'chatgpt';
    console.log('\n✓ Selected: ChatGPT');
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
  }

  // Add first project
  console.log('\n📁 Project Configuration:');
  const firstProject = await setupProject();
  config.projects.push(firstProject);

  config.setupDate = new Date().toISOString();

  // Save config
  saveConfig(config);
  return config;
}

// Function to setup a project
async function setupProject() {
  const project = {};

  // Project Name
  project.name = await prompt('Enter project name: ');

  // Project Path
  project.path = await prompt('Enter the path to your project: ');

  // Jira Integration
  const useJira = await prompt(
    '\nDo you use Jira for this project? (yes/no): '
  );

  if (useJira.toLowerCase() === 'yes' || useJira.toLowerCase() === 'y') {
    console.log('\n📋 Jira Configuration:');
    const jiraDomain = await prompt(
      'Enter Jira domain (e.g., your-domain.atlassian.net): '
    );
    const jiraApiEmail = await prompt(
      'Enter Jira API email (email of user who created the API token): '
    );
    const jiraApiToken = await prompt('Enter Jira API token: ');
    const jiraAssigneeEmail = await prompt(
      'Enter assignee email (email to fetch assigned tickets for): '
    );

    project.jira = {
      domain: jiraDomain,
      apiEmail: jiraApiEmail,
      apiToken: jiraApiToken,
      assigneeEmail: jiraAssigneeEmail,
    };
  }

  return project;
}

// Function to add a new project
async function addProject() {
  const config = loadConfig();
  if (!config) {
    console.error('❌ No configuration found. Please run initial setup first.');
    console.log('💡 Run: node git-log.js --setup\n');
    process.exit(1);
  }

  console.log('\n➕ Adding a new project\n');
  const newProject = await setupProject();
  config.projects.push(newProject);

  saveConfig(config);
  console.log(`✅ Project "${newProject.name}" added successfully!\n`);
}

// Function to list all projects
function listProjects() {
  const config = loadConfig();
  if (!config) {
    console.error('❌ No configuration found. Please run initial setup first.');
    console.log('💡 Run: node git-log.js --setup\n');
    process.exit(1);
  }

  if (!config.projects || config.projects.length === 0) {
    console.log('\nℹ️  No projects configured.\n');
    return;
  }

  console.log('\n📋 Configured Projects:\n');
  config.projects.forEach((project, index) => {
    console.log(`${index + 1}. ${project.name}`);
    console.log(`   Path: ${project.path}`);
    console.log(`   Jira: ${project.jira ? '✓ Enabled' : '✗ Disabled'}`);
    console.log('');
  });
}

module.exports = {
  loadConfig,
  saveConfig,
  setupConfig,
  addProject,
  listProjects,
};
