#!/usr/bin/env node

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const readline = require("readline");
const { fetchTicketDescription } = require("./ticket-api");
const {
  summarizeWithGemini,
  displaySummary,
  createDefaultPromptFile,
} = require("./gemini-service");

const CONFIG_FILE = path.join(__dirname, "config.json");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Function to prompt user for input
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

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

// Function to run initial setup
async function setupConfig() {
  console.log("\n🔧 First-time setup - Let's configure your environment\n");

  const config = {};

  // Project Name
  config.projectName = await prompt("Enter your project name: ");

  // Project Path
  config.projectPath = await prompt("Enter the path to your project: ");

  // Author
  config.author = await prompt("Enter your git author name: ");

  // Gemini API Key (Mandatory)
  console.log("\n🤖 AI Configuration (Required):");
  let geminiApiKey = "";
  while (!geminiApiKey.trim()) {
    geminiApiKey = await prompt("Enter your Gemini API key (required): ");
    if (!geminiApiKey.trim()) {
      console.log(
        "❌ Gemini API key is mandatory. Please provide a valid key."
      );
    }
  }
  config.geminiApiKey = geminiApiKey.trim();

  // Jira Integration
  const useJira = await prompt("\nDo you use Jira? (yes/no): ");
  let jiraConfig = null;

  if (useJira.toLowerCase() === "yes" || useJira.toLowerCase() === "y") {
    console.log("\n📋 Jira Configuration:");
    const jiraDomain = await prompt(
      "Enter Jira domain (e.g., your-domain.atlassian.net): "
    );
    const jiraEmail = await prompt("Enter Jira email: ");
    const jiraApiToken = await prompt("Enter Jira API token: ");

    jiraConfig = {
      domain: jiraDomain,
      email: jiraEmail,
      apiToken: jiraApiToken,
    };

    config.taskManagementSystem = "jira";
    config.jiraDomain = jiraDomain;
    config.jiraEmail = jiraEmail;
    config.jiraApiToken = jiraApiToken;
  } else {
    config.taskManagementSystem = "none";
  }

  // Custom patterns
  config.customTicketPatterns = [];
  config.setupDate = new Date().toISOString();

  // Save config
  saveConfig(config);
  return config;
}

