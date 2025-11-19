const fs = require("fs");
const path = require("path");

const CONFIG_FILE = path.join(__dirname, "config.json");

/**
 * Load configuration from config.json
 */
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("❌ Error reading config file:", error.message);
  }
  return null;
}

/**
 * Make POST request to Zoho OAuth API using fetch
 */
async function makeZohoRequest(url) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const data = await response.json();

    if (response.ok) {
      return data;
    } else {
      throw new Error(
        `Request failed with status ${response.status}: ${JSON.stringify(data)}`
      );
    }
  } catch (error) {
    throw new Error(`Failed to make request: ${error.message}`);
  }
}

/**
 * Make GET request to Zoho API with access token using fetch
 */
async function makeZohoGetRequest(url, accessToken) {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      data: data,
    };
  } catch (error) {
    throw new Error(`Failed to make request: ${error.message}`);
  }
}

/**
 * Refresh access token using refresh token
 */
async function refreshZohoAccessToken() {
  const config = loadConfig();

  if (!config || !config.zoho) {
    console.error("❌ Error: Zoho configuration not found!");
    return null;
  }

  const { refreshToken, clientId, clientSecret, scope } = config.zoho;

  if (!refreshToken || !clientId || !clientSecret) {
    console.error("❌ Error: Missing refresh token or credentials!");
    console.log("💡 Run: node git-log.js -z to generate tokens first\n");
    return null;
  }

  try {
    const url = `https://accounts.zoho.com/oauth/v2/token?refresh_token=${refreshToken}&client_id=${clientId}&client_secret=${clientSecret}&grant_type=refresh_token`;

    const response = await makeZohoRequest(url);

    // Check for error in response
    if (response.error) {
      console.error(`❌ Error: Token refresh failed - ${response.error}\n`);
      return null;
    }

    // API hit successful - update tokens
    if (response.access_token) {
      config.zoho.accessToken = response.access_token;

      // Store scope if available
      if (response.scope) {
        config.zoho.scope = response.scope;
      }

      // Store token expiry time
      if (response.expires_in) {
        config.zoho.tokenExpiry = Date.now() + response.expires_in * 1000;
      }

      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

      return response.access_token;
    }

    return null;
  } catch (error) {
    console.error(`❌ Error: Token refresh failed - ${error.message}\n`);
    return null;
  }
}

/**
 * Exchange authorization code for access token and refresh token
 */
async function getZohoAccessToken() {
  console.log("\n🔄 Generating Zoho OAuth tokens...\n");

  const config = loadConfig();

  if (!config) {
    console.error("❌ Configuration file not found!");
    console.log("💡 Run: node git-log.js --setup\n");
    return null;
  }

  if (!config.zoho) {
    console.error("❌ Zoho configuration not found in config!");
    console.log(
      "💡 Run: node git-log.js --setup to configure Zoho integration\n"
    );
    return null;
  }

  const { generatedCode, clientId, clientSecret } = config.zoho;

  if (!generatedCode || !clientId || !clientSecret) {
    console.error("❌ Missing Zoho credentials in config!");
    console.log("Required fields: generatedCode, clientId, clientSecret");
    console.log(
      "💡 Run: node git-log.js --setup to configure Zoho integration\n"
    );
    return null;
  }

  try {
    const url = `https://accounts.zoho.com/oauth/v2/token?code=${generatedCode}&client_id=${clientId}&client_secret=${clientSecret}&grant_type=authorization_code`;
    const response = await makeZohoRequest(url);

    // Check for error in response
    if (response.error) {
      console.error(`❌ Error: Request failed ${response.error}\n\n`);

      if (response.error === "invalid_code") {
        console.log("⚠️  The generated code has expired or was already used.");
        console.log("💡 Generate a new code from Zoho API Console:");
        console.log("   1. Go to https://api-console.zoho.com/");
        console.log("   2. Navigate to Self Client section");
        console.log("   3. Generate a new code");
        console.log("   4. Run: node git-log.js --setup to update config\n");
      }
      return null;
    }

    // API hit successful - store tokens
    if (response.access_token && response.refresh_token) {
      config.zoho.accessToken = response.access_token;
      config.zoho.refreshToken = response.refresh_token;

      // Store scope if available
      if (response.scope) {
        config.zoho.scope = response.scope;
      }

      // Store token expiry time
      if (response.expires_in) {
        config.zoho.tokenExpiry = Date.now() + response.expires_in * 1000;
      }

      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

      // Log success message
      console.log("✅ Successfully received Zoho OAuth tokens!");
    }

    return response;
  } catch (error) {
    console.error("\n❌ Error: Request failed");
    console.error(`   ${error.message}\n`);
    return null;
  }
}

