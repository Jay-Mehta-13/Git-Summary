async function fetchJiraTicket(ticketId, config) {
  console.log(`\n� Fetching Jira ticket: ${ticketId}`);
  try {
    const auth = Buffer.from(
      `${config.jiraEmail}:${config.jiraApiToken}`
    ).toString("base64");

    const url = `https://${config.jiraDomain}/rest/api/3/issue/${ticketId}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    });

    console.log("🚀 ~ fetchJiraTicket ~ response:", response);

    if (response.ok) {
      const issue = await response.json();

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
        key: ticketId,
        title: issue.fields.summary,
        description: description.trim() || "No description",
        status: issue.fields.status?.name || "Unknown",
        priority: issue.fields.priority?.name || "None",
        type: issue.fields.issuetype?.name || "Task",
        assignee: issue.fields.assignee?.displayName || "Unassigned",
      };

      console.log(`✅ Successfully fetched ticket: ${ticketId}`);
      console.log(`   📋 Title: ${result.title}`);
      console.log(`   📝 Description: ${result.description}`);
      console.log(`   📊 Status: ${result.status}`);
      console.log(`   ⚡ Priority: ${result.priority}`);
      console.log(`   🏷️  Type: ${result.type}`);
      console.log(`   👤 Assignee: ${result.assignee}`);

      return result;
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.log(`❌ Failed to fetch Jira ticket: ${ticketId}`);
      console.log(`   🔴 Status Code: ${response.status}`);
      console.log(`   📄 Response: ${response.statusText}`);
      if (errorData.errorMessages) {
        console.log(`   💬 Error: ${errorData.errorMessages.join(", ")}`);
      }
      if (response.status === 404) {
        console.log(
          `   ℹ️  Ticket ${ticketId} not found or you don't have permission to view it`
        );
      }
      return null;
    }
  } catch (err) {
    console.log(`❌ Error fetching Jira ticket: ${ticketId}`);
    console.log(`   ⚠️  Error message: ${err.message}`);
    console.log(
      `   💡 Please check your network connection and Jira credentials`
    );
    return null;
  }
}

async function fetchZohoTicket(ticketId, config) {
  console.log(`\n🔍 Fetching Zoho ticket: ${ticketId}`);
  try {
    const domain = config.zohoDomain || "desk.zoho.com";
    const url = `https://${domain}/api/v1/tickets/${ticketId}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Zoho-oauthtoken ${config.zohoAccessToken}`,
        orgId: config.zohoOrgId,
      },
    });
    console.log("🚀 ~ fetchZohoTicket ~ response:", response);

    if (response.ok) {
      const ticket = await response.json();
      console.log(`✅ Successfully fetched ticket: ${ticketId}`);
      console.log(`   📋 Subject: ${ticket.subject || "No subject"}`);
      console.log(
        `   📝 Description: ${ticket.description || "No description"}`
      );
      return ticket.subject;
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.log(`❌ Failed to fetch Zoho ticket: ${ticketId}`);
      console.log(`   🔴 Status Code: ${response.status}`);
      console.log(`   📄 Response: ${response.statusText}`);
      if (errorData.message) {
        console.log(`   💬 Error: ${errorData.message}`);
      }
      if (response.status === 404) {
        console.log(
          `   ℹ️  Ticket ${ticketId} not found or you don't have permission to view it`
        );
      }
      return null;
    }
  } catch (err) {
    console.log(`❌ Error fetching Zoho ticket: ${ticketId}`);
    console.log(`   ⚠️  Error message: ${err.message}`);
    console.log(
      `   💡 Please check your network connection and Zoho credentials`
    );
    return null;
  }
}

async function fetchTicketDescription(ticketId, config) {
  if (ticketId === "No ticket ID") {
    console.log(`\n⚠️  No ticket ID provided, skipping fetch`);
    return null;
  }

  const system = config.taskManagementSystem?.toLowerCase();

  if (system === "jira") {
    return await fetchJiraTicket(ticketId, config);
  } else if (system === "zoho") {
    return await fetchZohoTicket(ticketId, config);
  } else {
    console.log(
      `\n⚠️  Unknown task management system: ${system || "not configured"}`
    );
    console.log(`   💡 Please configure Jira or Zoho in your project settings`);
    return null;
  }
}

/**
 * Fetch all "In Progress" Jira tickets assigned to a user with full details
 * @param {Object} jiraConfig - Jira configuration {domain, email, apiToken}
 * @param {string} userEmail - Email of the user to fetch tickets for
 * @returns {Promise<Array>} - Array of ticket objects with full details
 */
