# Git Summary - Daily Standup Report Generator

A Node.js script that generates professional daily standup reports from your git commits using AI-powered summarization with Google Gemini or OpenAI ChatGPT.

## Features

- 🔍 Fetches git commits since yesterday
- 👤 Filters by author name
- 📁 **Multi-project support** - Track commits across multiple repositories
- 🎫 Extracts ticket IDs from commit messages (Jira support)
- 📋 Fetches ticket title and description from Jira (optional per project)
- 🤖 **Dual AI support** - Choose between Google Gemini or OpenAI ChatGPT
- 🔄 **Switch LLMs anytime** - Easily switch between AI providers
- 🚧 Interactive blocker tracking
- ✏️ Customizable AI prompts (shared across both LLMs)
- 🔧 Interactive setup wizard
- 📊 Formatted daily standup reports
- 📅 **Date-specific reports** - Fetch commits for any specific date
- 🎯 No external packages required (uses native Node.js modules)

## Quick Start

1. Run the script for first-time setup:

   ```bash
   node git-log.js
   ```

2. Follow the interactive setup wizard to configure:

   - Git author name (used across all projects)
   - **Choose your AI provider**: Gemini (Google) or ChatGPT (OpenAI)
   - API key for your chosen provider:
     - Gemini: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
     - ChatGPT: Get from [OpenAI Platform](https://platform.openai.com/api-keys)
   - First project details:
     - Project name (e.g., "SIMGROW")
     - Project path (absolute path to your git repository)
     - Jira integration (optional per project)
     - Zoho integration (optional per project)

3. The script will automatically create:

   - `config.json` - Your configuration
   - `custom-prompt.txt` - AI prompt template (fully customizable)

4. Add more projects (optional):

   ```bash
   node git-log.js --add-project
   ```

5. Run the script daily to generate standup reports:
   ```bash
   node git-log.js
   ```

## Commands

| Command                                       | Description                                      |
| --------------------------------------------- | ------------------------------------------------ |
| `node git-log.js`                             | Run with existing config                         |
| `node git-log.js --setup` or `-s`             | Reset config and run setup wizard                |
| `node git-log.js --add-project` or `-a`       | Add a new project to existing config             |
| `node git-log.js --list-projects` or `-l`     | List all configured projects                     |
| `node git-log.js --fetch-tickets` or `-t`     | Fetch all active Jira tickets for all projects   |
| `node git-log.js --blocker "text"` or `-b`    | Skip blocker prompt, use provided text or "None" |
| `node git-log.js --date "YYYY-MM-DD"` or `-d` | Fetch commits for a specific date                |
| `node git-log.js --switch-llm` or `-llm`      | Switch between Gemini and ChatGPT                |
| `node git-log.js --help` or `-h`              | Show help message                                |
| `node test-api.js`                            | Test Gemini API key and list available models    |

## Daily Usage

### Interactive Mode (Default)

1. **Start of your workday**: Run the script to generate your standup report

   ```bash
   node git-log.js
   ```

2. **Review your commits**: The tool will display all commits since yesterday

3. **Answer blocker question**:

   - Enter `yes` if you have blockers and provide details
   - Enter `no` if you have no blockers

4. **Get AI summary**: Wait a few seconds for the AI-generated standup report

5. **Copy the summary**: Use the formatted output for your daily standup meeting or Slack update

### Quick Mode with Blocker Flag

Skip the interactive blocker prompt by using the `--blocker` flag:

**No blockers:**

```bash
node git-log.js --blocker
# or
node git-log.js -b
```

**With blocker description:**

```bash
node git-log.js --blocker "Waiting for API access from client"
# or
node git-log.js -b "Waiting for API access from client"
```

This is useful for:

- Automation scripts or CI/CD pipelines
- Quick standup generation when you know you have no blockers
- Pre-filling blocker information without interactive prompts

### Date-Specific Reports

Fetch commits for a specific date instead of "since yesterday":

```bash
node git-log.js --date "2025-11-14"
# or
node git-log.js -d "2025-11-14"
```

**Format:** Use `YYYY-MM-DD` format

**Use Cases:**

- Generate retrospective reports for past dates
- Catch up on missed standup days
- Review work done on specific dates for timesheets
- Create reports for days you were on leave

**Example:**

```bash
# Generate report for November 14, 2025
node git-log.js --date "2025-11-14"

# Combine with blocker flag
node git-log.js --date "2025-11-14" --blocker
```

The tool will fetch commits from the specified date (00:00:00) to the next day (00:00:00), giving you a complete daily report.

## Configuration

Configuration is automatically created during setup in `config.json`.

### Global Configuration

| Field                  | Description                                                                                   | Required         |
| ---------------------- | --------------------------------------------------------------------------------------------- | ---------------- |
| `author`               | Your git author name for filtering commits (applies to all projects)                          | Yes              |
| `llmProvider`          | AI provider: `"gemini"` or `"chatgpt"` (default: `"gemini"`)                                  | Yes              |
| `geminiApiKey`         | Google Gemini API key (get from [Google AI Studio](https://makersuite.google.com/app/apikey)) | If using Gemini  |
| `chatgptApiKey`        | OpenAI API key (get from [OpenAI Platform](https://platform.openai.com/api-keys))             | If using ChatGPT |
| `customTicketPatterns` | Array of regex patterns for custom ticket formats                                             | No               |

### Project Configuration

Each project in the `projects` array has the following structure:

| Field  | Description                           | Required |
| ------ | ------------------------------------- | -------- |
| `name` | Project name (displayed in reports)   | Yes      |
| `path` | Absolute path to git repository       | Yes      |
| `jira` | Jira configuration object (see below) | No       |
| `zoho` | Zoho configuration object (see below) | No       |

### Jira Configuration (Optional per Project)

Each project can have its own Jira configuration:

| Field           | Description                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| `domain`        | Your Jira domain (e.g., `company.atlassian.net`)                                                        |
| `apiEmail`      | Email of the user who created the API token (used for authentication)                                   |
| `apiToken`      | Generate from [Atlassian Account Security](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `assigneeEmail` | Email of the user whose tickets you want to fetch (used in JQL queries)                                 |

### Zoho Configuration (Optional per Project)

Each project can have its own Zoho configuration:

| Field           | Description                                                                     |
| --------------- | ------------------------------------------------------------------------------- |
| `generatedCode` | OAuth grant code from Zoho API Console (expires in 10 minutes, single use only) |
| `clientId`      | Your Zoho Self Client ID                                                        |
| `clientSecret`  | Your Zoho Self Client Secret                                                    |

**⚠️ Important Notes:**

- The generated code expires in 10 minutes after generation
- The generated code can only be used once to obtain a refresh token
- See the detailed guide below on how to generate these credentials

### Example Config Structure

```json
{
  "author": "John Doe",
  "llmProvider": "gemini",
  "geminiApiKey": "your-gemini-api-key-here",
  "chatgptApiKey": "your-chatgpt-api-key-here",
  "projects": [
    {
      "name": "Project A",
      "path": "/home/user/projects/project-a",
      "jira": {
        "domain": "company.atlassian.net",
        "apiEmail": "admin@company.com",
        "apiToken": "your-jira-token",
        "assigneeEmail": "john@company.com"
      }
    },
    {
      "name": "Project B",
      "path": "/home/user/projects/project-b",
      "zoho": {
        "generatedCode": "1000.xxxxxxxxxx.xxxxxxxxxx",
        "clientId": "1000.XXXXXXXXXXXXX",
        "clientSecret": "xxxxxxxxxxxxxxxxxxxxx"
      }
    }
  ],
  "customTicketPatterns": [],
  "setupDate": "2025-01-01T00:00:00.000Z"
}
```

**Note:** You only need to configure the API key for the LLM provider you're using. However, having both keys configured allows you to easily switch between providers using the `--switch-llm` flag.

## Switching Between AI Providers

You can easily switch between Google Gemini and OpenAI ChatGPT at any time:

```bash
node git-log.js --switch-llm
# or
node git-log.js -llm
```

The tool will:

1. Show your current LLM provider
2. Prompt you to choose between Gemini or ChatGPT
3. Check if the API key exists for your chosen provider
4. Ask for the API key if not already configured
5. Update your configuration

### Why Switch?

- **Gemini (Google)**: Fast, cost-effective, good for daily standup reports
- **ChatGPT (OpenAI)**: Higher quality summaries, better context understanding
- **Try Both**: Compare output quality and choose what works best for your team

### Custom Prompts Work with Both

The `custom-prompt.txt` file is shared between both AI providers, so your customized prompt template will work regardless of which LLM you choose.

## Managing Multiple Projects

### Adding Projects

You can manage multiple repositories and get a unified standup report:

1. **During initial setup**: Configure your first project
2. **Add more projects**:
   ```bash
   node git-log.js --add-project
   ```
3. **Follow the prompts** for each new project (name, path, Jira config)

### Listing Projects

View all configured projects:

```bash
node git-log.js --list-projects
```

### Fetching Jira Tickets

View all active Jira tickets across all projects:

```bash
node git-log.js --fetch-tickets
```

or use the short version:

```bash
node git-log.js -t
```

This command will:

- Fetch all **"In Progress"** tickets assigned to the configured user
- Show comprehensive details for each ticket including:
  - Ticket key, summary, status, priority, and type
  - Reporter name and creation date
  - Last updated date
  - Labels and components (if any)
  - Full description with word wrapping for readability
- Display results organized by project

**Example output:**

```
📋 Fetching Jira Tickets for All Projects
═══════════════════════════════════════

📁 Project: SIMGROW
   Assignee: john.doe@company.com
───────────────────────────────────────
   ✨ Found 2 "In Progress" ticket(s):

   1. PROJ-123: Implement user authentication
      ─────────────────────────────────────
      Status: In Progress
      Priority: High
      Type: Story
      Reporter: Jane Smith
      Created: 11/10/2025
      Updated: 11/14/2025
      Labels: backend, security
      Components: Authentication Module
      Description:
         Need to implement OAuth 2.0 authentication flow for the
         application. Should support multiple providers including
         Google and GitHub.

   2. PROJ-124: Fix login bug
      ─────────────────────────────────────
      Status: In Progress
      Priority: Medium
      Type: Bug
      Reporter: John Doe
      Created: 11/12/2025
      Updated: 11/13/2025
      Description:
         Users unable to login with special characters in password.
```

### Multi-Project Workflow

When you have multiple projects configured:

1. The tool runs `git log` on **each project** repository
2. Commits are **labeled with project names** (e.g., `[Project A] JIRA-123: Fix bug`)
3. All commits are **aggregated** and shown grouped by project
4. A **unified AI summary** is generated covering all projects
5. If projects have different Jira configs, **each uses its own** Jira credentials

### Example Multi-Project Output

```
📊 Git Activity Report
═══════════════════════════════════════
👤 Author: John Doe
📅 Date: Fri Jan 10 09:30:00 2025 +0000
📁 Projects: 3
═══════════════════════════════════════

📁 Project: Frontend App
   Path: /home/user/projects/frontend
───────────────────────────────────────

   ✨ Commits:

      FEAT-123 | Implement user authentication
      Description: Add login and signup forms
      abc1234 Implement login page

📁 Project: Backend API
   Path: /home/user/projects/backend
───────────────────────────────────────

   ✨ Commits:

      API-456 | Create user endpoints
      Description: REST API for user management
      def5678 Add user CRUD operations

═══════════════════════════════════════

🚧 Do you have any blockers? (yes/no): no

🤖 Generating AI summary...
```

## Custom AI Prompts

After first setup, a `custom-prompt.txt` file is created. Edit this file to customize how Gemini summarizes your commits.

**Template Variables:**

- `{COMMITS}` - Will be replaced with your actual git commits organized by project
- `{PROJECT_NAMES}` - Will be replaced with comma-separated list of project names
- `{BLOCKERS}` - Will be replaced with blocker information
- `{BLOCKER_SECTION}` - Pre-processed blocker section

**Default Format:**

The tool generates standup reports with **separate sections for each project**:

```
Blocker:
   None (or bullet points if blockers exist)

Today's Update:

   Project Name 1:
   • Ticket-ID: Description of work done for this project

   Project Name 2:
   • Ticket-ID: Description of work done for this project

Tomorrow's Plan:
   • Suggested next steps based on today's work
```

**Customization:**

You can fully customize the prompt in `custom-prompt.txt` to change:

- The format and structure
- The level of detail
- The tone and style
- What information to emphasize

## How It Works

1. **Setup Configuration**: On first run, interactive wizard collects your settings
2. **Fetch Git Commits**: Retrieves commits since yesterday for your author from **each configured project**
3. **Display Commits**: Shows commits immediately in the terminal, organized by project
4. **Extract Ticket IDs**: Automatically detects ticket IDs from commit messages
5. **Fetch Jira Details**: (Optional) Gets ticket information from Jira using project-specific credentials
6. **Ask About Blockers**: Interactive prompt to capture any blockers (asked once for all projects)
7. **AI Processing**: Sends all project commits to Gemini API with your custom prompt
8. **Display Report**: Shows formatted daily standup report with **separate sections for each project**

The process is non-blocking - you see your commits immediately while the AI summary is being generated.

### Multi-Project AI Summary

When you have multiple projects, the AI generates:

- **Separate "Today's Update" sections** for each project
- **Unified "Tomorrow's Plan"** considering work across all projects
- **Single "Blocker" section** applicable to all work

## Supported Ticket Formats

The script automatically recognizes:

- **Jira**: `PROJ-123`, `M3-3633`, `AY1Q-T296` (uppercase letters + optional digits + hyphen + digits/letters)

### Custom Patterns

To add custom ticket ID patterns, edit `config.json`:

```json
{
  "customTicketPatterns": ["#\\d+", "CUSTOM-[A-Z0-9]+"]
}
```

Note: Escape backslashes in JSON strings (use `\\` instead of `\`).

## Example Output

### Running the Tool

```bash
$ node git-log.js
✅ Using saved configuration

📊 Git Activity Report
═══════════════════════════════════════
📁 Project: /home/user/simform-twenty-crm/
👤 Author: archanVadgama
📅 Date: Wed Nov 12 12:30:00 2025 +0000
═══════════════════════════════════════

✨ Commits:

No ticket ID | 4dd5bdef14 [SIMGROW]: feat/AY1Q-T296 fix view creation logic and user relation handling

🚧 Do you have any blockers? (yes/no): no

🤖 Generating AI summary...

═══════════════════════════════════════
🤖 AI Summary
═══════════════════════════════════════
Blocker:
   • None

Today's Update:
   SIMGROW:
   • AY1Q-T296: Fixed view creation logic and user relation handling

Tomorrow's Plan:
   • Test the updated view creation logic and user relation handling
   • Refine view creation based on testing feedback
═══════════════════════════════════════

💡 Tip: To reset configuration, run: node git-log.js --setup
```

### With Blockers

```bash
🚧 Do you have any blockers? (yes/no): yes
Please describe your blocker(s): Cannot merge to main branch because QA testing is pending

═══════════════════════════════════════
🤖 AI Summary
═══════════════════════════════════════
Blocker:
   • Cannot merge to main branch due to pending QA testing

Today's Update:
   SIMGROW:
   • AY1Q-T296: Fixed view creation logic and user relation handling

Tomorrow's Plan:
   • Address any feedback from QA regarding the recent fix
   • Prepare for merging once QA testing is complete
═══════════════════════════════════════
```

## Project Structure

```
├── git-log.js              # Main script - entry point
├── llm-service.js          # Unified LLM interface (routes to Gemini or ChatGPT)
├── gemini-service.js       # Gemini AI integration (uses native https module)
├── chatgpt-service.js      # ChatGPT AI integration (uses native https module)
├── ticket-api.js           # Jira API integration
├── test-api.js             # API key testing utility
├── config.json             # Your configuration (auto-generated, gitignored)
├── custom-prompt.txt       # AI prompt template (auto-generated, customizable)
├── config.example.json     # Example configuration template
└── README.md               # This file
```

### Key Files

- **git-log.js**: Main script that orchestrates the entire flow
- **llm-service.js**: Unified interface that routes to the correct AI provider
- **gemini-service.js**: Handles AI summarization using Google Gemini 2.5 Pro
- **chatgpt-service.js**: Handles AI summarization using OpenAI GPT-4
- **ticket-api.js**: Fetches ticket details from Jira (optional)
- **test-api.js**: Utility to test your Gemini API key and list available models
- **config.json**: Stores your configuration (created during setup)
- **custom-prompt.txt**: Customizable prompt template for AI summarization (shared by both LLMs)

## Troubleshooting

### No commits shown

- Check that `projectPath` points to a valid git repository
- Verify you have commits since yesterday
- Check `author` filter matches your git author name exactly
- Try running `git log --since="yesterday" --author="YourName"` manually in your project directory

### AI API errors

#### Gemini "Model not found" error

- Run `node test-api.js` to verify your API key and see available models
- The tool uses `gemini-2.5-pro` model by default
- Ensure you have a valid API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

#### ChatGPT Authentication error

- Verify your OpenAI API key is correct
- Get or regenerate your key from [OpenAI Platform](https://platform.openai.com/api-keys)
- The tool uses `gpt-4o` model

#### Quota exceeded

- **Gemini**: Check your API quota at [Google AI Studio](https://makersuite.google.com/)
- **ChatGPT**: Check your usage at [OpenAI Platform](https://platform.openai.com/usage)
- Free tier has rate limits; wait a few minutes and retry
- Consider upgrading your API plan if needed
- **Alternative**: Switch to the other LLM provider using `node git-log.js --switch-llm`

### Jira API calls failing

- Verify `jiraDomain`, `jiraEmail`, and `jiraApiToken` are correct
- Test Jira credentials manually: `curl -u email:token https://your-domain.atlassian.net/rest/api/3/myself`
- Check the console logs for specific error messages (marked with ⚠️)
- Regenerate Jira API token from [Atlassian Account Security](https://id.atlassian.com/manage-profile/security/api-tokens)

### Ticket IDs not detected

- Check your commit messages contain ticket IDs in supported formats
- Supported patterns: `PROJ-123`, `M3-3633`, `AY1Q-T296`
- Add custom patterns to `customTicketPatterns` in `config.json`

### Test Your API Key

Use the included test utility:

```bash
node test-api.js
```

This will verify your API key and show all available Gemini models.

### Reset Configuration

If you need to start over:

```bash
node git-log.js --setup
```

## ✅ Guide: How to Generate Zoho OAuth Code (Self Client)

This guide explains how to generate the grant code, which is required to create a refresh token and access Zoho APIs programmatically.

### 🔹 Step 1 — Login to Zoho API Console

Go to:

```
https://api-console.zoho.com/
```

Login using the **SAME Zoho account** that has access to your Zoho Projects data.

### 🔹 Step 2 — Go to "Client Secrets"

In the left menu:

```
API Console → Client Secret
```

**If you already created a client:**

- Open it

**If not:**

1. Click **Add Client**
2. Select **Self Client**
3. Enter:
   - **Client Name**: (anything you want, e.g., "Git Summary Tool")
   - **Homepage URL**: (optional, leave blank if not needed)
   - **Redirect URLs**: (leave blank)
4. Click **Create**

You will now get:

- **Client ID**
- **Client Secret**

### 🔹 Step 3 — Open the "Self Client" Tab

Inside your client:

1. Click **Self Client** tab
2. You will see a large textbox labelled **Scope**

### 🔹 Step 4 — Paste Required Scopes

Paste your selected Zoho Projects scopes (space-separated):

```
ZohoProjects.portals.READ ZohoProjects.projects.ALL ZohoProjects.milestones.ALL ZohoProjects.tasklists.ALL ZohoProjects.tasks.ALL ZohoProjects.timesheets.ALL ZohoProjects.bugs.ALL ZohoProjects.documents.ALL ZohoProjects.events.ALL ZohoProjects.forums.ALL ZohoProjects.users.ALL ZohoProjects.calendar.ALL ZohoProjects.search.READ ZohoProjects.templates.ALL ZohoProjects.customfields.ALL ZohoProjects.tags.ALL
```

**Important:**

- ✔ No commas
- ✔ No plus signs
- ✔ No line breaks
- ✔ SPACE between scopes

### 🔹 Step 5 — Select "Time Duration"

Zoho allows:

- **Minimum**: 3 minutes
- **Maximum**: 10 minutes

**Always choose 10 minutes** (gives you more time).

### 🔹 Step 6 — Click "Generate Code"

Zoho will now generate a grant code.

**Example:**

```
1000.xxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxx
```

**⚠️ Important:**

- This code is valid **ONLY** for the selected time (10 minutes).
- It **cannot be reused**.

### 🔹 Step 7 — Copy Credentials

Now copy the following three values:

1. **Generated Code** (from the Grant Token field)

   - Example: `1000.xxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxx`
   - Valid for 10 minutes only

2. **Client ID** (from the client details at the top)

   - Example: `1000.XXXXXXXXXXXXX`

3. **Client Secret** (from the client details at the top)
   - Example: `xxxxxxxxxxxxxxxxxxxxx`

### 🔹 Step 8 — Paste in Setup

When running `node git-log.js --setup` or `node git-log.js --add-project`, paste these values when prompted:

```bash
Do you use Zoho for this project? (yes/no): yes

📊 Zoho Configuration:
ℹ️  You need to generate OAuth credentials from Zoho API Console
📖 See README.md for detailed instructions on generating these credentials

Enter Zoho generated code (grant code from Self Client): 1000.xxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxx
Enter Zoho client ID: 1000.XXXXXXXXXXXXX
Enter Zoho client secret: xxxxxxxxxxxxxxxxxxxxx

✅ Zoho configuration saved!
⚠️  Note: The generated code expires in 10 minutes and can only be used once.
```

### 📝 Additional Notes

- **Grant Code Expiry**: The generated code must be used within 10 minutes
- **Single Use**: After using the code to get a refresh token, you cannot reuse it
- **Refresh Token**: Your application will use the generated code to obtain a refresh token, which can be used indefinitely
- **Scopes**: Make sure to include all scopes you need; you cannot add scopes later without regenerating

### 🔗 Useful Links

- [Zoho API Console](https://api-console.zoho.com/)
- [Zoho OAuth Documentation](https://www.zoho.com/projects/help/rest-api/oauth-steps.html)
- [Zoho Projects API Scopes](https://www.zoho.com/projects/help/rest-api/oauth-scopes.html)

## Technical Details

- **Node.js Version**: Requires Node.js v18+ (tested on v22)
- **Dependencies**: None! Uses only native Node.js modules
  - `https` - For API requests
  - `child_process` - For git commands
  - `fs` - For file operations
  - `readline` - For interactive prompts
- **API Used**: Google Gemini 2.5 Flash via REST API
- **Git Command**: `git log --oneline --since="yesterday" --author="<author>"`

## Benefits

✅ **No Manual Report Writing**: Automatically generates standup reports from your commits  
✅ **Time Saver**: Reduces daily standup prep time from 5-10 minutes to under a minute  
✅ **Consistent Format**: Always produces well-formatted, professional reports  
✅ **Blocker Tracking**: Interactive prompts ensure you don't forget to mention blockers  
✅ **Customizable**: Fully customizable AI prompts to match your team's standup format  
✅ **Zero Dependencies**: No npm packages to install or maintain  
✅ **Privacy Friendly**: Runs locally, only sends commit data to Gemini for summarization  
✅ **Easy Setup**: One-time interactive configuration, then just run daily

## Contributing

Contributions are welcome! Feel free to:

- Report bugs
- Suggest new features
- Submit pull requests
- Improve documentation

## License

ISC

## Author

Created for daily standup report automation using AI-powered summarization.

---

**Made with ❤️ for developers who want to spend less time writing standup reports and more time coding!**
