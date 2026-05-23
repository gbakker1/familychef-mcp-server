#!/usr/bin/env node
// @copantry/mcp-server — stdio bridge to the Copantry API
// Runs as a local stdio process; forwards all tool calls to the hosted HTTP MCP endpoint.
//
// Usage (Claude Desktop / Cursor / Windsurf):
//   Set COPANTRY_API_KEY and optionally COPANTRY_API_URL in env.
//
// Claude Desktop config (~/.config/claude/claude_desktop_config.json):
//   {
//     "mcpServers": {
//       "copantry": {
//         "command": "npx",
//         "args": ["-y", "@copantry/mcp-server"],
//         "env": { "COPANTRY_API_KEY": "fc_live_..." }
//       }
//     }
//   }

'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const API_KEY = process.env.COPANTRY_API_KEY;
const API_URL = (process.env.COPANTRY_API_URL || 'https://api.copantry.com').replace(/\/$/, '');

if (!API_KEY) {
    process.stderr.write('[copantry-mcp] COPANTRY_API_KEY is required.\n');
    process.exit(1);
}

// ── HTTP helper ────────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `API error ${res.status}`);
    return body;
}

function ok(text) {
    return { content: [{ type: 'text', text }] };
}

function json(data) {
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function err(msg) {
    return { isError: true, content: [{ type: 'text', text: msg }] };
}

// ── Server ─────────────────────────────────────────────────────────────────────

const server = new McpServer({ name: 'Copantry', version: '1.0.0' });

// ── RECIPES ───────────────────────────────────────────────────────────────────

server.tool(
    'search_recipes',
    'Search your household recipe collection by title or category.',
    {
        search:   z.string().optional().describe('Title search term'),
        category: z.enum(['APPETISER','STARTER','MAIN','DESSERT','COCKTAIL','CAKE','SIDE','BREAKFAST','SOUP','SNACK']).optional(),
        limit:    z.number().int().min(1).max(50).default(20).optional(),
    },
    async ({ search, category, limit = 20 }) => {
        const q = new URLSearchParams();
        if (search)   q.set('search', search);
        if (category) q.set('category', category);
        q.set('limit', String(limit));
        try {
            const data = await apiFetch(`/recipes?${q}`);
            return json(data);
        } catch (e) { return err(e.message); }
    }
);

server.tool(
    'get_recipe',
    'Get full details of a recipe including ingredients and cooking notes.',
    { id: z.string().describe('Recipe UUID') },
    async ({ id }) => {
        try {
            return json(await apiFetch(`/recipes/${id}`));
        } catch (e) { return err(e.message); }
    }
);

server.tool(
    'import_recipe_from_url',
    'Queue a URL for AI-powered recipe import. The recipe will appear in the collection within a minute.',
    { url: z.string().url().describe('Public URL of the recipe page') },
    async ({ url }) => {
        try {
            await apiFetch('/recipes/import', { method: 'POST', body: JSON.stringify({ url }) });
            return ok(`Recipe import queued for ${url}. It will appear in your collection shortly.`);
        } catch (e) { return err(e.message); }
    }
);

// ── PANTRY ────────────────────────────────────────────────────────────────────

server.tool(
    'list_pantry',
    'List all pantry items, optionally filtering for items that have already expired.',
    { expiredOnly: z.boolean().optional().describe('When true, return only expired items') },
    async ({ expiredOnly }) => {
        try {
            const q = expiredOnly ? '?expiredOnly=true' : '';
            return json(await apiFetch(`/pantry${q}`));
        } catch (e) { return err(e.message); }
    }
);

server.tool(
    'add_pantry_item',
    'Add an ingredient to the household pantry.',
    {
        name:       z.string().describe('Ingredient name'),
        quantity:   z.number().optional(),
        unit:       z.string().optional().describe('e.g. g, kg, ml, tbsp, pieces'),
        expiryDate: z.string().optional().describe('ISO date YYYY-MM-DD'),
    },
    async (args) => {
        try {
            const item = await apiFetch('/pantry', { method: 'POST', body: JSON.stringify(args) });
            return ok(`Added ${args.quantity ?? ''} ${args.unit ?? ''} ${args.name} to pantry (id: ${item.id}).`);
        } catch (e) { return err(e.message); }
    }
);

server.tool(
    'delete_pantry_item',
    'Remove an item from the pantry.',
    { id: z.string().describe('Pantry item UUID') },
    async ({ id }) => {
        try {
            await apiFetch(`/pantry/${id}`, { method: 'DELETE' });
            return ok(`Pantry item ${id} removed.`);
        } catch (e) { return err(e.message); }
    }
);

// ── MEAL PLANNING / CALENDAR ──────────────────────────────────────────────────

server.tool(
    'get_meal_plan',
    'Retrieve the household meal calendar for a date range.',
    {
        startDate: z.string().optional().describe('ISO date YYYY-MM-DD (defaults to today)'),
        endDate:   z.string().optional().describe('ISO date YYYY-MM-DD (defaults to 7 days from now)'),
    },
    async ({ startDate, endDate }) => {
        try {
            const q = new URLSearchParams();
            if (startDate) q.set('startDate', startDate);
            if (endDate)   q.set('endDate', endDate);
            return json(await apiFetch(`/calendar?${q}`));
        } catch (e) { return err(e.message); }
    }
);

server.tool(
    'add_meal_to_plan',
    'Schedule a recipe on the household meal calendar.',
    {
        recipeId: z.string().describe('Recipe UUID'),
        date:     z.string().describe('ISO date YYYY-MM-DD'),
        mealType: z.enum(['LUNCH', 'DINNER']),
    },
    async (args) => {
        try {
            const entry = await apiFetch('/calendar', { method: 'POST', body: JSON.stringify(args) });
            return ok(`Scheduled recipe on ${args.date} for ${args.mealType} (calendar entry id: ${entry.id}).`);
        } catch (e) { return err(e.message); }
    }
);

server.tool(
    'confirm_meal',
    'Mark a calendar entry as cooked and deduct used ingredients from the pantry.',
    { calendarId: z.string().describe('MealCalendar entry UUID') },
    async ({ calendarId }) => {
        try {
            await apiFetch(`/calendar/${calendarId}/confirm`, { method: 'PATCH' });
            return ok(`Meal ${calendarId} confirmed and pantry updated.`);
        } catch (e) { return err(e.message); }
    }
);

// ── SHOPPING LISTS ────────────────────────────────────────────────────────────

server.tool(
    'get_shopping_lists',
    'List all household shopping lists with their items.',
    {},
    async () => {
        try {
            return json(await apiFetch('/shopping-list'));
        } catch (e) { return err(e.message); }
    }
);

server.tool(
    'generate_shopping_list',
    'Generate a shopping list from meals planned for a date range, minus what is already in the pantry.',
    {
        startDate: z.string().describe('ISO date YYYY-MM-DD'),
        endDate:   z.string().describe('ISO date YYYY-MM-DD'),
        name:      z.string().optional().describe('Name for the new list (defaults to date range)'),
    },
    async (args) => {
        try {
            const list = await apiFetch('/shopping-list/generate', { method: 'POST', body: JSON.stringify(args) });
            return ok(`Generated shopping list "${list.name}" with ${list.items?.length ?? 0} items (id: ${list.id}).`);
        } catch (e) { return err(e.message); }
    }
);

// ── BILLING ───────────────────────────────────────────────────────────────────

server.tool(
    'get_plan',
    'Check the current Copantry subscription plan and remaining API call quota for this month.',
    {},
    async () => {
        try {
            return json(await apiFetch('/billing/plan'));
        } catch (e) { return err(e.message); }
    }
);

// ── PROMPTS ───────────────────────────────────────────────────────────────────

server.prompt(
    'plan_waste_free_week',
    {},
    () => ({
        messages: [{
            role: 'user',
            content: {
                type: 'text',
                text: 'Review my current pantry (use list_pantry, paying attention to items expiring soonest) and my recipe collection (use search_recipes). Suggest a 7-day meal plan that prioritises using up expiring ingredients and minimises food waste. Once I approve the plan, add the meals to the calendar using add_meal_to_plan.',
            },
        }],
    })
);

server.prompt(
    'generate_weekly_shopping_list',
    { startDate: z.string().describe('Monday of the week, YYYY-MM-DD') },
    ({ startDate }) => {
        const end = new Date(startDate);
        end.setDate(end.getDate() + 6);
        const endDate = end.toISOString().slice(0, 10);
        return {
            messages: [{
                role: 'user',
                content: {
                    type: 'text',
                    text: `Get the meal plan for the week of ${startDate} to ${endDate} using get_meal_plan. Then check the pantry with list_pantry to see what we already have. Finally, generate a shopping list for the missing ingredients using generate_shopping_list.`,
                },
            }],
        };
    }
);

// ── Transport ──────────────────────────────────────────────────────────────────

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write('[copantry-mcp] Connected via stdio.\n');
}

main().catch(e => {
    process.stderr.write(`[copantry-mcp] Fatal: ${e.message}\n`);
    process.exit(1);
});
