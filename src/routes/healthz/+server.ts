/** Liveness only: the app must stay healthy even when an upstream search engine is unavailable. */
export function GET() {
	return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
}
