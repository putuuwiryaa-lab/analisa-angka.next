const PRIMARY_ORIGIN = "https://www.analisa-angka.site";

Deno.serve((request) => {
  const source = new URL(request.url);
  const target = new URL(`${source.pathname}${source.search}`, PRIMARY_ORIGIN);

  return Response.redirect(target, 301);
});
