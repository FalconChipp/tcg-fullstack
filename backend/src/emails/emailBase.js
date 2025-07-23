const LOGO_URL = "https://tcg.sixbyfive.com/assets/tcg-logo.png";

export default function emailBase({ title, heading, content, outro = '', year = new Date().getFullYear() }) {
  return `
<html>
<body style="background:#f5f6fa;padding:32px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="font-family:Inter,Arial,sans-serif;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" width="480" style="background:#fff;border-radius:18px;box-shadow:0 2px 12px #0001;border:1px solid #e2e8f0;">
          <tr>
            <td style="padding:36px 36px 28px 36px;text-align:center;">
              <!-- FAKE CROP LOGO -->
              <div style="width:220px;height:60px;display:inline-block;margin-bottom:18px;border-radius:10px;box-shadow:0 1px 12px #2963FF22;">
                <img src="${LOGO_URL}" alt="SixByFive TCG Logo"
                    width="220"
                    style="display:block;width:220px;height:auto;position:relative;top:-30px;">
              </div>
              <h3 style="color:#232346;margin:0 0 14px 0;font-size:21px;">${heading || title}</h3>
              ${content}
              <p style="color:#8f98bc;font-size:12px;margin-top:30px;">
                ${outro}
                <br>
                <span style="display:block;margin-top:8px;">&copy; ${year} SixByFive TCG – All rights reserved.</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.replace(/\n\s+/g, '\n');
}
