// functions/whatsapp/sendWhatsApp.js
//
// Thin wrapper around Meta Cloud API WhatsApp messages.
// Only sends template messages (required for business-initiated conversations).

const fetch = require('node-fetch');

const GRAPH_API_VERSION = 'v21.0';

/**
 * Send a WhatsApp template message via Meta Cloud API.
 *
 * @param {string} toPhoneE164     - Recipient's phone number in E.164 format (e.g. "+9779800000000")
 * @param {string} templateName    - Approved template name (e.g. "tree_shared", "event_reminder")
 * @param {string} languageCode    - BCP-47 language code (e.g. "en", "ne")
 * @param {Array}  components      - Template component overrides (header, body, etc.)
 *                                   Example for body parameters:
 *                                   [{ type: 'body', parameters: [{ type: 'text', text: 'Alice' }] }]
 * @returns {Promise<object>}      - Raw Meta API response JSON
 * @throws {Error}                 - On HTTP error or missing config
 */
async function sendTemplateMessage(toPhoneE164, templateName, languageCode, components = []) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken  = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error(
      'WhatsApp config missing. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN ' +
      'in functions/.env (or Cloud Secret Manager).'
    );
  }

  // Sanitise recipient: E.164 without leading '+' for Meta API
  const to = toPhoneE164.replace(/^\+/, '');

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components.length > 0 && { components }),
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const json = await response.json();

  if (!response.ok) {
    const errDetail = json?.error?.message || JSON.stringify(json);
    throw new Error(`Meta API error ${response.status}: ${errDetail}`);
  }

  return json;
}

module.exports = { sendTemplateMessage };
