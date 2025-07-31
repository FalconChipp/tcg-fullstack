// scripts/sendBulkLaunchEmail.js

import 'dotenv/config';
import { sequelize, User } from '../src/models/index.js';
import { sendMail } from '../src/utils/email.js';
import emailBase from '../src/emails/emailBase.js';
import process from 'process';

const TEST_EMAIL = null; // Set to null/empty for production

async function sendBulkEmail() {
  let users;

  if (TEST_EMAIL) {
    // Test mode: Use fake username and your test address
    users = [{
      id: 'test-id',
      username: 'TestUser',
      email: TEST_EMAIL
    }];
    console.log(`[TEST MODE] Sending ONLY to ${TEST_EMAIL}`);
  } else {
    // Production: Send to real, verified users
    users = await User.findAll({
      where: { emailVerified: true, isBanned: false },
      attributes: ['id', 'username', 'email'],
      raw: true,
    });
    console.log(`[PRODUCTION MODE] Sending to ${users.length} users`);
  }

  // --- UPDATED: Subject now announces the site is live ---
  const subject = "SixByFive TCG is LIVE! Explore, Collect & Trade Now";

  let success = 0, fail = 0;
  for (const [i, user] of users.entries()) {
    // --- UPDATED: Heading now makes it clear we're live ---
    const heading = `We're Live, ${user.username || 'Trainer'}!`;

    // --- UPDATED: Email body now invites users to visit NOW ---
    const content = `
      <p style="font-size:17px;line-height:1.7;margin:0 0 18px 0;">
        Hello ${user.username || 'Trainer'}!
      </p>
      <p style="font-size:17px;line-height:1.7;margin:0 0 18px 0;">
        <strong>SixByFive TCG is now officially LIVE!</strong>
      </p>
      <p style="font-size:17px;line-height:1.7;margin:0 0 18px 0;">
        Head over to <a href="https://tcg.sixbyfive.com" style="color:#2963FF;text-decoration:underline;">tcg.sixbyfive.com</a> right now to:
        <ul style="font-size:16px;line-height:1.6;margin:10px 0 18px 20px;">
          <li>Manage and showcase your card collection</li>
          <li>Build digital binders</li>
          <li>Connect with collectors worldwide</li>
          <li>Get ready for marketplace trading & more!</li>
        </ul>
      </p>
      <p style="font-size:16px;line-height:1.6;margin:18px 0 0 0;">
        Thank you for being part of our journey.<br>
        <span style="color:#2963FF;font-weight:600;">– The SixByFive Team</span>
      </p>
    `; 

    // --- (Kept) Outro: announcement clarity, updated for current status ---
    const outro = `
      This is a one-time announcement to let you know SixByFive TCG is now live. If you have questions or feedback, just reply to this email!
    `;

    const html = emailBase({
      title: subject,
      heading,
      content,
      outro,
    });

    // Print HTML preview in test mode
    if (TEST_EMAIL) {
      console.log("--------- EMAIL HTML PREVIEW ---------");
      console.log(html);
      console.log("--------- END OF HTML PREVIEW --------");
    }

    try {
      await sendMail({
        to: user.email,
        subject,
        html,
      });
      console.log(`[${i + 1}/${users.length}] Sent to: ${user.email}`);
      success++;
    } catch (err) {
      console.error(`[${i + 1}/${users.length}] Failed: ${user.email} | ${err.message}`);
      fail++;
    }
    await new Promise(res => setTimeout(res, 150));
  }

  console.log(`All done! Success: ${success}, Fail: ${fail}`);
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log("[DB] Connection established.");
    await sendBulkEmail();
    process.exit(0);
  } catch (err) {
    console.error("[FATAL]", err);
    process.exit(1);
  }
})();
