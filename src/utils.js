const readline = require('readline');

// Function to prompt user for input
function prompt(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

module.exports = {
  prompt,
  rl,
};
