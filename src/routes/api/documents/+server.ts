import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { document } from '$lib/server/db/schema.js';
import { desc } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

function requireAdmin(locals: App.Locals) {
	if (!locals.user) {
		error(401, 'Authentication required');
	}
	if (locals.user!.role !== 'admin') {
		error(403, 'Admin access required');
	}
}

// GET: Retrieve all documents, ordered by updatedAt descending
export const GET: RequestHandler = async ({ locals }) => {
	requireAdmin(locals);
	try {
		const docs = await db.select().from(document).orderBy(desc(document.updatedAt));
		return json(docs);
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};

// POST: Create a new document
export const POST: RequestHandler = async ({ request, locals }) => {
	requireAdmin(locals);
	try {
		const body = await request.json();
		const { title, content } = body;

		if (!title) {
			return json({ error: 'Title is required' }, { status: 400 });
		}

		const newDoc = await db
			.insert(document)
			.values({
				title,
				content: content || '',
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.returning();

		return json(newDoc[0], { status: 201 });
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};