/**
 * Fetch portal details from Zoho Projects
 */
async function fetchZohoPortals() {
  console.log("\n🔄 Fetching Zoho portal details...");

  const config = loadConfig();

  if (!config) {
    console.error("❌ Error: Configuration file not found!");
    console.log("💡 Run: node git-log.js --setup\n");
    return null;
  }

  if (!config.zoho) {
    console.error("❌ Error: Zoho configuration not found in config!");
    console.log(
      "💡 Run: node git-log.js --setup to configure Zoho integration\n"
    );
    return null;
  }

  let { accessToken } = config.zoho;

  if (!accessToken) {
    console.error("❌ Error: Access token not found!");
    console.log("💡 Run: node git-log.js -z to generate access token first\n");
    return null;
  }

  try {
    const url = "https://projectsapi.zoho.com/api/v3/portals";
    let response = await makeZohoGetRequest(url, accessToken);

    // Handle 401 Unauthorized - refresh token and retry
    if (response.statusCode === 401) {
      console.log("🔄 Refreshing expired access token...");

      const newAccessToken = await refreshZohoAccessToken();

      if (!newAccessToken) {
        console.error("❌ Error: Failed to refresh access token\n");
        return null;
      }

      // Retry the request with new access token
      response = await makeZohoGetRequest(url, newAccessToken);
    }

    // Check for errors in response
    if (response.statusCode !== 200) {
      const errorMsg =
        response.data.error?.details?.[0]?.message ||
        response.data.error?.message ||
        response.data.error ||
        `Status code ${response.statusCode}`;
      console.error(`❌ Error: Request failed - ${errorMsg}\n`);
      return null;
    }

    // Check if response has error
    if (response.data.error) {
      const errorMsg =
        response.data.error.details?.[0]?.message ||
        response.data.error.message ||
        response.data.error;
      console.error(`❌ Error: Request failed - ${errorMsg}\n`);
      return null;
    }

    // Success - extract and store portal ID (zsoid)
    if (Array.isArray(response.data) && response.data.length > 0) {
      const portal = response.data[0];

      if (portal.zsoid) {
        config.zoho.portalId = portal.zsoid;
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

        console.log("✅ Successfully fetched portal details!");
        console.log(`   Portal Name: ${portal.portal_name || "N/A"}`);
        console.log(`   Portal ID: ${portal.zsoid}`);
        console.log(`   Organization: ${portal.org_name || "N/A"}`);
      } else {
        console.log("✅ Successfully fetched portal details!");
        console.log(`   Portal Name: ${portal.portal_name || "N/A"}`);
        console.log(`   Organization: ${portal.org_name || "N/A"}\n`);
      }
    } else {
      console.log("✅ Portal details fetched (no portals found)\n");
    }

    return response.data;
  } catch (error) {
    console.error(`❌ Error: Request failed - ${error.message}\n`);
    return null;
  }
}

/**
 * Fetch all projects from Zoho portal
 */
async function fetchZohoProjects(portalId, accessToken) {
  console.log("─────────────────────────────────────────────");
  console.log("🔍 Fetching projects from portal...");

  const config = loadConfig();
  if (!config || !config.zoho) {
    console.error("❌ Error: Configuration not found\n");
    return null;
  }

  try {
    const url = `https://projectsapi.zoho.com/api/v3/portal/${portalId}/projects?page=1&per_page=100`;
    let response = await makeZohoGetRequest(url, accessToken);

    // Handle 401 Unauthorized - refresh token and retry
    if (response.statusCode === 401) {
      console.log("🔄 Access token expired, refreshing...");

      const newAccessToken = await refreshZohoAccessToken();

      if (!newAccessToken) {
        console.error("❌ Error: Failed to refresh access token\n");
        return null;
      }

      // Retry the request with new access token
      response = await makeZohoGetRequest(url, newAccessToken);
    }

    // Check for errors in response
    if (response.statusCode !== 200) {
      const errorMsg =
        response.data.error?.details?.[0]?.message ||
        response.data.error?.message ||
        response.data.error ||
        `Status code ${response.statusCode}`;
      console.error(`❌ Error: Failed to fetch projects - ${errorMsg}\n`);
      return null;
    }

    // Check if response has error
    if (response.data.error) {
      const errorMsg =
        response.data.error.details?.[0]?.message ||
        response.data.error.message ||
        response.data.error;
      console.error(`❌ Error: Failed to fetch projects - ${errorMsg}\n`);
      return null;
    }

    // Success - extract and store project details
    // Response can be either an array directly or wrapped in a projects property
    const projectsData = Array.isArray(response.data)
      ? response.data
      : response.data.projects && Array.isArray(response.data.projects)
      ? response.data.projects
      : null;

    if (projectsData && projectsData.length > 0) {
      const projects = projectsData.map((project) => ({
        id: project.id,
        name: project.name,
      }));

      // Store projects in config
      config.zoho.projects = projects;
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

      console.log(`✅ Successfully fetched ${projects.length} projects!\n`);
      console.log("📋 Projects:");
      projects.forEach((project, index) => {
        console.log(`   ${index + 1}. ${project.name}`);
      });
      console.log("\n💾 Projects saved to config.json");

      return projects;
    } else {
      console.log("✅ No projects found in portal\n");
      return [];
    }
  } catch (error) {
    console.error(`❌ Error: Failed to fetch projects - ${error.message}\n`);
    return null;
  }
}

