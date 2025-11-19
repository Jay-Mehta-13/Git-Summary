#!/usr/bin/env node

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const readline = require("readline");
const { fetchTicketDescription, fetchAllJiraTickets } = require("./ticket-api");
const {
  summarizeWithLLM,
  displaySummary,
  createDefaultPromptFile,
} = require("./llm-service");

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

/**
 * Switch between LLM providers (Gemini <-> ChatGPT)
 */
async function switchLLM() {
  const config = loadConfig();

  if (!config) {
    console.error("❌ No configuration found. Please run initial setup first.");
    console.log("💡 Run: node git-log.js --setup\n");
    process.exit(1);
  }

  const currentProvider = config.llmProvider || "gemini";
  console.log(`\n🔄 Current LLM Provider: ${currentProvider.toUpperCase()}\n`);

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
    console.log("\n✓ Switched to: Gemini");

    // Check if API key exists, if not ask for it
    if (!config.geminiApiKey || !config.geminiApiKey.trim()) {
      console.log("⚠️  Gemini API key not found in config");
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
      console.log("✓ Using existing Gemini API key");
    }
  } else {
    config.llmProvider = "chatgpt";
    console.log("\n✓ Switched to: ChatGPT");

    // Check if API key exists, if not ask for it
    if (!config.chatgptApiKey || !config.chatgptApiKey.trim()) {
      console.log("⚠️  ChatGPT API key not found in config");
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
    } else {
      console.log("✓ Using existing OpenAI API key");
    }
  }

  saveConfig(config);
  console.log(
    `\n✅ LLM provider switched to ${config.llmProvider.toUpperCase()}!\n`
  );
}

/**
 * Fetch and display all Jira tickets for all projects
 */
