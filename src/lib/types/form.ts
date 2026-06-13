export type ActionResult =
	| { success: true; message?: never; field?: never; id?: never }
	| { message: string; success?: never; field?: string; id?: number | string }
	| null;
