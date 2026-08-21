import mqtt, { MqttClient } from "mqtt";

const MQTT_URL = import.meta.env.VITE_MQTT_URL as string | undefined;
const MQTT_USERNAME = import.meta.env.VITE_MQTT_USERNAME as string | undefined;
const MQTT_PASSWORD = import.meta.env.VITE_MQTT_PASSWORD as string | undefined;

export const isMqttConfigured = !!MQTT_URL;

let client: MqttClient | null = null;
// subscribed pattern -> callbacks. Patterns may contain MQTT wildcards
// ("+" for a single level, "#" for the rest) — e.g. Super Admin subscribes
// to "hms/hospital/+/alerts" to hear every hospital's alarms at once.
const listeners = new Map<string, Set<(payload: any, topic: string) => void>>();

/** MQTT topic wildcard matching: "+" = exactly one level, "#" = rest of the topic. */
function topicMatches(pattern: string, topic: string): boolean {
  const patternParts = pattern.split("/");
  const topicParts = topic.split("/");
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i] === "#") return true;
    if (i >= topicParts.length) return false;
    if (patternParts[i] !== "+" && patternParts[i] !== topicParts[i]) return false;
  }
  return patternParts.length === topicParts.length;
}

function getClient(): MqttClient | null {
  if (!isMqttConfigured) return null;
  if (client) return client;

  client = mqtt.connect(MQTT_URL!, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    clientId: `hms-web-${Math.random().toString(16).slice(2)}`,
    reconnectPeriod: 3000,
    connectTimeout: 8000,
  });

  client.on("message", (topic, payload) => {
    let parsed: any;
    try {
      parsed = JSON.parse(payload.toString());
    } catch {
      return;
    }
    listeners.forEach((callbacks, pattern) => {
      if (topicMatches(pattern, topic)) callbacks.forEach((cb) => cb(parsed, topic));
    });
  });

  return client;
}

/**
 * Subscribe to a topic (wildcards allowed) for the lifetime of the calling
 * component. Returns an unsubscribe function — call it from a useEffect
 * cleanup. Safe to call even when MQTT isn't configured (VITE_MQTT_URL
 * unset): it's a no-op, so pages degrade to their REST-polling fallback
 * instead of crashing.
 */
export function subscribeMqtt(topic: string, onMessage: (payload: any, topic: string) => void): () => void {
  const c = getClient();
  if (!c) return () => {};

  if (!listeners.has(topic)) {
    listeners.set(topic, new Set());
    c.subscribe(topic, { qos: 1 });
  }
  listeners.get(topic)!.add(onMessage);

  return () => {
    const callbacks = listeners.get(topic);
    if (!callbacks) return;
    callbacks.delete(onMessage);
    if (callbacks.size === 0) {
      listeners.delete(topic);
      c.unsubscribe(topic);
    }
  };
}

/** Fire-and-forget publish. No-op (never throws) if MQTT isn't configured. */
export function publishMqtt(topic: string, payload: unknown): void {
  const c = getClient();
  if (!c) return;
  c.publish(topic, JSON.stringify(payload), { qos: 1 });
}

