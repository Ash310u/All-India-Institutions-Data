# Indian Colleges Institutions API

HTTP API for AICTE-approved college/institution data across Indian states. Data is served from files under `dataset/` by default; some routes can optionally fetch live from the AICTE upstream.

**Live API:** [https://all-india-institutions-data.vercel.app](https://all-india-institutions-data.vercel.app)

**Local dev:** `http://localhost:4001`

## Quick start

```bash
npm install
npm run dev
```

## Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | API index with route list |
| `GET` | `/api/institutions` | All institutions (offline or online) |
| `GET` | `/api/institutions/states` | List of supported states |
| `GET` | `/api/institutions/states/:state` | Institutions for one state |
| `GET` | `/api/institutions/states/:state/:aicteid` | Single institution by ID |
| `GET` | `/api/institutions/search` | Search institutions |

---

### `GET /`

Returns the API name and available routes.

```json
{
  "name": "Indian Colleges Institutions API",
  "routes": [
    "GET /api/institutions",
    "GET /api/institutions/states",
    "GET /api/institutions/states/:state",
    "GET /api/institutions/states/:state/:aicteid",
    "GET /api/institutions/search"
  ]
}
```

---

### `GET /api/institutions/states`

Returns all supported states with URL-friendly slugs.

```json
{
  "states": [
    { "name": "West Bengal", "slug": "west-bengal" },
    { "name": "Tamil Nadu", "slug": "tamil-nadu" }
  ]
}
```

---

### `GET /api/institutions/states/:state`

Returns all institutions for a state. `:state` accepts a slug (`west-bengal`) or similar name form.

**Success (200)**

```json
{
  "source": "local",
  "state": "west-bengal",
  "data": [ /* institution objects */ ]
}
```

**Not found (404)**

```json
{
  "error": "not_found",
  "state": "unknown-state",
  "detail": "State dataset not found"
}
```

---

### `GET /api/institutions/states/:state/:aicteid`

Returns one institution with full programme details.

**Success (200)**

```json
{
  "source": "local",
  "id": "1-44643061326",
  "name": "TECHNO INTERNATIONAL NEW TOWN",
  "university": "Maulana Abul Kalam Azad University of Technology, West Bengal",
  "state": "West Bengal",
  "district": "KOLKATA",
  "address": "MEGA CITY,NEW TOWN, KOLKATA",
  "programmes": [
    {
      "programme": "ENGINEERING AND TECHNOLOGY",
      "level": "UNDER GRADUATE",
      "course": "COMPUTER SCIENCE AND ENGINEERING",
      "course_type": "Course Institute-1",
      "shift": "1st Shift",
      "availability": "FULL TIME",
      "intake": "300",
      "enrollment": "",
      "placement": ""
    }
  ]
}
```

**Not found (404)**

```json
{ "error": "Not found" }
```

---

### `GET /api/institutions`

Returns all institutions from local files by default.

**Query parameters**

| Param | Description |
|-------|-------------|
| `online=1` | Fetch from AICTE upstream instead of local files |
| `allStates=1` | With `online=1`, fetch every state and merge results |
| `fields`, `keys`, `columns` | Comma-separated field names when transforming row arrays |

**Offline response (200)**

```json
{
  "source": "offline",
  "meta": {
    "last_grabbed": "2025-10-30T10:17:21.273Z",
    "records": 39268
  },
  "data": [ /* institution objects */ ]
}
```

`meta` is included when `dataset/metadata.json` exists.

**Online response (200 / 502)**

Proxies the AICTE API. Row arrays are converted to objects using default fields:

`aicte_id`, `institute_name`, `address`, `district`, `institution_type`, `women`, `minority`, `other_id`

With `allStates=1`, response shape is:

```json
{
  "source": "online",
  "data": {
    "combined": [ /* institutions from all states */ ],
    "failures": [ { "state": "...", "error": "..." } ]
  }
}
```

---

### `GET /api/institutions/search`

Search and filter institutions across the local dataset.

**Query parameters**

| Param | Default | Description |
|-------|---------|-------------|
| `q` | — | Free-text query (min 2 chars, or min 3 with `state` only) |
| `state` | — | Limit to a state (slug or name) |
| `district` | — | Substring match on district |
| `city` | — | Substring match on city |
| `address` | — | Substring match on address |
| `mode` | `fuzzy` | `fuzzy` or `exact` |
| `threshold` | `0.4` | Fuzzy match sensitivity (0–1; lower = stricter) |
| `fields` | see below | Comma-separated fields used for fuzzy `q` matching |
| `page` | `1` | Page number |
| `limit` | `25` | Results per page (max 200) |

At least one of `q`, `district`, `city`, `address`, or `state` is required.

**Search behavior**

- **Fuzzy mode (`mode=fuzzy`, default):** Uses Fuse.js over name, university, district, city, address, and programme names. Location filters (`state`, `district`, `city`, `address`) are applied first; then `q` is fuzzy-matched. Each result includes a relevance `score` (0–1, higher is better).
- **Exact mode (`mode=exact`):** Case-insensitive substring matching on the same text fields.
- **Scope:** If `state` is provided, searches that state's file first; otherwise searches all institutions.
- **Default fuzzy fields:** `name`, `university`, `district`, `city`, `address`, `programmes`

**Success (200)**

```json
{
  "total": 12,
  "page": 1,
  "limit": 25,
  "mode": "fuzzy",
  "filters": {
    "q": "techno international",
    "state": "west-bengal",
    "district": "kolkata",
    "city": null,
    "address": null
  },
  "results": [
    {
      "id": "1-44643061326",
      "name": "TECHNO INTERNATIONAL NEW TOWN",
      "university": "Maulana Abul Kalam Azad University of Technology, West Bengal",
      "state": "West Bengal",
      "district": "KOLKATA",
      "city": "KOLKATA",
      "address": "MEGA CITY,NEW TOWN, KOLKATA",
      "score": 0.9124,
      "programmes_count": 8
    }
  ]
}
```

**Validation error (400)**

```json
{
  "error": "Provide at least one search parameter: q (min 2 chars), district, city, address, or state"
}
```

---

## Institution object (local dataset)

Each institution in `data` arrays generally looks like:

```json
{
  "aicte_id": "1-44643061326",
  "institute_name": "TECHNO INTERNATIONAL NEW TOWN",
  "address": "MEGA CITY,NEW TOWN, KOLKATA",
  "district": "KOLKATA",
  "institution_type": "Private-Self Financing",
  "women": "N",
  "minority": "N",
  "other_id": "1-6635691",
  "state": "West Bengal",
  "university": "Maulana Abul Kalam Azad University of Technology, West Bengal",
  "programmes": [ /* programme objects */ ]
}
```

## Example requests

Replace `$BASE` with `https://all-india-institutions-data.vercel.app` (live) or `http://localhost:4001` (local).

```bash
# List states
curl $BASE/api/institutions/states

# Institutions in Karnataka
curl $BASE/api/institutions/states/karnataka

# Single institution
curl $BASE/api/institutions/states/karnataka/1-44273184624

# Fuzzy search
curl "$BASE/api/institutions/search?q=engineering&state=karnataka&limit=10"

# Exact search by district
curl "$BASE/api/institutions/search?district=bangalore&mode=exact"
```
