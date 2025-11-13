# Git Summary - Daily Standup Report Generator

A Node.js script that generates professional daily standup reports from your git commits using AI-powered summarization with Google Gemini.

## Features

- 🔍 Fetches git commits since yesterday
- 👤 Filters by author name
- 📁 **Multi-project support** - Track commits across multiple repositories
- 🎫 Extracts ticket IDs from commit messages (Jira support)
- 📋 Fetches ticket title and description from Jira (optional per project)
- 🤖 AI-powered commit summaries using Google Gemini 2.5 Flash
- 🚧 Interactive blocker tracking
- ✏️ Customizable AI prompts
- 🔧 Interactive setup wizard
- 📊 Formatted daily standup reports
- 🎯 No external packages required (uses native Node.js modules)

## Quick Start

1. Run the script for first-time setup:

   ```bash
   node git-log.js
   ```

2. Follow the interactive setup wizard to configure:

   - Git author name (used across all projects)
   - Gemini API key (required) - Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - First project details:
     - Project name (e.g., "SIMGROW")
     - Project path (absolute path to your git repository)
     - Jira integration (optional per project)

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

| Command                                   | Description                                   |
| ----------------------------------------- | --------------------------------------------- |
| `node git-log.js`                         | Run with existing config                      |
| `node git-log.js --setup` or `-s`         | Reset config and run setup wizard             |
| `node git-log.js --add-project` or `-a`   | Add a new project to existing config          |
| `node git-log.js --list-projects` or `-l` | List all configured projects                  |
| `node git-log.js --help` or `-h`          | Show help message                             |
| `node test-api.js`                        | Test Gemini API key and list available models |

## Daily Usage

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

## Configuration

Configuration is automatically created during setup in `config.json`.

### Global Configuration

| Field                  | Description                                                                                   | Required |
| ---------------------- | --------------------------------------------------------------------------------------------- | -------- |
| `author`               | Your git author name for filtering commits (applies to all projects)                          | Yes      |
| `geminiApiKey`         | Google Gemini API key (get from [Google AI Studio](https://makersuite.google.com/app/apikey)) | Yes      |
| `customTicketPatterns` | Array of regex patterns for custom ticket formats                                             | No       |

### Project Configuration

Each project in the `projects` array has the following structure:

| Field  | Description                           | Required |
| ------ | ------------------------------------- | -------- |
| `name` | Project name (displayed in reports)   | Yes      |
| `path` | Absolute path to git repository       | Yes      |
| `jira` | Jira configuration object (see below) | No       |

### Jira Configuration (Optional per Project)

Each project can have its own Jira configuration:

| Field      | Description                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| `domain`   | Your Jira domain (e.g., `company.atlassian.net`)                                                        |
| `email`    | Email for your Jira account                                                                             |
| `apiToken` | Generate from [Atlassian Account Security](https://id.atlassian.com/manage-profile/security/api-tokens) |

### Example Config Structure

```json
{
  "author": "John Doe",
  "geminiApiKey": "your-api-key-here",
  "projects": [
    {
      "name": "Project A",
      "path": "/home/user/projects/project-a",
      "jira": {
        "domain": "company.atlassian.net",
        "email": "john@company.com",
        "apiToken": "your-jira-token"
      }
    },
    {
      "name": "Project B",
      "path": "/home/user/projects/project-b"
    }
  ],
  "customTicketPatterns": [],
  "setupDate": "2025-01-01T00:00:00.000Z"
}
```

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
├── gemini-service.js       # Gemini AI integration (uses native https module)
├── ticket-api.js           # Jira API integration
├── test-api.js             # API key testing utility
├── config.json             # Your configuration (auto-generated, gitignored)
├── custom-prompt.txt       # AI prompt template (auto-generated, customizable)
├── config.example.json     # Example configuration template
└── README.md               # This file
```

### Key Files

- **git-log.js**: Main script that orchestrates the entire flow
- **gemini-service.js**: Handles AI summarization using Google Gemini 2.5 Flash
- **ticket-api.js**: Fetches ticket details from Jira (optional)
- **test-api.js**: Utility to test your Gemini API key and list available models
- **config.json**: Stores your configuration (created during setup)
- **custom-prompt.txt**: Customizable prompt template for AI summarization

## Troubleshooting

### No commits shown

- Check that `projectPath` points to a valid git repository
- Verify you have commits since yesterday
- Check `author` filter matches your git author name exactly
- Try running `git log --since="yesterday" --author="YourName"` manually in your project directory

### Gemini API errors

#### "Model not found" error

- Run `node test-api.js` to verify your API key and see available models
- The tool uses `gemini-2.5-flash` model by default
- Ensure you have a valid API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

#### Quota exceeded

- Check your API quota at [Google AI Studio](https://makersuite.google.com/)
- Free tier has rate limits; wait a few minutes and retry
- Consider upgrading your API plan if needed

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
