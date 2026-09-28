#!/usr/bin/env python3
"""Read-only New Relic smoke test for the deployed observability account."""

import json
import os
import sys
from urllib.request import Request, urlopen

api_key = os.environ.get("NEW_RELIC_API_KEY")
account_id = os.environ.get("NEW_RELIC_ACCOUNT_ID")
region = os.environ.get("NEW_RELIC_REGION", "US")
environment = os.environ.get("OBS_ENVIRONMENT", "prod")

if not api_key or not account_id:
    raise SystemExit("NEW_RELIC_API_KEY and NEW_RELIC_ACCOUNT_ID are required")

endpoint = "https://api.eu.newrelic.com/graphql" if region == "EU" else "https://api.newrelic.com/graphql"
dashboard_names = [
    f"Topos {environment} observability",
    f"Topos {environment} - Content API",
    f"Topos {environment} - Workers & Kafka",
    f"Topos {environment} - AI Service",
    f"Topos {environment} - User Service",
    f"Topos {environment} - Gateway",
]

query = """
query ($accountId: Int!, $nrql: Nrql!, $entitySearch: String!) {
  actor {
    account(id: $accountId) {
      nrql(query: $nrql) { results }
    }
    entitySearch(query: $entitySearch) {
      results { entities { name } }
    }
  }
}
"""
payload = json.dumps(
    {
        "query": query,
        "variables": {
            "accountId": int(account_id),
            "nrql": "SELECT count(*) FROM Span SINCE 5 minutes ago",
            "entitySearch": "name LIKE 'Topos '",
        },
    }
).encode()
request = Request(
    endpoint,
    data=payload,
    headers={"API-Key": api_key, "Content-Type": "application/json"},
    method="POST",
)

with urlopen(request, timeout=30) as response:  # noqa: S310 - configured New Relic endpoint only
    body = json.load(response)

if body.get("errors"):
    raise SystemExit(f"New Relic query failed: {body['errors']}")

entities = body["data"]["actor"]["entitySearch"]["results"]["entities"]
found = {entity["name"] for entity in entities}
missing = [name for name in dashboard_names if name not in found]
if missing:
    raise SystemExit(f"New Relic dashboards not found: {missing}")

print(f"New Relic API and {len(dashboard_names)} deployed dashboards verified.")
