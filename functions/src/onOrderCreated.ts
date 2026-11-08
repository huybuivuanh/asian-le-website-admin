import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { getFunctions } from "firebase-admin/functions";

const CONFIRMATION_CHECK_DELAY_SECONDS = 15;

/**
 * Fires once when an order is created. Doesn't do the confirmation check
 * itself — a Firestore trigger can't wait 30s — it just schedules
 * `checkOrderConfirmed` to run after the delay via Cloud Tasks, which
 * survives instance recycling and retries on failure (unlike a bare
 * `await sleep()` inside this trigger).
 */
export const onOrderCreated = onDocumentCreated(
  "businesses/{businessId}/orders/{orderId}",
  async (event) => {
    const { businessId, orderId } = event.params;
    const queue = getFunctions().taskQueue("checkOrderConfirmed");
    await queue.enqueue(
      { businessId, orderId },
      { scheduleDelaySeconds: CONFIRMATION_CHECK_DELAY_SECONDS },
    );
    logger.info(
      `Scheduled confirmation check for order ${orderId} in ${CONFIRMATION_CHECK_DELAY_SECONDS}s.`,
    );
  },
);
