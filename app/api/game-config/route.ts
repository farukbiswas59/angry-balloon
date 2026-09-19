export function GET() {
  return Response.json(
    { url: process.env.NEXT_PUBLIC_GAME_SERVER_URL || "" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
