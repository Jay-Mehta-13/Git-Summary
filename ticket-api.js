const https = require("https");

async function fetchJiraTicket(ticketId, config) {
	return new Promise((resolve) => {
		const auth = Buffer.from(`${config.jiraEmail}:${config.jiraApiToken}`).toString("base64");
		const options = {
			hostname: config.jiraDomain,
			path: `/rest/api/3/issue/${ticketId}`,
			method: "GET",
			headers: {
				Authorization: `Basic ${auth}`,
				Accept: "application/json",
			},
		};

		https
			.get(options, (res) => {
				let data = "";
				res.on("data", (chunk) => (data += chunk));
				res.on("end", () => {
					if (res.statusCode === 200) {
						const issue = JSON.parse(data);

						// Extract description from Jira's ADF format
						let description = "";
						if (issue.fields.description && issue.fields.description.content) {
							issue.fields.description.content.forEach((block) => {
								if (block.content) {
									block.content.forEach((item) => {
										if (item.text) {
											description += item.text + " ";
										}
									});
								}
							});
						}

						const result = {
							title: issue.fields.summary,
							description: description.trim() || "No description",
						};

						console.log(`✓ Fetched Jira ticket: ${ticketId}`);
						resolve(result);
					} else {
						console.log(`✗ Failed to fetch Jira ticket ${ticketId}: Status ${res.statusCode}`);
						resolve(null);
					}
				});
			})
			.on("error", (err) => {
				console.log(`✗ Error fetching Jira ticket ${ticketId}: ${err.message}`);
				resolve(null);
			});
	});
}

async function fetchZohoTicket(ticketId, config) {
	return new Promise((resolve) => {
		const options = {
			hostname: config.zohoDomain || "desk.zoho.com",
			path: `/api/v1/tickets/${ticketId}`,
			method: "GET",
			headers: {
				Authorization: `Zoho-oauthtoken ${config.zohoAccessToken}`,
				orgId: config.zohoOrgId,
			},
		};

		https
			.get(options, (res) => {
				let data = "";
				res.on("data", (chunk) => (data += chunk));
				res.on("end", () => {
					if (res.statusCode === 200) {
						const ticket = JSON.parse(data);
						console.log(`✓ Fetched Zoho ticket: ${ticketId}`);
						resolve(ticket.subject);
					} else {
						console.log(`✗ Failed to fetch Zoho ticket ${ticketId}: Status ${res.statusCode}`);
						resolve(null);
					}
				});
			})
			.on("error", (err) => {
				console.log(`✗ Error fetching Zoho ticket ${ticketId}: ${err.message}`);
				resolve(null);
			});
	});
}

async function fetchTicketDescription(ticketId, config) {
	if (ticketId === "No ticket ID") return null;

	const system = config.taskManagementSystem.toLowerCase();

	if (system === "jira") {
		return await fetchJiraTicket(ticketId, config);
	} else if (system === "zoho") {
		return await fetchZohoTicket(ticketId, config);
	}

	return null;
}

module.exports = { fetchTicketDescription };
