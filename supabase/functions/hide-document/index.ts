// Retired: hiding documents now goes through the staff-api function, which checks each person's own account password.
Deno.serve(() => new Response(JSON.stringify({ error: 'This function is retired. Use the staff tools on the website.' }), { status: 410, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }));
