import mqtt, { MqttClient } from "mqtt";
import { env, isMqttConfigured } from "../config/env";
import { logger } from "../config/logger";

// Publish-only, by design: the backend is the sole trusted source of the
// hospital alarm event (an authenticated, permission-checked API call
// triggers it), so nothing about "did hospital X really get an emergency
// case" is ever taken on faith from a browser-published MQTT message. Live
// PPG vitals are high-frequency and don't need server mediation, so those
// go straight from the paramedic's browser to HiveMQ and back out to
// subscribers — see frontend/src/lib/mqttClient.ts.
let client: MqttClient | null = null;
let connecting: Promise<MqttClient> | null = null;

function getClient(): Promise<MqttClient> {
  if (client?.connected) return Promise.resolve(client);
  if (connecting) return connecting;

  connecting = new Promise((resolve, reject) => {
    const c = mqtt.connect(env.MQTT_URL!, {
      username: env.MQTT_USERNAME,
      password: env.MQTT_PASSWORD,
      clientId: `hms-backend-${Math.random().toString(16).slice(2)}`,
      reconnectPeriod: 5000,
      connectTimeout: 8000,
    });

    c.once("connect", () => {
      client = c;
      logger.info("MQTT: connected to broker (server publisher)");
      resolve(c);
    });
    c.once("error", (err) => {
      logger.warn({ err }, "MQTT: connection error");
      reject(err);
    });
    // Keep reconnecting quietly in the background after the first success;
    // don't let a later drop reject anyone else's in-flight publish call.
    c.on("error", () => {});
  });

  return connecting;
}

/**
 * Publish a JSON payload to an MQTT topic. Never throws — a broker outage
 * must not take down the emergency-case API; the case's state is already
 * safely persisted in Postgres by the time this is called, so a failed
 * publish only means the real-time push is missed (clients polling REST as
 * a fallback still catch up, same pattern as the ambulance trip tracking).
 */
export async function publishMqtt(topic: string, payload: unknown): Promise<void> {
  if (!isMqttConfigured) {
    logger.warn({ topic }, "MQTT not configured — skipping publish (see MQTT_URL/MQTT_USERNAME/MQTT_PASSWORD in .env)");
    return;
  }

  try {
    const c = await getClient();
    await new Promise<void>((resolve, reject) => {
      c.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => (err ? reject(err) : resolve()));
    });
  } catch (err) {
    logger.warn({ err, topic }, "MQTT: failed to publish");
  }
}