async function fetchAllTickets() {
  const config = loadConfig();

  if (!config) {
    console.error("❌ No configuration found. Please run initial setup first.");
    console.log("💡 Run: node git-log.js --setup\n");
    process.exit(1);
  }

  const projectsWithJira = config.projects.filter((p) => p.jira);

  if (projectsWithJira.length === 0) {
    console.log("\n⚠️  No projects with Jira configuration found.\n");
    console.log(
      "💡 Run: node git-log.js --add-project (to add a project with Jira)\n"
    );
    process.exit(0);
  }

  console.log("\n📋 Fetching Jira Tickets for All Projects");
  console.log("═══════════════════════════════════════\n");

  for (const project of projectsWithJira) {
    console.log(`📁 Project: ${project.name}`);
    console.log(
      `   Assignee: ${project.jira.assigneeEmail || project.jira.email}`
    );
    console.log("───────────────────────────────────────");

    try {
      const tickets = await fetchAllJiraTickets(
        project.jira,
        project.jira.assigneeEmail || project.jira.email
      );

      if (tickets.length === 0) {
        console.log(
          '   ℹ️  No "To Do" or "In Progress" tickets found for this assignee\n'
        );
      } else {
        console.log(
          `   ✨ Found ${tickets.length} active ticket(s) (sorted by priority):\n`
        );

        tickets.forEach((ticket, index) => {
          console.log(`   ${index + 1}. ${ticket.key}: ${ticket.summary}`);
          console.log(`      ─────────────────────────────────────`);
          console.log(`      Status: ${ticket.status}`);
          console.log(`      Priority: ${ticket.priority}`);
          console.log(`      Type: ${ticket.type}`);
          console.log(`      Reporter: ${ticket.reporter}`);
          console.log(
            `      Created: ${new Date(ticket.created).toLocaleDateString()}`
          );
          console.log(
            `      Updated: ${new Date(ticket.updated).toLocaleDateString()}`
          );

          if (ticket.labels && ticket.labels.length > 0) {
            console.log(`      Labels: ${ticket.labels.join(", ")}`);
          }

          if (ticket.components && ticket.components.length > 0) {
            console.log(`      Components: ${ticket.components.join(", ")}`);
          }

          console.log(`      Description:`);
          // Wrap description text at 70 characters
          const descWords = ticket.description.split(" ");
          let line = "         ";
          descWords.forEach((word) => {
            if (line.length + word.length + 1 > 80) {
              console.log(line);
              line = "         " + word;
            } else {
              line += (line.endsWith("         ") ? "" : " ") + word;
            }
          });
          if (line.trim()) console.log(line);
          console.log("");
        });
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  }

  console.log("═══════════════════════════════════════\n");
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

    if (args.includes("--fetch-tickets") || args.includes("-t")) {
      await fetchAllTickets();
      rl.close();
      process.exit(0);
    }

    if (args.includes("--switch-llm") || args.includes("-llm")) {
      await switchLLM();
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
      console.log(
        "  node git-log.js --fetch-tickets  Fetch all Jira tickets for all projects"
      );
      console.log(
        "  node git-log.js -t               Short version of --fetch-tickets"
      );
      console.log(
        '  node git-log.js --blocker "text" Skip blocker prompt, use provided text'
      );
      console.log(
        '  node git-log.js -b "text"        Short version of --blocker'
      );
      console.log(
        "  node git-log.js --blocker        Skip blocker prompt, no blocker (None)"
      );
      console.log(
        '  node git-log.js --date "YYYY-MM-DD" Fetch commits for specific date'
      );
      console.log('  node git-log.js -d "YYYY-MM-DD"  Short version of --date');
      console.log(
        "  node git-log.js --switch-llm     Switch between Gemini and ChatGPT"
      );
      console.log(
        "  node git-log.js -llm             Short version of --switch-llm"
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

    // Validate LLM API key based on provider
    const llmProvider = config.llmProvider || "gemini";

    if (llmProvider === "gemini") {
      if (!config.geminiApiKey || !config.geminiApiKey.trim()) {
        console.error("❌ Error: Gemini API key is not configured");
        console.log(
          "💡 Run 'node git-log.js --setup' or 'node git-log.js --switch-llm' to configure it\n"
        );
        process.exit(1);
      }
    } else if (llmProvider === "chatgpt") {
      if (!config.chatgptApiKey || !config.chatgptApiKey.trim()) {
        console.error("❌ Error: ChatGPT API key is not configured");
        console.log(
          "💡 Run 'node git-log.js --setup' or 'node git-log.js --switch-llm' to configure it\n"
        );
        process.exit(1);
      }
    }

    // Check for --date flag
    let targetDate = null;
    let sinceDate = null;
    let untilDate = null;

    const dateFlagIndex = args.findIndex(
      (arg) => arg === "--date" || arg === "-d"
    );

    if (dateFlagIndex !== -1 && dateFlagIndex + 1 < args.length) {
      const dateString = args[dateFlagIndex + 1];

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateString)) {
        console.error("❌ Error: Invalid date format. Use YYYY-MM-DD");
        console.log('💡 Example: node git-log.js --date "2025-11-14"\n');
        process.exit(1);
      }

      targetDate = new Date(dateString);

      // Check if date is valid
      if (isNaN(targetDate.getTime())) {
        console.error("❌ Error: Invalid date provided");
        console.log('💡 Example: node git-log.js --date "2025-11-14"\n');
        process.exit(1);
      }

      // Set since and until dates for the specific day
      sinceDate = dateString;

      // Calculate next day for until
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      untilDate = nextDay.toISOString().split("T")[0];

      console.log(`📅 Fetching commits for date: ${dateString}\n`);
    }

    const today = targetDate || new Date();

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

      // Use custom date range if --date flag was provided, otherwise use midnight
      let gitCommand;
      if (sinceDate && untilDate) {
        gitCommand = `git log --oneline --since="${sinceDate} 00:00" --until="${untilDate} 23:59"`;
      } else {
        // gitCommand = `git log --oneline --since="midnight"`;
        gitCommand = `git log --oneline --max-count=5`;
      }
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

          // Store commits with full details for AI processing
          const commitDetailsWithTickets = [];

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
                  jiraEmail: project.jira.apiEmail || project.jira.email,
                  jiraApiToken: project.jira.apiToken,
                  taskManagementSystem: "jira",
                }
              : config;

            const ticketInfo = await fetchTicketDescription(
              ticketId,
              jiraConfig
            );

            if (ticketInfo) {
              const displayLine = `      ${ticketId} | ${ticketInfo.title}`;
              console.log(displayLine);
              console.log(
                `      Status: ${ticketInfo.status} | Priority: ${ticketInfo.priority}`
              );
              console.log(`      Description: ${ticketInfo.description}`);
              console.log(`      Commit: ${commit}\n`);

              // Store detailed commit info
              commitDetailsWithTickets.push({
                commit: commit,
                ticketId: ticketId,
                ticketTitle: ticketInfo.title,
                ticketDescription: ticketInfo.description,
                ticketStatus: ticketInfo.status,
                ticketPriority: ticketInfo.priority,
                ticketType: ticketInfo.type,
              });

              projectCommitDetails.push(
                `${ticketId} [${ticketInfo.status}] [Priority: ${ticketInfo.priority}] | ${ticketInfo.title} - ${commit}`
              );
            } else {
              console.log(`      ${ticketId} | ${commit}\n`);
              commitDetailsWithTickets.push({
                commit: commit,
                ticketId: ticketId,
              });
              projectCommitDetails.push(commit);
            }
          }

          // Fetch all active Jira tickets (To Do and In Progress) for this project
          let activeTickets = [];
          if (project.jira) {
            try {
              console.log(
                "   🔍 Fetching active Jira tickets (To Do & In Progress)...\n"
              );
              activeTickets = await fetchAllJiraTickets(
                project.jira,
                project.jira.assigneeEmail || project.jira.email
              );

              if (activeTickets.length > 0) {
                console.log(
                  `   ✨ Found ${activeTickets.length} active ticket(s) (sorted by priority):\n`
                );
                activeTickets.forEach((ticket) => {
                  console.log(
                    `      ${ticket.key} [${ticket.status}] [Priority: ${ticket.priority}]`
                  );
                  console.log(`      ${ticket.summary}\n`);
                });
              }
            } catch (error) {
              console.log(
                `   ⚠️  Could not fetch active tickets: ${error.message}\n`
              );
            }
          }

          // Store this project's data with commits and active tickets
          if (projectCommitDetails.length > 0 || activeTickets.length > 0) {
            projectCommits.push({
              projectName: project.name,
              commits: projectCommitDetails,
              commitDetails: commitDetailsWithTickets,
              activeTickets: activeTickets,
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

    let blockerInfo = "None";

    // Check if --blocker flag is provided
    const blockerFlagIndex = args.findIndex(
      (arg) => arg === "--blocker" || arg === "-b"
    );

    if (blockerFlagIndex !== -1) {
      // Check if there's a description after the flag
      if (
        blockerFlagIndex + 1 < args.length &&
        !args[blockerFlagIndex + 1].startsWith("-")
      ) {
        // Use the provided description as blocker
        blockerInfo = args[blockerFlagIndex + 1];
        console.log(`\n🚧 Blocker provided: ${blockerInfo}`);
      } else {
        // No description provided, default to "None"
        blockerInfo = "None";
        console.log("\n🚧 No blocker description provided, using: None");
      }
    } else {
      // Ask about blockers interactively
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
    }

    // Start AI summary generation
    console.log("");

    // Process AI summary - execution continues while waiting
    try {
      const summary = await summarizeWithLLM(
        projectCommits,
        config,
        blockerInfo
      );
      if (summary) {
        const provider = config.llmProvider || "gemini";
        displaySummary(summary, provider);
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
