import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { config } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

function requireAdmin(locals: App.Locals) {
	if (!locals.user) {
		error(401, 'Authentication required');
	}
	if (locals.user!.role !== 'admin') {
		error(403, 'Admin access required');
	}
}

const HOMEPAGE_DOC_KEY = 'homepage_document_id';

// GET: Retrieve the configured homepage document ID
export const GET: RequestHandler = async ({ locals }) => {
	requireAdmin(locals);
	try {
		const result = await db
			.select()
			.from(config)
			.where(eq(config.key, HOMEPAGE_DOC_KEY))
			.limit(1);

		if (result.length === 0) {
			return json({ value: null });
		}

		return json({ value: result[0].value });
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};

// POST: Save or update the homepage document ID
export const POST: RequestHandler = async ({ request, locals }) => {
	requireAdmin(locals);
	try {
		const body = await request.json();
		const { value } = body;

		// Upsert the configuration value in SQLite
		await db
			.insert(config)
			.values({
				key: HOMEPAGE_DOC_KEY,
				value: value || ''
			})
			.onConflictDoUpdate({
				target: config.key,
				set: { value: value || '' }
			});

		return json({ success: true, key: HOMEPAGE_DOC_KEY, value });
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};
