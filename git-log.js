#!/usr/bin/env node

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { fetchTicketDescription } = require("./ticket-api");

const configPath = path.join(__dirname, "config.json");

(async () => {
	try {
		const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

		if (!config.projectPath) {
			console.error("Error: projectPath is not configured in config.json");
			process.exit(1);
		}

		const absolutePath = path.resolve(config.projectPath);
		let gitCommand = `git log --oneline --since="midnight"`;

		if (config.author) {
			gitCommand += ` --author="${config.author}"`;
		}

		const result = execSync(gitCommand, {
			cwd: absolutePath,
			encoding: "utf-8",
		});

		const commits = result
			.trim()
			.split("\n")
			.filter((line) => line);

		// Built-in patterns for Jira and Zoho
		const builtInPatterns = [
			/[A-Z]+\d*-\d+/, // Jira: PROJ-123, M3-3633
			/[A-Z0-9]+-[A-Z]\d+/, // Zoho: AY1Q-T296
		];

		// Combine built-in patterns with custom patterns from config
		const patterns = [...builtInPatterns];
		if (config.customTicketPatterns && Array.isArray(config.customTicketPatterns)) {
			config.customTicketPatterns.forEach((pattern) => {
				patterns.push(new RegExp(pattern));
			});
		}

		for (const commit of commits) {
			let ticketId = "No ticket ID";

			for (const pattern of patterns) {
				const match = commit.match(pattern);
				if (match) {
					ticketId = match[0];
					break;
				}
			}

			const description = await fetchTicketDescription(ticketId, config);

			if (description) {
				console.log(`${ticketId} | ${description}`);
				console.log(`  ${commit}\n`);
			} else {
				console.log(`${ticketId} | ${commit}\n`);
			}
		}
	} catch (error) {
		console.error("Error:", error.message);
		process.exit(1);
	}
})();
