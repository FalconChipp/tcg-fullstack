// src/modules/push/resolvers.js

import { sendExpoPushAsync, isValidExpoToken } from "./push.service.js";

export default {
  Mutation: {
    registerExpoPushToken: async (_, args, ctx) => {
      const userId = ctx?.user?.id;
      if (!userId) return { ok: false, error: "Not authenticated" };

      const UserPushToken = ctx?.models?.UserPushToken;
      if (!UserPushToken) return { ok: false, error: "UserPushToken model missing" };

      const expoPushToken = String(args?.expoPushToken || "").trim();

      if (!expoPushToken) return { ok: false, error: "expoPushToken is required" };
      if (!isValidExpoToken(expoPushToken))
        return { ok: false, error: "Invalid Expo push token format" };

      try {
        // CHANGED: use upsert to avoid duplicates (requires unique index userId+expoPushToken)
        await UserPushToken.upsert({
          userId,
          expoPushToken,
          platform: args?.platform || null,
          deviceName: args?.deviceName || null,
          appVersion: args?.appVersion || null,
          lastSeenAt: new Date(),
        });

        return { ok: true, error: null };
      } catch (e) {
        return { ok: false, error: e?.message || "Failed to save token" };
      }
    },

    unregisterExpoPushToken: async (_, args, ctx) => {
      const userId = ctx?.user?.id;
      if (!userId) return { ok: false, error: "Not authenticated" };

      const UserPushToken = ctx?.models?.UserPushToken;
      if (!UserPushToken) return { ok: false, error: "UserPushToken model missing" };

      const expoPushToken = String(args?.expoPushToken || "").trim();
      if (!expoPushToken) return { ok: false, error: "expoPushToken is required" };

      try {
        await UserPushToken.destroy({
          where: { userId, expoPushToken },
        });

        return { ok: true, error: null };
      } catch (e) {
        return { ok: false, error: e?.message || "Failed to remove token" };
      }
    },

    sendTestPush: async (_, args, ctx) => {
      const userId = ctx?.user?.id;
      if (!userId) return { ok: false, error: "Not authenticated" };

      const UserPushToken = ctx?.models?.UserPushToken;
      if (!UserPushToken) return { ok: false, error: "UserPushToken model missing" };

      try {
        const rows = await UserPushToken.findAll({
          where: { userId },
          attributes: ["expoPushToken"],
          limit: 25,
        });

        const tokens = rows.map((r) => r.expoPushToken).filter(Boolean);

        const res = await sendExpoPushAsync({
          tokens,
          title: String(args?.title || "Test"),
          body: String(args?.body || "Hello 👋"),
          data: { type: "test" },
        });

        return { ok: !!res.ok, error: res.error || null };
      } catch (e) {
        return { ok: false, error: e?.message || "Failed to send test push" };
      }
    },
  },
};
