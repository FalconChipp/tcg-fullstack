const fs = require('fs');
const csv = require('csv-parser');
const { v4: uuidv4 } = require('uuid');

// Helper: normalize to MySQL DATETIME, returns 'NULL' if invalid
function toMySQLDateOrNULL(dateStr) {
  if (!dateStr || dateStr.toLowerCase() === "null") return 'NULL';
  const d = new Date(dateStr);
  if (isNaN(d)) return 'NULL';
  function pad(n) { return n < 10 ? '0' + n : n; }
  return (
    d.getFullYear() + '-' +
    pad(d.getMonth() + 1) + '-' +
    pad(d.getDate()) + ' ' +
    pad(d.getHours()) + ':' +
    pad(d.getMinutes()) + ':' +
    pad(d.getSeconds())
  );
}

const inputFile = 'wp_sbf_users.csv';
const outputFile = 'users_import.csv';

const users = [];
let first = true;

fs.createReadStream(inputFile)
  .pipe(csv())
  .on('data', (row) => {
    if (first) {
      console.log('DEBUG: CSV column names:', Object.keys(row));
      console.log('DEBUG: First row:', row);
      first = false;
    }

    // Handle both naming conventions (your csv or WP export)
    const username = row['username'] || row['user_login'] || null;
    const email = row['email'] || row['user_email'] || null;
    let rawPass = row['hashed_pass'] || row['user_pass'] || null;
    let password = rawPass ? rawPass.replace(/^\$wp\$?/, '') : null;

    users.push({
      id: uuidv4(),
      username: username ? username : 'NULL',
      email: email ? email : 'NULL',
      password: password ? password : 'NULL',
      googleId: 'NULL',
      mfaSecret: 'NULL',
      mfaEnabled: 0,
      isAdmin: 0,
      isBanned: 0,
      chatBanned: 0,
      reputation: 0,
      lastLogin: 'NULL',
      resetToken: (row['reset_token'] && row['reset_token'].toLowerCase() !== "null") ? row['reset_token'] : 'NULL',
      resetTokenExpiry: (row['reset_token_expiry'] && row['reset_token_expiry'].toLowerCase() !== "null")
        ? toMySQLDateOrNULL(row['reset_token_expiry']) : 'NULL',
      verifyToken: (row['verification_token'] && row['verification_token'].toLowerCase() !== "null")
        ? row['verification_token'] : 'NULL',
      verifyTokenExpiry: 'NULL',
      referrerId: 'NULL',
      emailVerified: row['email_verified'] === '1' ? 1 : 0,
      createdAt: toMySQLDateOrNULL(row['created_at']),
      updatedAt: toMySQLDateOrNULL(row['updated_at']),
    });
  })
  .on('end', () => {
    const headers = [
      { id: 'id', title: 'id' },
      { id: 'username', title: 'username' },
      { id: 'email', title: 'email' },
      { id: 'password', title: 'password' },
      { id: 'googleId', title: 'googleId' },
      { id: 'mfaSecret', title: 'mfaSecret' },
      { id: 'mfaEnabled', title: 'mfaEnabled' },
      { id: 'isAdmin', title: 'isAdmin' },
      { id: 'isBanned', title: 'isBanned' },
      { id: 'chatBanned', title: 'chatBanned' },
      { id: 'reputation', title: 'reputation' },
      { id: 'lastLogin', title: 'lastLogin' },
      { id: 'resetToken', title: 'resetToken' },
      { id: 'resetTokenExpiry', title: 'resetTokenExpiry' },
      { id: 'verifyToken', title: 'verifyToken' },
      { id: 'verifyTokenExpiry', title: 'verifyTokenExpiry' },
      { id: 'referrerId', title: 'referrerId' },
      { id: 'emailVerified', title: 'emailVerified' },
      { id: 'createdAt', title: 'createdAt' },
      { id: 'updatedAt', title: 'updatedAt' },
    ];

    // Write as raw CSV, writing `NULL` for null fields (not quoted)
    let csv = headers.map(h => h.title).join(',') + '\n';
    users.forEach(user => {
      csv += headers.map(h => {
        const v = user[h.id];
        if (v === 'NULL') return v;
        // quote if contains comma or quote
        if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) {
          return `"${v.replace(/"/g, '""')}"`;
        }
        return v;
      }).join(',') + '\n';
    });

    fs.writeFileSync(outputFile, csv);
    console.log(`Converted! Output written to ${outputFile}`);
  });
