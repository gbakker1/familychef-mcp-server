# @familychef/mcp-server

Connect Claude, Cursor, Windsurf, or any MCP-compatible AI to your [FamilyChef](https://app.familychef.com) household — search recipes, manage the pantry, plan meals, and generate shopping lists by talking to your AI.

## Quick start

### 1. Get your API key

Go to **FamilyChef → AI Agent** (the robot icon in the sidebar), create an API key, and copy it.

### 2. Add to Claude Desktop

Edit `~/.config/claude/claude_desktop_config.json` (macOS/Linux) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "familychef": {
      "command": "npx",
      "args": ["-y", "@familychef/mcp-server"],
      "env": {
        "FAMILYCHEF_API_KEY": "fc_live_your_key_here"
      }
    }
  }
}
```

Restart Claude Desktop — FamilyChef tools appear automatically.

### Cursor / Windsurf

Add to `.cursor/mcp.json` or `.windsurf/mcp.json`:

```json
{
  "mcp": {
    "servers": {
      "familychef": {
        "command": "npx",
        "args": ["-y", "@familychef/mcp-server"],
        "env": {
          "FAMILYCHEF_API_KEY": "fc_live_your_key_here"
        }
      }
    }
  }
}
```

### Any HTTP-capable MCP client

If your client supports HTTP transport, you can point it directly to the hosted endpoint — no npm install needed:

```
URL:     https://app.familychef.com/familychef/api/mcp
Method:  POST
Header:  Authorization: Bearer fc_live_your_key_here
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `FAMILYCHEF_API_KEY` | Yes | Your API key from the AI Agent page |
| `FAMILYCHEF_API_URL` | No | Override the API base URL (default: `https://app.familychef.com/familychef/api`) |

## Available tools

| Tool | What it does |
|---|---|
| `search_recipes` | Search your recipe collection by title or category |
| `get_recipe` | Get full details of a recipe |
| `import_recipe_from_url` | Queue a URL for AI-powered recipe import |
| `list_pantry` | List pantry items (optionally filter expired) |
| `add_pantry_item` | Add an ingredient to the pantry |
| `delete_pantry_item` | Remove a pantry item |
| `get_meal_plan` | Get the meal calendar for a date range |
| `add_meal_to_plan` | Schedule a recipe on the calendar |
| `confirm_meal` | Mark a meal as cooked and deduct pantry ingredients |
| `get_shopping_lists` | List all shopping lists |
| `generate_shopping_list` | Generate a list from planned meals minus pantry stock |
| `get_plan` | Check your subscription plan and monthly API quota |

## Starter prompts

> "Review my pantry and suggest a week of meals that use up what's expiring soonest."

> "Plan dinner for tomorrow using chicken and whatever vegetables I have in the pantry."

> "Generate a shopping list for next week's planned meals."

## Plans & pricing

| Plan | Price | API calls/month |
|---|---|---|
| Hobbyist | Free | 300 |
| Home | $4.99/mo | 3,000 |
| Family | $9.99/mo | 10,000 |
| Builder | $29/mo | 60,000 |

Upgrade at [familychef.app/agent](https://app.familychef.com/familychef/agent).

## License

MIT
