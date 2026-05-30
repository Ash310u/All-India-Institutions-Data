import { Hono } from "hono";
import { STATES } from "../constants.js";
import { corsHeaders } from "../lib/cors.js";
import { slugify } from "../lib/slug.js";

const states = new Hono();

states.get("/", (c) => {
  const list = STATES.map((name) => ({ name, slug: slugify(name) }));
  return c.json({ states: list }, 200, corsHeaders());
});

export default states;
