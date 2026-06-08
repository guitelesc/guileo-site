import { onRequestPost as __api_agent_action_js_onRequestPost } from "/Users/guiteles/guileo-site/functions/api/agent-action.js"
import { onRequestPost as __api_call_js_onRequestPost } from "/Users/guiteles/guileo-site/functions/api/call.js"
import { onRequestPost as __api_lead_js_onRequestPost } from "/Users/guiteles/guileo-site/functions/api/lead.js"

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
      routePath: "/api/lead",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_lead_js_onRequestPost],
    },
  ]