const path = require('path');
const { prompt } = require('./utils');
const fs = require('fs');
const CONFIG_FILE = path.join(__dirname, '../config.json');

// Function to load config
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading config file:", error.message);
  }
  return null;
}

// Function to save config
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log("✅ Configuration saved successfully!\n");

    // Create default prompt file
    createDefaultPromptFile();
  } catch (error) {
    console.error("Error saving config file:", error.message);
  }
}

// Function to setup a project
async function setupProject() {
  const project = {};

  // Project Name
  project.name = await prompt("Enter project name: ");

  // Project Path
  project.path = await prompt("Enter the path to your project: ");

  // Jira Integration
  const useJira = await prompt(
    "\nDo you use Jira for this project? (yes/no): "
  );

  if (useJira.toLowerCase() === "yes" || useJira.toLowerCase() === "y") {
    console.log("\n📋 Jira Configuration:");
    const jiraDomain = await prompt(
      "Enter Jira domain (e.g., your-domain.atlassian.net): "
    );
    const jiraApiEmail = await prompt(
      "Enter Jira API email (email of user who created the API token): "
    );
    const jiraApiToken = await prompt("Enter Jira API token: ");
    const jiraAssigneeEmail = await prompt(
      "Enter assignee email (email to fetch assigned tickets for): "
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

// Function to run initial setup
async function setupConfig() {
  const { setupZohoIntegration } = require("./task-management/zoho-service");

  console.log("\n🔧 First-time setup - Let's configure your environment\n");

  const config = {
    projects: [],
    customTicketPatterns: [],
  };

  // Author
  config.author = await prompt("Enter your git author name: ");

  // AI/LLM Configuration
  console.log("\n🤖 AI Configuration:");
  console.log("Choose your preferred LLM provider:");
  console.log("1. Gemini (Google)");
  console.log("2. ChatGPT (OpenAI)");

  let llmChoice = "";
  while (!["1", "2"].includes(llmChoice)) {
    llmChoice = await prompt("Enter your choice (1 or 2): ");
    if (!["1", "2"].includes(llmChoice)) {
      console.log("❌ Invalid choice. Please enter 1 or 2.");
    }
  }

  if (llmChoice === "1") {
    config.llmProvider = "gemini";
    console.log("\n✓ Selected: Gemini");
    let geminiApiKey = "";
    while (!geminiApiKey.trim()) {
      geminiApiKey = await prompt("Enter your Gemini API key: ");
      if (!geminiApiKey.trim()) {
        console.log(
          "❌ Gemini API key is required. Please provide a valid key."
        );
      }
    }
    config.geminiApiKey = geminiApiKey.trim();
  } else {
    config.llmProvider = "chatgpt";
    console.log("\n✓ Selected: ChatGPT");
    let chatgptApiKey = "";
    while (!chatgptApiKey.trim()) {
      chatgptApiKey = await prompt("Enter your OpenAI API key: ");
      if (!chatgptApiKey.trim()) {
        console.log(
          "❌ OpenAI API key is required. Please provide a valid key."
        );
      }
    }
    config.chatgptApiKey = chatgptApiKey.trim();
  }

  // Ask about multiple projects
  console.log("\n════════════════════════════════════════════════════");
  console.log("📁 Project Configuration:");
  console.log("════════════════════════════════════════════════════\n");
  const multipleProjects = await prompt(
    "Are you working on multiple projects? (yes/no): "
  );

  // Add projects
  if (
    multipleProjects.toLowerCase() === "yes" ||
    multipleProjects.toLowerCase() === "y"
  ) {
    console.log("\n✓ Let's add all your projects\n");

    let addMoreProjects = true;
    let projectCount = 1;

    while (addMoreProjects) {
      console.log(`────────────────────────────────────────────────────`);
      console.log(`📦 Project #${projectCount}:`);
      console.log(`────────────────────────────────────────────────────\n`);
      const project = await setupProject();

      config.projects.push(project);
      projectCount++;

      // Ask if they want to add more
      const addMore = await prompt(
        "\nDo you want to add another project? (yes/no): "
      );
      addMoreProjects =
        addMore.toLowerCase() === "yes" || addMore.toLowerCase() === "y";
    }

    console.log(
      `\n✅ Added ${config.projects.length} projects successfully!\n`
    );
  } else {
    // Add single project
    console.log("\n✓ Let's set up your project\n");
    console.log(`────────────────────────────────────────────────────\n`);
    const firstProject = await setupProject();

    config.projects.push(firstProject);
  }

  // Ask about Zoho after all projects are configured
  console.log("\n════════════════════════════════════════════════════");
  console.log("📊 Zoho Projects Integration:");
  console.log("════════════════════════════════════════════════════\n");

  const useZoho = await prompt("Do you use Zoho Projects? (yes/no): ");

  let zohoSetupNeeded = false;
  let zohoCredentials = null;

  if (useZoho.toLowerCase() === "yes" || useZoho.toLowerCase() === "y") {
    console.log("\n✓ Let's configure Zoho integration\n");
    console.log(
      "ℹ️  You need to generate OAuth credentials from Zoho API Console"
    );
    console.log(
      "📖 See README.md for detailed instructions on generating these credentials\n"
    );

    const generatedCode = await prompt(
      "Enter Zoho generated code (grant code from Self Client): "
    );
    const clientId = await prompt("Enter Zoho client ID: ");
    const clientSecret = await prompt("Enter Zoho client secret: ");

    zohoSetupNeeded = true;
    zohoCredentials = {
      generatedCode: generatedCode.trim(),
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
    };

    console.log("\n✅ Zoho credentials collected!");
    console.log(
      "⚠️  Note: The generated code expires in 10 minutes and can only be used once.\n"
    );
  }

  config.setupDate = new Date().toISOString();

  // If Zoho credentials were provided, store them in config
  if (zohoSetupNeeded && zohoCredentials) {
    config.zoho = zohoCredentials;
  }

  // Save config
  saveConfig(config);

  // Run Zoho setup if credentials were provided
  if (zohoSetupNeeded && zohoCredentials) {
    console.log("\n════════════════════════════════════════════════════");
    console.log("🔄 Setting up Zoho integration...");
    console.log("════════════════════════════════════════════════════\n");

    const zohoSetupResult = await setupZohoIntegration();

    if (zohoSetupResult) {
      console.log("\n🎉 Zoho integration setup completed successfully!\n");
      console.log("════════════════════════════════════════════════════\n");
    } else {
      console.log(
        "\n⚠️  Zoho setup encountered issues. You can retry later with a fresh generated code.\n"
      );
      console.log("════════════════════════════════════════════════════\n");
    }
  }

  return config;
}

// Function to add a new project
async function addProject() {
  const config = loadConfig();
  if (!config) {
    console.error("❌ No configuration found. Please run initial setup first.");
    console.log("💡 Run: node git-log.js --setup\n");
    process.exit(1);
  }

  console.log("\n════════════════════════════════════════════════════");
  console.log("➕ Adding a new project");
  console.log("════════════════════════════════════════════════════\n");

  const newProject = await setupProject();

  config.projects.push(newProject);

  saveConfig(config);
  console.log(`\n✅ Project "${newProject.name}" added successfully!\n`);
}

// Function to list all projects
function listProjects() {
  const config = loadConfig();
  if (!config) {
    console.error("❌ No configuration found. Please run initial setup first.");
    console.log("💡 Run: node git-log.js --setup\n");
    process.exit(1);
  }

  if (!config.projects || config.projects.length === 0) {
    console.log("\nℹ️  No projects configured.\n");
    return;
  }

  console.log("\n📋 Configured Projects:\n");
  config.projects.forEach((project, index) => {
    console.log(`${index + 1}. ${project.name}`);
    console.log(`   Path: ${project.path}`);
    console.log(`   Jira: ${project.jira ? "✓ Enabled" : "✗ Disabled"}`);
    console.log("");
  });
}

module.exports = {
  loadConfig,
  saveConfig,
  setupConfig,
  addProject,
  listProjects,
  CONFIG_FILE
};