(async () => {
  try {
    // Check for command line arguments
    const args = process.argv.slice(2);

    if (args.includes("--setup") || args.includes("-s")) {
      // Force setup by deleting existing config
      if (fs.existsSync(CONFIG_FILE)) {
        fs.unlinkSync(CONFIG_FILE);
        console.log("🗑️  Existing configuration deleted.\n");
      }
    }

    if (args.includes("--help") || args.includes("-h")) {
      console.log("\n📚 Git Summary Tool - Usage:\n");
      console.log(
        "  node git-log.js           Run the tool with existing config"
      );
      console.log(
        "  node git-log.js --setup   Delete config and run initial setup"
      );
      console.log("  node git-log.js -s        Short version of --setup");
      console.log("  node git-log.js --help    Show this help message");
      console.log("  node git-log.js -h        Short version of --help\n");
      process.exit(0);
    }

    let config = loadConfig();

    // Check if config file exists
    if (!config) {
      config = await setupConfig();
    } else {
      console.log("✅ Using saved configuration\n");
    }

    rl.close();

    if (!config.projectPath) {
      console.error("❌ Error: projectPath is not configured");
      process.exit(1);
    }

    if (!config.geminiApiKey) {
      console.error("❌ Error: Gemini API key is not configured");
      console.log("💡 Run 'node git-log.js --setup' to configure it\n");
      process.exit(1);
    }

    const absolutePath = path.resolve(config.projectPath);
    const today = new Date();

    // Format date to: "Fri Nov 7 07:11:18 2025 +0000"
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const dayName = days[today.getDay()];
    const monthName = months[today.getMonth()];
    const date = today.getDate();
    const hours = String(today.getHours()).padStart(2, "0");
    const minutes = String(today.getMinutes()).padStart(2, "0");
    const seconds = String(today.getSeconds()).padStart(2, "0");
    const year = today.getFullYear();

    const formattedDate = `${dayName} ${monthName} ${date} ${hours}:${minutes}:${seconds} ${year} +0000`;

    let gitCommand = `git log --oneline --since="yesterday"`;

    if (config.author) {
      gitCommand += ` --author="${config.author}"`;
    }

    console.log("\n📊 Git Activity Report");
    console.log("═══════════════════════════════════════");
    console.log(`📁 Project: ${config.projectPath}`);
    console.log(`👤 Author: ${config.author}`);
    console.log(`📅 Date: ${formattedDate}`);
    console.log("═══════════════════════════════════════\n");

    const result = execSync(gitCommand, {
      cwd: absolutePath,
      encoding: "utf-8",
    });

    const commits = result
      .trim()
      .split("\n")
      .filter((line) => line);

    if (commits.length === 0 || (commits.length === 1 && commits[0] === "")) {
      console.log("ℹ️  No commits found for today.\n");
    } else {
      console.log("✨ Commits:\n");

      // Built-in patterns for Jira
      const builtInPatterns = [
        /[A-Z]+\d*-\d+/, // Jira: PROJ-123, M3-3633
      ];

      // Combine built-in patterns with custom patterns from config
      const patterns = [...builtInPatterns];
      if (
        config.customTicketPatterns &&
        Array.isArray(config.customTicketPatterns)
      ) {
        config.customTicketPatterns.forEach((pattern) => {
          patterns.push(new RegExp(pattern));
        });
      }

      const commitDetails = [];

      // Store commits for AI processing but continue execution
      for (const commit of commits) {
        let ticketId = "No ticket ID";

        for (const pattern of patterns) {
          const match = commit.match(pattern);
          if (match) {
            ticketId = match[0];
            break;
          }
        }

        const ticketInfo = await fetchTicketDescription(ticketId, config);

        if (ticketInfo) {
          const displayLine = `${ticketId} | ${ticketInfo.title}`;
          console.log(displayLine);
          console.log(`  Description: ${ticketInfo.description}`);
          console.log(`  ${commit}\n`);
          commitDetails.push(`${ticketId} | ${ticketInfo.title} - ${commit}`);
        } else {
          console.log(`${ticketId} | ${commit}\n`);
          commitDetails.push(commit);
        }
      }

      // Ask about blockers
      const rlBlocker = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const hasBlockers = await new Promise((resolve) => {
        rlBlocker.question(
          "\n🚧 Do you have any blockers? (yes/no): ",
          (answer) => {
            resolve(answer);
          }
        );
      });

      let blockerInfo = "None";
      if (
        hasBlockers.toLowerCase() === "yes" ||
        hasBlockers.toLowerCase() === "y"
      ) {
        blockerInfo = await new Promise((resolve) => {
          rlBlocker.question("Please describe your blocker(s): ", (answer) => {
            rlBlocker.close();
            resolve(answer);
          });
        });
      } else {
        rlBlocker.close();
      }

      // Start AI summary generation
      console.log("\n🤖 Generating AI summary...");

      // Process AI summary - execution continues while waiting
      try {
        const summary = await summarizeWithGemini(
          commitDetails,
          config.geminiApiKey,
          config.projectName || "Project",
          blockerInfo
        );
        if (summary) {
          displaySummary(summary);
        } else {
          console.log("⚠️  No summary generated\n");
        }
      } catch (error) {
        console.error(`⚠️  ${error.message}\n`);
      }
    }

    // Show additional info if Jira is configured
    if (config.taskManagementSystem === "jira" && config.jiraDomain) {
      console.log("📋 Jira Integration: Enabled");
      console.log(`   Domain: ${config.jiraDomain}`);
    }

    console.log(
      `\n💡 Tip: To reset configuration, run: node git-log.js --setup\n`
    );
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
})();
