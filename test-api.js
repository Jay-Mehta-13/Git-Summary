#!/usr/bin/env node

const https = require("https");
const fs = require("fs");
const path = require("path");

const CONFIG_FILE = path.join(__dirname, "config.json");

function makeHttpsRequest(url, options) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: jsonData });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.end();
  });
}

(async () => {
  try {
    // Load config
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));

    if (!config.geminiApiKey) {
      console.error("❌ No API key found in config.json");
      process.exit(1);
    }

    console.log("🔍 Testing Gemini API key...\n");

    // Test API key by listing models
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${config.geminiApiKey}`;

    const options = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    };

    const result = await makeHttpsRequest(url, options);

    if (result.statusCode === 200) {
      console.log("✅ API key is valid!\n");
      console.log("📋 Available models:\n");

      result.data.models.forEach((model) => {
        if (model.supportedGenerationMethods?.includes("generateContent")) {
          console.log(`  ✓ ${model.name}`);
        }
      });

      console.log("\n💡 Update gemini-service.js to use one of these models");
    } else {
      console.error("❌ API key test failed:");
      console.error(JSON.stringify(result.data, null, 2));
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
})();
