// src/tasks/cardsearch.schedule.js
import { Scheduler } from "../modules/cardsearch/services/scheduler.service.js";

export function registerCardsearchSchedules() {
  if (!Scheduler || typeof Scheduler.addCron !== "function") {
    console.warn("[Cardsearch] Scheduler does not expose addCron; schedules not registered.");
    return;
  }

  // Daily FX at 01:05
  Scheduler.addCron("5 1 * * *", "fxDaily", { backfillFxDays: 2 }, { id: "fx-daily" });

  // Global rollups at 04:10
  Scheduler.addCron("10 4 * * *", "priceRollups", { scope: "all" }, { id: "rollups-daily" });

  // You can prewire some hot sets here, or rely on /sets/toggle to add per-set tasks.
  // Example (commented):
  // Scheduler.ensureSetTasks("sv08");
}

export default { registerCardsearchSchedules };