async function fetchAllJiraTickets(jiraConfig, userEmail) {
  console.log(`\n🔍 Fetching all active Jira tickets for: ${userEmail}`);
  console.log(`   📊 Looking for "To Do" and "In Progress" tickets...`);

  try {
    // Use apiEmail for authentication if available, fallback to email
    const authEmail = jiraConfig.apiEmail || jiraConfig.email;
    const auth = Buffer.from(`${authEmail}:${jiraConfig.apiToken}`).toString(
      "base64"
    );

    // JQL query to fetch "To Do" and "In Progress" tickets assigned to the user
    // Ordered by priority (Highest first) and then by updated date
    const jql = `assignee = "${userEmail}" AND status IN ("To Do", "In Progress") ORDER BY priority DESC, updated DESC`;

    // Use the new enhanced JQL search endpoint (POST /rest/api/3/search/jql)
    // This replaces the deprecated /rest/api/3/search endpoint
    const url = `https://${jiraConfig.domain}/rest/api/3/search/jql`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jql: jql,
        maxResults: 100,
        fields: [
          "summary",
          "description",
          "status",
          "priority",
          "assignee",
          "updated",
          "issuetype",
          "created",
          "reporter",
          "labels",
          "components",
        ],
      }),
    });
    console.log("🚀 ~ fetchAllJiraTickets ~ response:", response);

    if (response.ok) {
      const data = await response.json();

      console.log(
        `\n✅ Successfully fetched ${data.issues.length} active ticket(s)`
      );

      const tickets = data.issues.map((issue, index) => {
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

        const ticket = {
          key: issue.key,
          summary: issue.fields.summary,
          description: description.trim() || "No description",
          status: issue.fields.status.name,
          priority: issue.fields.priority?.name || "None",
          priorityId: issue.fields.priority?.id || "999",
          type: issue.fields.issuetype.name,
          created: issue.fields.created,
          updated: issue.fields.updated,
          reporter: issue.fields.reporter?.displayName || "Unknown",
          labels: issue.fields.labels || [],
          components: issue.fields.components?.map((c) => c.name) || [],
        };

        // Log each ticket details
        console.log(`\n   ─────────────────────────────────────────────────`);
        console.log(`   📌 Ticket #${index + 1}: ${ticket.key}`);
        console.log(`   📋 Summary: ${ticket.summary}`);
        console.log(
          `   📝 Description: ${ticket.description.substring(0, 100)}${
            ticket.description.length > 100 ? "..." : ""
          }`
        );
        console.log(`   📊 Status: ${ticket.status}`);
        console.log(`   ⚡ Priority: ${ticket.priority}`);
        console.log(`   🏷️  Type: ${ticket.type}`);
        console.log(`   👤 Reporter: ${ticket.reporter}`);
        if (ticket.labels.length > 0) {
          console.log(`   🏷️  Labels: ${ticket.labels.join(", ")}`);
        }
        if (ticket.components.length > 0) {
          console.log(`   🔧 Components: ${ticket.components.join(", ")}`);
        }

        return ticket;
      });

      // Sort tickets by priority: Highest -> High -> Medium -> Low -> None
      const priorityOrder = {
        Highest: 1,
        High: 2,
        Medium: 3,
        Low: 4,
        None: 5,
      };

      tickets.sort((a, b) => {
        const priorityA = priorityOrder[a.priority] || 999;
        const priorityB = priorityOrder[b.priority] || 999;
        return priorityA - priorityB;
      });

      console.log(`   ─────────────────────────────────────────────────\n`);
      console.log(`✨ Tickets sorted by priority (Highest to Low)\n`);

      return tickets;
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.log(`\n❌ Failed to fetch Jira tickets`);
      console.log(`   🔴 Status Code: ${response.status}`);
      console.log(`   📄 Response: ${response.statusText}`);
      if (errorData.errorMessages) {
        console.log(`   💬 Error: ${errorData.errorMessages.join(", ")}`);
      }
      throw new Error(
        `Failed to fetch Jira tickets: ${response.status} - ${
          errorData.errorMessages?.join(", ") ||
          errorData.message ||
          "Unknown error"
        }`
      );
    }
  } catch (err) {
    console.log(`\n❌ Error fetching Jira tickets`);
    console.log(`   ⚠️  Error message: ${err.message}`);
    console.log(
      `   💡 Please check your Jira credentials and network connection`
    );
    throw new Error(`Error fetching Jira tickets: ${err.message}`);
  }
}

module.exports = { fetchTicketDescription, fetchAllJiraTickets };
