var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/agent-action.js
async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json();
    const s = /* @__PURE__ */ __name((v, n = 200) => v == null ? "" : v.toString().slice(0, n), "s");
    const action = s(b.action || "lead", 40);
    const rec = {
      action,
      name: s(b.name, 120),
      contact: s(b.contact || b.phone || b.email, 160),
      when: s(b.when || b.datetime, 120),
      details: s(b.details || b.need || b.message, 500),
      business: s(b.business, 160),
      industry: s(b.industry, 80),
      amount: s(b.amount, 40),
      source: "gui-call",
      at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const SB_URL = env.GUI_ACTIONS_SUPABASE_URL || "https://fccwbafkbhkyrvauzshl.supabase.co";
    const SB_ANON = env.GUI_ACTIONS_SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjY3diYWZrYmhreXJ2YXV6c2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTU3NzQsImV4cCI6MjA5NDI5MTc3NH0.knDpHzK_cfpqmUzpLI4rTndAumn1yepCiRwCSAqwSNs";
    let stored = false;
    try {
      const r = await fetch(`${SB_URL}/rest/v1/gui_actions`, {
        method: "POST",
        headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ action: rec.action, name: rec.name, contact: rec.contact, slot: rec.when, details: rec.details, business: rec.business, industry: rec.industry, amount: rec.amount, source: rec.source })
      });
      stored = r.ok;
    } catch {
    }
    let delivered = false;
    if (env.LEAD_WEBHOOK) {
      try {
        const r = await fetch(env.LEAD_WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rec) });
        delivered = r.ok;
      } catch {
      }
    }
    const who = rec.name || "you";
    const amt = rec.amount ? `$${rec.amount}` : "";
    const msg = {
      book: `All set \u2014 booked for ${who}${rec.when ? ` on ${rec.when}` : ""}. You'll get a confirmation. Anything else?`,
      reschedule: `Done \u2014 moved ${who}'s booking${rec.when ? ` to ${rec.when}` : ""}.`,
      cancel: `Cancelled ${who}'s booking \u2014 no worries.`,
      order: `Order placed for ${who}${amt ? ` (${amt})` : ""} \u2014 I'll send a confirmation.`,
      sale: `Sale logged${amt ? ` for ${amt}` : ""} \u2014 thank you, ${who}!`,
      invoice: `I've sent ${who} a secure payment link${amt ? ` for ${amt}` : ""} \u2014 you can pay whenever you're ready.`,
      quote: `I've captured your quote request, ${who} \u2014 you'll have it shortly.`,
      lead: `Got it, ${who}. I've saved your details and the team will follow up.`,
      qualify: `Thanks, ${who} \u2014 noted what you need; we'll match you to the right option.`,
      callback: `Perfect \u2014 I've scheduled a callback for ${who}${rec.when ? ` ${rec.when}` : ""}.`,
      review: `Thanks! I've sent ${who} a review request.`,
      confirm: `Confirmation sent to ${who}.`,
      message: `Message noted \u2014 ${who} will hear from us shortly.`,
      winback: `Welcome back, ${who}! I've set up a special offer for you.`,
      noshow: `No problem \u2014 I've rebooked ${who}${rec.when ? ` for ${rec.when}` : ""} and freed your old slot.`,
      info: `Noted your question, ${who} \u2014 someone will get you the exact answer.`
    }[action] || `Done \u2014 ${action} captured for ${who}.`;
    return json({ ok: true, stored, delivered, message: msg, record: rec });
  } catch {
    return json({ ok: false, message: "Sorry, I couldn't save that just now \u2014 could you repeat it?" }, 400);
  }
}
__name(onRequestPost, "onRequestPost");
var json = /* @__PURE__ */ __name((obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } }), "json");

// api/call.js
var ELEVEN_AGENT_ID = "agent_5901ktdkev68f5kb161fmeax1rdm";
async function onRequestPost2(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const phone = (body.phone || "").toString().trim();
    if (!phone) return json2({ error: "Missing phone" }, 400);
    const vars = {
      name: (body.name || "").toString().slice(0, 120),
      business: (body.business || "").toString().slice(0, 160),
      industry: (body.industry || "").toString().slice(0, 80),
      need: (body.need || "").toString().slice(0, 300),
      lang: (body.lang || "auto").toString().slice(0, 8)
    };
    if (env.ELEVENLABS_API_KEY && env.ELEVENLABS_PHONE_NUMBER_ID) {
      const res = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
        method: "POST",
        headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: env.ELEVENLABS_AGENT_ID || ELEVEN_AGENT_ID,
          agent_phone_number_id: env.ELEVENLABS_PHONE_NUMBER_ID,
          to_number: phone,
          conversation_initiation_client_data: { dynamic_variables: vars }
        })
      });
      if (!res.ok) return json2({ error: "call provider error", detail: (await res.text()).slice(0, 200) }, 502);
      return json2({ ok: true, provider: "elevenlabs" });
    }
    if (env.VAPI_API_KEY && env.VAPI_ASSISTANT_ID && env.VAPI_PHONE_NUMBER_ID) {
      const res = await fetch("https://api.vapi.ai/call", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.VAPI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          assistantId: env.VAPI_ASSISTANT_ID,
          phoneNumberId: env.VAPI_PHONE_NUMBER_ID,
          customer: { number: phone, name: vars.name || void 0 },
          assistantOverrides: { variableValues: vars }
        })
      });
      if (!res.ok) return json2({ error: "call provider error" }, 502);
      return json2({ ok: true, provider: "vapi" });
    }
    return json2({ error: "Outbound calling not configured yet" }, 501);
  } catch {
    return json2({ error: "bad request" }, 400);
  }
}
__name(onRequestPost2, "onRequestPost");
var json2 = /* @__PURE__ */ __name((obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } }), "json");

// api/lead.js
async function onRequestPost3(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const lead = {
      name: (body.name || "").toString().slice(0, 120),
      email: (body.email || "").toString().slice(0, 160),
      phone: (body.phone || "").toString().slice(0, 40),
      business: (body.business || "").toString().slice(0, 160),
      message: (body.message || "").toString().slice(0, 800),
      source: (body.source || "website").toString().slice(0, 60),
      lang: (body.lang || "").toString().slice(0, 5),
      at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (!lead.email && !lead.phone) return json3({ error: "Need an email or phone" }, 400);
    let stored = false;
    if (env.LEAD_WEBHOOK) {
      try {
        const r = await fetch(env.LEAD_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(lead)
        });
        if (r.ok) stored = true;
      } catch {
      }
    }
    if (env.SUPABASE_URL && env.SUPABASE_KEY) {
      try {
        const r = await fetch(`${env.SUPABASE_URL}/rest/v1/leads`, {
          method: "POST",
          headers: {
            apikey: env.SUPABASE_KEY,
            Authorization: `Bearer ${env.SUPABASE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal"
          },
          body: JSON.stringify(lead)
        });
        if (r.ok) stored = true;
      } catch {
      }
    }
    return json3({ ok: true, stored });
  } catch {
    return json3({ error: "bad request" }, 400);
  }
}
__name(onRequestPost3, "onRequestPost");
var json3 = /* @__PURE__ */ __name((obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } }), "json");

// ../.wrangler/tmp/pages-LKJCrF/functionsRoutes-0.7320035209082317.mjs
var routes = [
  {
    routePath: "/api/agent-action",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/call",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/lead",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  }
];

// ../../../../opt/homebrew/lib/node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../opt/homebrew/lib/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
