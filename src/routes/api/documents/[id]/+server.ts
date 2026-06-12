import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { document } from '$lib/server/db/schema.js';
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

// GET: Fetch a single document by ID
export const GET: RequestHandler = async ({ params, locals }) => {
	requireAdmin(locals);
	const { id } = params;
	if (!id) return json({ error: 'ID is required' }, { status: 400 });

	try {
		const doc = await db.select().from(document).where(eq(document.id, id)).limit(1);

		if (doc.length === 0) {
			return json({ error: 'Document not found' }, { status: 404 });
		}

		return json(doc[0]);
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};

// PUT: Update an existing document
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	requireAdmin(locals);
	const { id } = params;
	if (!id) return json({ error: 'ID is required' }, { status: 400 });

	try {
		const body = await request.json();
		const { title, content } = body;

		if (!title) {
			return json({ error: 'Title is required' }, { status: 400 });
		}

		const updatedDoc = await db
			.update(document)
			.set({
				title,
				content: content || '',
				updatedAt: new Date()
			})
			.where(eq(document.id, id))
			.returning();

		if (updatedDoc.length === 0) {
			return json({ error: 'Document not found' }, { status: 404 });
		}

		return json(updatedDoc[0]);
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};

// DELETE: Delete a document by ID
export const DELETE: RequestHandler = async ({ params, locals }) => {
	requireAdmin(locals);
	const { id } = params;
	if (!id) return json({ error: 'ID is required' }, { status: 400 });

	try {
		const deletedDoc = await db.delete(document).where(eq(document.id, id)).returning();

		if (deletedDoc.length === 0) {
			return json({ error: 'Document not found' }, { status: 404 });
		}

		return json({ success: true, message: 'Document deleted successfully' });
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};
