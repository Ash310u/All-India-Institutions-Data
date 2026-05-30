import { Hono } from "hono";
import {
  instituteName,
  matchesId,
  readStateInstitutions,
} from "../lib/data.js";
import { corsHeaders } from "../lib/cors.js";

const institutionById = new Hono();

institutionById.get("/:state/:aicteid", async (c) => {
  const state = c.req.param("state");
  const aicteid = c.req.param("aicteid");
  const institutions = await readStateInstitutions(state);

  if (!institutions) {
    return c.json({ error: "Not found" }, 404, corsHeaders());
  }

  for (const inst of institutions) {
    if (!matchesId(inst, aicteid)) continue;

    const programmes = inst.programmes ?? [];
    const address = inst.address;

    return c.json(
      {
        source: "local",
        id: aicteid,
        name: instituteName(inst),
        university:
          (inst.university as string | undefined) ??
          (inst.affiliated_university as string | undefined) ??
          null,
        state: (inst.state as string | undefined) ?? state,
        district: (inst.district as string | undefined) ?? null,
        address: address ?? null,
        programmes,
      },
      200,
      corsHeaders()
    );
  }

  return c.json({ error: "Not found" }, 404, corsHeaders());
});

export default institutionById;
