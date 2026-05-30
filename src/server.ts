import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { corsHeaders } from "./lib/cors.js";
import institutions from "./routes/institutions.js";
import states from "./routes/states.js";
import stateBySlug from "./routes/state-by-slug.js";
import institutionById from "./routes/institution-by-id.js";
import search from "./routes/search.js";

const app = new Hono();

app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return c.body(null, 204, corsHeaders());
  }
  await next();
});

app.get("/", (c) =>
  c.json({
    name: "Indian Colleges Institutions API",
    routes: [
      "GET /api/institutions",
      "GET /api/institutions/states",
      "GET /api/institutions/states/:state",
      "GET /api/institutions/states/:state/:aicteid",
      "GET /api/institutions/search",
    ],
  })
);

const statesApp = new Hono();
statesApp.route("/", states);
statesApp.route("/", stateBySlug);
statesApp.route("/", institutionById);

app.route("/api/institutions/search", search);
app.route("/api/institutions/states", statesApp);
app.route("/api/institutions", institutions);

const port = Number(process.env.PORT) || 4001;

serve({ fetch: app.fetch, port }, () => {
  console.log(`Institutions API listening on http://localhost:${port}`);
});

export default app;
