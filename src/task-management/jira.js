const https = require('https');

async function fetchJiraTicket(ticketId, config) {
  return new Promise(resolve => {
    const auth = Buffer.from(
      `${config.jiraEmail}:${config.jiraApiToken}`
    ).toString('base64');
    const options = {
      hostname: config.jiraDomain,
      path: `/rest/api/3/issue/${ticketId}`,
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    };

    https
      .get(options, res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            const issue = JSON.parse(data);

            // Extract description from Jira's ADF format
            let description = '';
            if (issue.fields.description && issue.fields.description.content) {
              issue.fields.description.content.forEach(block => {
                if (block.content) {
                  block.content.forEach(item => {
                    if (item.text) {
                      description += item.text + ' ';
                    }
                  });
                }
              });
            }

            const result = {
              key: ticketId,
              title: issue.fields.summary,
              description: description.trim() || 'No description',
              status: issue.fields.status?.name || 'Unknown',
              priority: issue.fields.priority?.name || 'None',
              type: issue.fields.issuetype?.name || 'Task',
              assignee: issue.fields.assignee?.displayName || 'Unassigned',
            };

            console.log(`✓ Fetched Jira ticket: ${ticketId}`);
            resolve(result);
          } else {
            console.log(
              `✗ Failed to fetch Jira ticket ${ticketId}: Status ${res.statusCode}`
            );
            resolve(null);
          }
        });
      })
      .on('error', err => {
        console.log(`✗ Error fetching Jira ticket ${ticketId}: ${err.message}`);
        resolve(null);
      });
  });
}

async function fetchZohoTicket(ticketId, config) {
  return new Promise(resolve => {
    const options = {
      hostname: config.zohoDomain || 'desk.zoho.com',
      path: `/api/v1/tickets/${ticketId}`,
      method: 'GET',
      headers: {
        Authorization: `Zoho-oauthtoken ${config.zohoAccessToken}`,
        orgId: config.zohoOrgId,
      },
    };

    https
      .get(options, res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            const ticket = JSON.parse(data);
            console.log(`✓ Fetched Zoho ticket: ${ticketId}`);
            resolve(ticket.subject);
          } else {
            console.log(
              `✗ Failed to fetch Zoho ticket ${ticketId}: Status ${res.statusCode}`
            );
            resolve(null);
          }
        });
      })
      .on('error', err => {
        console.log(`✗ Error fetching Zoho ticket ${ticketId}: ${err.message}`);
        resolve(null);
      });
  });
}

async function fetchTicketDescription(ticketId, config) {
  if (ticketId === 'No ticket ID') return null;

  const system = config.taskManagementSystem?.toLowerCase();

  if (system === 'jira') {
    return await fetchJiraTicket(ticketId, config);
  } else if (system === 'zoho') {
    return await fetchZohoTicket(ticketId, config);
  }

  return null;
}

/**
 * Fetch all "In Progress" Jira tickets assigned to a user with full details
 * @param {Object} jiraConfig - Jira configuration {domain, email, apiToken}
 * @param {string} userEmail - Email of the user to fetch tickets for
 * @returns {Promise<Array>} - Array of ticket objects with full details
 */
async function fetchAllJiraTickets(jiraConfig, userEmail) {
  return new Promise((resolve, reject) => {
    // Use apiEmail for authentication if available, fallback to email
    const authEmail = jiraConfig.apiEmail || jiraConfig.email;
    const auth = Buffer.from(`${authEmail}:${jiraConfig.apiToken}`).toString(
      'base64'
    );

    // JQL query to fetch "To Do" and "In Progress" tickets assigned to the user
    // Ordered by priority (Highest first) and then by updated date
    const jql = encodeURIComponent(
      `assignee = "${userEmail}" AND status IN ("To Do", "In Progress") ORDER BY priority DESC, updated DESC`
    );

    const options = {
      hostname: jiraConfig.domain,
      path: `/rest/api/3/search/jql?jql=${jql}&maxResults=100&fields=summary,description,status,priority,assignee,updated,issuetype,created,reporter,labels,components`,
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    };

    https
      .get(options, res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            const response = JSON.parse(data);
            const tickets = response.issues.map(issue => {
              // Extract description from Jira's ADF format
              let description = '';
              if (
                issue.fields.description &&
                issue.fields.description.content
              ) {
                issue.fields.description.content.forEach(block => {
                  if (block.content) {
                    block.content.forEach(item => {
                      if (item.text) {
                        description += item.text + ' ';
                      }
                    });
                  }
                });
              }

              return {
                key: issue.key,
                summary: issue.fields.summary,
                description: description.trim() || 'No description',
                status: issue.fields.status.name,
                priority: issue.fields.priority?.name || 'None',
                priorityId: issue.fields.priority?.id || '999',
                type: issue.fields.issuetype.name,
                created: issue.fields.created,
                updated: issue.fields.updated,
                reporter: issue.fields.reporter?.displayName || 'Unknown',
                labels: issue.fields.labels || [],
                components: issue.fields.components?.map(c => c.name) || [],
              };
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

            resolve(tickets);
          } else {
            try {
              const errorData = JSON.parse(data);
              reject(
                new Error(
                  `Failed to fetch Jira tickets: ${res.statusCode} - ${
                    errorData.errorMessages?.join(', ') ||
                    errorData.message ||
                    data
                  }`
                )
              );
            } catch (e) {
              reject(
                new Error(
                  `Failed to fetch Jira tickets: Status ${res.statusCode} - ${data}`
                )
              );
            }
          }
        });
      })
      .on('error', err => {
        reject(new Error(`Error fetching Jira tickets: ${err.message}`));
      });
  });
}

module.exports = { fetchTicketDescription, fetchAllJiraTickets };