/**
 * Complete Zoho setup - Generate tokens and fetch portal details
 */
async function setupZohoIntegration() {
  // Step 1: Generate OAuth tokens
  console.log("🔑 Generating OAuth tokens...");
  const tokenResponse = await getZohoAccessToken();

  if (!tokenResponse) {
    console.error("❌ Setup failed: Could not generate OAuth tokens\n");
    return null;
  }

  const accessToken = tokenResponse.access_token;
  // Step 2: Fetch portal details
  console.log("───────────────────────────────────────────────────");
  console.log("\n🔍 Fetching portal details...");

  const config = loadConfig();
  if (!config || !config.zoho) {
    console.error("❌ Error: Configuration not found\n");
    return null;
  }

  try {
    const url = "https://projectsapi.zoho.com/api/v3/portals";
    let response = await makeZohoGetRequest(url, accessToken);

    // Handle 401 Unauthorized - refresh token and retry
    if (response.statusCode === 401) {
      console.log("🔄 Access token expired, refreshing...");

      const newAccessToken = await refreshZohoAccessToken();

      if (!newAccessToken) {
        console.error("❌ Error: Failed to refresh access token\n");
        return null;
      }

      // Retry the request with new access token
      response = await makeZohoGetRequest(url, newAccessToken);
    }

    // Check for errors in response
    if (response.statusCode !== 200) {
      const errorMsg =
        response.data.error?.details?.[0]?.message ||
        response.data.error?.message ||
        response.data.error ||
        `Status code ${response.statusCode}`;
      console.error(`❌ Error: Failed to fetch portal details - ${errorMsg}\n`);
      return null;
    }

    // Check if response has error
    if (response.data.error) {
      const errorMsg =
        response.data.error.details?.[0]?.message ||
        response.data.error.message ||
        response.data.error;
      console.error(`❌ Error: Failed to fetch portal details - ${errorMsg}\n`);
      return null;
    }

    // Success - extract and store portal ID (zsoid)
    if (Array.isArray(response.data) && response.data.length > 0) {
      const portal = response.data[0];

      if (portal.zsoid) {
        config.zoho.portalId = portal.zsoid;
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

        console.log("✅ Portal details fetched successfully!");
        console.log(`   Portal Name: ${portal.portal_name || "N/A"}`);
        console.log(`   Portal ID: ${portal.zsoid}`);
        console.log(`   Organization: ${portal.org_name || "N/A"}`);
        console.log("\n💾 Portal ID saved to config.json\n");

        // Step 3: Fetch projects from portal
        const projects = await fetchZohoProjects(portal.zsoid, accessToken);

        if (projects === null) {
          console.error("❌ Setup failed: Could not fetch projects\n");
          return null;
        }

        return {
          tokens: tokenResponse,
          portal: response.data,
          projects: projects,
        };
      } else {
        console.log("✅ Portal details fetched!");
        console.log(`   Portal Name: ${portal.portal_name || "N/A"}`);
        console.log(`   Organization: ${portal.org_name || "N/A"}`);
        console.log("\n⚠️  Warning: Could not find portal ID\n");
        return {
          tokens: tokenResponse,
          portal: response.data,
        };
      }
    } else {
      console.log("✅ Portal details fetched (no portals found)");
      console.log("\n🎉 Zoho integration setup completed!\n");
      return {
        tokens: tokenResponse,
        portal: response.data,
      };
    }
  } catch (error) {
    console.error(
      `❌ Error: Failed to fetch portal details - ${error.message}\n`
    );
    return null;
  }
}

module.exports = {
  getZohoAccessToken,
  refreshZohoAccessToken,
  fetchZohoPortals,
  fetchZohoProjects,
  setupZohoIntegration,
};
