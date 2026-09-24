// Cookie consent and chat widgets that add off-brand colors (FR-09).
// Each entry matches a whole id or class token, exactly or as a prefix.
// Never substring match: a bakery's "cookie-menu" must stay visible.
export const OVERLAY_DENYLIST = {
  exact: [
    "CybotCookiebotDialog",
    "usercentrics-root",
    "hubspot-messages-iframe-container",
    "chat-widget-container",
    "olark",
    "olark-box-container",
    "crisp-client",
    "cookie-banner",
    "cookie-consent",
    "cookie-notice",
  ],
  prefix: [
    "onetrust-",
    "ot-sdk-",
    "optanon",
    "CybotCookiebot",
    "truste-",
    "truste_",
    "qc-cmp2-",
    "didomi-",
    "osano-cm-",
    "cky-",
    "termly-",
    "iubenda-cs-",
    "intercom-",
    "drift-",
    "tawk-",
    "livechat-",
  ],
};
