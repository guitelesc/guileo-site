import { onRequestPost as __api_agent_action_js_onRequestPost } from "/Users/guiteles/guileo-site/functions/api/agent-action.js"
import { onRequestPost as __api_call_js_onRequestPost } from "/Users/guiteles/guileo-site/functions/api/call.js"
import { onRequestOptions as __api_email_js_onRequestOptions } from "/Users/guiteles/guileo-site/functions/api/email.js"
import { onRequestPost as __api_email_js_onRequestPost } from "/Users/guiteles/guileo-site/functions/api/email.js"
import { onRequestPost as __api_lead_js_onRequestPost } from "/Users/guiteles/guileo-site/functions/api/lead.js"
import { onRequestOptions as __api_nurture_js_onRequestOptions } from "/Users/guiteles/guileo-site/functions/api/nurture.js"
import { onRequestPost as __api_nurture_js_onRequestPost } from "/Users/guiteles/guileo-site/functions/api/nurture.js"
import { onRequestOptions as __api_welcome_js_onRequestOptions } from "/Users/guiteles/guileo-site/functions/api/welcome.js"
import { onRequestPost as __api_welcome_js_onRequestPost } from "/Users/guiteles/guileo-site/functions/api/welcome.js"
import { onRequest as __api_daily_digest_js_onRequest } from "/Users/guiteles/guileo-site/functions/api/daily-digest.js"

export const routes = [
    {
      routePath: "/api/agent-action",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_agent_action_js_onRequestPost],
    },
  {
      routePath: "/api/call",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_call_js_onRequestPost],
    },
  {
      routePath: "/api/email",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_email_js_onRequestOptions],
    },
  {
      routePath: "/api/email",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_email_js_onRequestPost],
    },
  {
      routePath: "/api/lead",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_lead_js_onRequestPost],
    },
  {
      routePath: "/api/nurture",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_nurture_js_onRequestOptions],
    },
  {
      routePath: "/api/nurture",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_nurture_js_onRequestPost],
    },
  {
      routePath: "/api/welcome",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_welcome_js_onRequestOptions],
    },
  {
      routePath: "/api/welcome",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_welcome_js_onRequestPost],
    },
  {
      routePath: "/api/daily-digest",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_daily_digest_js_onRequest],
    },
  ]