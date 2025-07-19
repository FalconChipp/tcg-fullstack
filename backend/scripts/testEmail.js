// scripts/testEmail.js

import readline from "readline";

// ---- CONFIG: Your template builder files and their sample params ----
const templates = {
  buildWelcomeEmail: {
    file: "buildWelcomeEmail.js",
    params: { username: "TestUser" },
  },
  buildVerificationEmail: {
    file: "buildVerificationEmail.js",
    params: {
      username: "TestUser",
      verificationUrl: "https://tcg.sixbyfive.com/verify?token=abc123",
    },
  },
  buildResetEmail: {
    file: "buildResetEmail.js",
    params: {
      username: "TestUser",
      resetUrl: "https://tcg.sixbyfive.com/reset?token=abc123",
    },
  },
  buildMfaEmail: {
    file: "buildMfaEmail.js",
    params: {
      username: "TestUser",
      code: "123456",
    },
  },
  unreadMessageReminder: {
    file: "unreadMessageReminder.js",
    params: {
      senderUsername: "PokeMaster",
      content: "Hey, are you still interested in trading?",
    },
  },
};

// Optional: import sendMail if using --send
let sendMail;
try {
  // Try to import your mail util from src/emails/email.js
  ({ sendMail } = await import("../src/utils/email.js"));
} catch (e) {
  // fallback, but if this fails you get a proper error below
}

// CLI: node scripts/testEmail.js <template> [--send <toEmail>]
async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args[0] === "--help") {
    console.log("Usage: node scripts/testEmail.js <templateName> [--send <email>]");
    console.log("Available templates:", Object.keys(templates).join(", "));
    process.exit(0);
  }
  const [templateName, sendFlag, emailArg] = args;
  const entry = templates[templateName];
  if (!entry) {
    console.error("Unknown template. Available:", Object.keys(templates).join(", "));
    process.exit(1);
  }

  // --- Dynamic import from src/emails/ ---
  const templateModule = await import(`../src/emails/${entry.file}`);
  const builder = templateModule.default;
  if (!builder) throw new Error(`No default export in ${entry.file}`);

  // --- Ask for param overrides interactively ---
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let params = { ...entry.params };
  for (const key of Object.keys(params)) {
    params[key] = await new Promise((res) => {
      rl.question(`Value for "${key}" [${params[key]}]: `, (v) => res(v || params[key]));
    });
  }
  rl.close();

  // --- Build the email ---
  const output = builder(params);
  if (!output.subject || !output.html) {
    throw new Error("Template did not return {subject, html}");
  }
  console.log("\n=== Subject ===\n" + output.subject);
  console.log("\n=== HTML ===\n" + output.html);

  // --- Optionally send ---
  if (sendFlag === "--send" && emailArg) {
    if (!sendMail) {
      throw new Error("sendMail not available. Check your email.js import.");
    }
    await sendMail({ to: emailArg, subject: output.subject, html: output.html });
    console.log(`\nEmail sent to ${emailArg}`);
  } else {
    console.log("\nEmail not sent. Use --send <email> to send.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
