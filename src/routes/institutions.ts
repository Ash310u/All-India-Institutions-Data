import { Hono } from "hono";
import {
  DEFAULT_ROW_FIELDS,
  DEFAULT_UPSTREAM_PARAMS,
  STATES,
  TARGET_BASE,
} from "../constants.js";
import { corsHeaders } from "../lib/cors.js";
import {
  loadAllInstitutions,
  readAllInstitutionsFile,
  readMetadata,
  transformRowsToObjects,
} from "../lib/data.js";

const institutions = new Hono();

institutions.get("/", async (c) => {
  try {
    const incoming = Object.fromEntries(
      new URL(c.req.url).searchParams.entries()
    ) as Record<string, string>;

    const onlineFlag =
      incoming.online === "1" ||
      incoming.online === "true" ||
      incoming.online === "yes";

    let payload: unknown;
    let status = 200;

    if (!onlineFlag) {
      const fromFile = await readAllInstitutionsFile();
      if (fromFile?.length) {
        payload = fromFile;
      } else {
        payload = await loadAllInstitutions();
      }
    } else {
      const merged = { ...DEFAULT_UPSTREAM_PARAMS, ...incoming };
      const allStatesFlag =
        incoming.allStates === "1" ||
        incoming.allStates === "true" ||
        incoming.allStates === "yes" ||
        String(incoming.states || "").toLowerCase() === "all";

      if (allStatesFlag) {
        const combined: Array<Record<string, unknown>> = [];
        const failures: Array<{ state: string; error: string }> = [];

        for (const state of STATES) {
          const perParams = { ...merged, state } as Record<string, string>;
          delete perParams.allStates;
          perParams.state = state;

          const params = new URLSearchParams(perParams);
          const targetUrl = `${TARGET_BASE}?${params.toString()}`;

          try {
            const res = await fetch(targetUrl, {
              headers: {
                accept: "application/json, text/javascript, */*; q=0.01",
                "x-requested-with": "XMLHttpRequest",
              },
              cache: "no-store",
            });

            const text = await res.text();
            let parsed: unknown;

            try {
              parsed = JSON.parse(text);
            } catch {
              failures.push({
                state,
                error: `non-json response (${text.slice(0, 200)})`,
              });
              continue;
            }

            const transformed = transformRowsToObjects(
              parsed,
              [...DEFAULT_ROW_FIELDS]
            );

            if (Array.isArray(transformed)) {
              combined.push(...(transformed as Array<Record<string, unknown>>));
            } else if (transformed && typeof transformed === "object") {
              combined.push(transformed as Record<string, unknown>);
            }
          } catch (error) {
            failures.push({ state, error: String(error) });
          }
        }

        payload = { combined, failures };
      } else {
        const params = new URLSearchParams(merged);
        const targetUrl = `${TARGET_BASE}?${params.toString()}`;

        const res = await fetch(targetUrl, {
          headers: {
            accept: "application/json, text/javascript, */*; q=0.01",
            "x-requested-with": "XMLHttpRequest",
          },
          cache: "force-cache",
        });

        const text = await res.text();

        try {
          payload = JSON.parse(text);
        } catch {
          payload = { raw: text };
        }

        status = res.ok ? 200 : 502;
      }
    }

    const fieldsParam = incoming.fields ?? incoming.keys ?? incoming.columns;
    const fields = fieldsParam
      ? String(fieldsParam)
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : undefined;

    payload = transformRowsToObjects(payload, fields);

    const source = onlineFlag ? "online" : "offline";
    const meta = await readMetadata();
    const responseBody = meta
      ? { source, meta, data: payload }
      : { source, data: payload };

    return c.json(responseBody, status as 200 | 502, {
      ...corsHeaders(),
      "X-Data-Source": source,
    });
  } catch (error) {
    return c.json({ error: String(error) }, 500, corsHeaders());
  }
});

export default institutions;
