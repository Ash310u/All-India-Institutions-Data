import { Hono } from "hono";
import { corsHeaders } from "../lib/cors.js";
import { readStateInstitutions } from "../lib/data.js";

const stateBySlug = new Hono();

stateBySlug.get("/:state", async (c) => {
  const state = c.req.param("state");
  const parsed = await readStateInstitutions(state);

  if (!parsed) {
    return c.json(
      { error: "not_found", state, detail: "State dataset not found" },
      404,
      corsHeaders()
    );
  }

  return c.json({ source: "local", state, data: parsed }, 200, corsHeaders());
});

export default stateBySlug;
