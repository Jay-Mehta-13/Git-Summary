# DSU Git Log Script

A Node.js script that fetches today's git commits and automatically retrieves ticket details from Jira or Zoho.

## Features

- Fetches git commits from midnight today
- Filters by author name
- Extracts ticket IDs from commit messages
- Fetches ticket title and description from Jira or Zoho
- Supports custom ticket ID patterns

## Setup

1. Copy the example config file:

    ```bash
    cp config.example.json config.json
    ```

2. Edit `config.json` with your settings (see Configuration section below)

3. Run the script:
    ```bash
    node git-log.js
    ```

## Configuration

All configuration is done in `config.json`. Here's what each field does:

### Required Fields

| Field                  | Description                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `projectPath`          | Absolute path to your git project directory. The script will run `git log` in this directory. |
| `taskManagementSystem` | Task management system to use. Supported values: `"jira"` or `"zoho"`                         |

### Optional Fields

| Field                  | Description                                                                                                                 | Default |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------- |
| `author`               | Filter git logs by author name. Leave empty (`""`) to show all authors' commits.                                            | None    |
| `customTicketPatterns` | Array of regex patterns (as strings) for custom ticket ID formats. Built-in patterns already support Jira and Zoho formats. | `[]`    |

### Jira Configuration

Required only if `taskManagementSystem` is set to `"jira"`:

| Field          | Description                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `jiraDomain`   | Your Jira domain (e.g., `"company.atlassian.net"`)                                                                      |
| `jiraEmail`    | Email associated with your Jira account                                                                                 |
| `jiraApiToken` | Jira API token. Generate from [Atlassian Account Security](https://id.atlassian.com/manage-profile/security/api-tokens) |

### Zoho Configuration

Required only if `taskManagementSystem` is set to `"zoho"`:

| Field             | Description               | Default           |
| ----------------- | ------------------------- | ----------------- |
| `zohoDomain`      | Your Zoho Desk domain     | `"desk.zoho.com"` |
| `zohoOrgId`       | Your Zoho organization ID | None              |
| `zohoAccessToken` | Zoho OAuth access token   | None              |

## Supported Ticket Formats

The script automatically recognizes:

- **Jira**: `PROJ-123`, `M3-3633` (uppercase letters + optional digits + hyphen + digits)
- **Zoho**: `AY1Q-T296` (alphanumeric + hyphen + letter + digits)

### Custom Patterns

To add custom ticket ID patterns, use the `customTicketPatterns` field:

```json
{
  "customTicketPatterns": ["#\\d+", "CUSTOM-[A-Z0-9]+"]
}
```

Note: Remember to escape backslashes in JSON strings (use `\\` instead of `\`).

## Example Output

```
M3-3633 | Store all calls and SMS records
  Description: This feature adds functionality to store call and SMS records...
  9ad07bb3b Merged in feat/M3-3633/store-all-calls-and-sms-records (pull request #3064)

No ticket ID | a1b2c3d4e Updated documentation

```

## Files

- `git-log.js` - Main script
- `ticket-api.js` - API integration for Jira and Zoho
- `config.json` - Your configuration (not tracked in git)
- `config.example.json` - Example configuration template

## Troubleshooting

### No commits shown

- Check that `projectPath` points to a valid git repository
- Verify you have commits from today
- Check `author` filter is correct

### API calls failing

- For Jira: Verify `jiraDomain`, `jiraEmail`, and `jiraApiToken` are correct
- For Zoho: Verify `zohoOrgId` and `zohoAccessToken` are correct
- Check the console logs for specific error messages (marked with ✗)

### Ticket IDs not detected

- Check your commit messages contain ticket IDs in supported formats
- Add custom patterns to `customTicketPatterns` if needed
