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
    const jiraEmail = await prompt("Enter Jira email: ");
    const jiraApiToken = await prompt("Enter Jira API token: ");

    project.jira = {
      domain: jiraDomain,
      email: jiraEmail,
      apiToken: jiraApiToken,
    };
  }

  return project;
}

// Function to run initial setup
async function setupConfig() {
  console.log("\n🔧 First-time setup - Let's configure your environment\n");

  const config = {
    projects: [],
    customTicketPatterns: [],
  };

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

  // Add first project
  console.log("\n📁 Project Configuration:");
  const firstProject = await setupProject();
  config.projects.push(firstProject);

  config.setupDate = new Date().toISOString();

  // Save config
  saveConfig(config);
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

  console.log("\n➕ Adding a new project\n");
  const newProject = await setupProject();
  config.projects.push(newProject);

  saveConfig(config);
  console.log(`✅ Project "${newProject.name}" added successfully!\n`);
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

    if (args.includes("--add-project") || args.includes("-a")) {
      await addProject();
      rl.close();
      process.exit(0);
    }

    if (args.includes("--list-projects") || args.includes("-l")) {
      listProjects();
      rl.close();
      process.exit(0);
    }

    if (args.includes("--help") || args.includes("-h")) {
      console.log("\n📚 Git Summary Tool - Usage:\n");
      console.log(
        "  node git-log.js                  Run the tool with existing config"
      );
      console.log(
        "  node git-log.js --setup          Delete config and run initial setup"
      );
      console.log(
        "  node git-log.js -s               Short version of --setup"
      );
      console.log(
        "  node git-log.js --add-project    Add a new project to config"
      );
      console.log(
        "  node git-log.js -a               Short version of --add-project"
      );
      console.log(
        "  node git-log.js --list-projects  List all configured projects"
      );
      console.log(
        "  node git-log.js -l               Short version of --list-projects"
      );
      console.log("  node git-log.js --help           Show this help message");
      console.log(
        "  node git-log.js -h               Short version of --help\n"
      );
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

    if (!config.projects || config.projects.length === 0) {
      console.error("❌ Error: No projects configured");
      console.log("💡 Run 'node git-log.js --setup' to configure a project\n");
      process.exit(1);
    }

    if (!config.geminiApiKey) {
      console.error("❌ Error: Gemini API key is not configured");
      console.log("💡 Run 'node git-log.js --setup' to configure it\n");
      process.exit(1);
    }

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

    console.log("\n📊 Git Activity Report");
    console.log("═══════════════════════════════════════");
    console.log(`� Author: ${config.author}`);
    console.log(`� Date: ${formattedDate}`);
    console.log(`� Projects: ${config.projects.length}`);
    console.log("═══════════════════════════════════════\n");

    // Collect commits per project
    const projectCommits = []; // Array of {projectName, commits: []}
    let totalCommitCount = 0;

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

    // Process each project
    for (const project of config.projects) {
      const projectCommitDetails = [];
      const absolutePath = path.resolve(project.path);

      // let gitCommand = `git log --oneline --since="yesterday"`;
      let gitCommand = `git log --oneline --max-count=5`;
      if (config.author) {
        gitCommand += ` --author="${config.author}"`;
      }

      console.log(`\n📁 Project: ${project.name}`);
      console.log(`   Path: ${project.path}`);
      console.log("───────────────────────────────────────\n");

      try {
        const result = execSync(gitCommand, {
          cwd: absolutePath,
          encoding: "utf-8",
        });

        const commits = result
          .trim()
          .split("\n")
          .filter((line) => line);

        if (
          commits.length === 0 ||
          (commits.length === 1 && commits[0] === "")
        ) {
          console.log(
            "ℹ️  Today there is no commits found for this project.\n"
          );
        } else {
          console.log("   ✨ Commits:\n");
          totalCommitCount += commits.length;

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

            // Use project-specific Jira config if available
            const jiraConfig = project.jira
              ? {
                  ...config,
                  jiraDomain: project.jira.domain,
                  jiraEmail: project.jira.email,
                  jiraApiToken: project.jira.apiToken,
                }
              : config;

            const ticketInfo = await fetchTicketDescription(
              ticketId,
              jiraConfig
            );

            if (ticketInfo) {
              const displayLine = `      ${ticketId} | ${ticketInfo.title}`;
              console.log(displayLine);
              console.log(`      Description: ${ticketInfo.description}`);
              console.log(`      ${commit}\n`);
              projectCommitDetails.push(
                `${ticketId} | ${ticketInfo.title} - ${commit}`
              );
            } else {
              console.log(`      ${ticketId} | ${commit}\n`);
              projectCommitDetails.push(commit);
            }
          }

          // Store this project's commits
          if (projectCommitDetails.length > 0) {
            projectCommits.push({
              projectName: project.name,
              commits: projectCommitDetails,
            });
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Error fetching git log: ${error.message}\n`);
      }
    }

    if (totalCommitCount === 0) {
      console.log("\n═══════════════════════════════════════");
      console.log("ℹ️  No commits found across all projects.\n");
      process.exit(0);
    }

    console.log("\n═══════════════════════════════════════");

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
        projectCommits,
        config.geminiApiKey,
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

    // Show additional info if any project has Jira configured
    const jiraProjects = config.projects.filter((p) => p.jira);
    if (jiraProjects.length > 0) {
      console.log("📋 Jira Integration: Enabled");
      jiraProjects.forEach((p) => {
        console.log(`   ${p.name}: ${p.jira.domain}`);
      });
    }

    console.log(
      `\n💡 Tip: To add more projects, run: node git-log.js --add-project`
    );
    console.log(
      `💡 Tip: To list all projects, run: node git-log.js --list-projects\n`
    );
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
})();
