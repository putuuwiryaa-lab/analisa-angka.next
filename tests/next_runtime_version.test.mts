import assert from "node:assert/strict";

Deno.test("runtime Deno memakai versi Next.js yang sama dengan package.json", async () => {
  const packageJson = JSON.parse(await Deno.readTextFile(
    new URL("../package.json", import.meta.url),
  ));
  const denoJson = JSON.parse(await Deno.readTextFile(
    new URL("../deno.json", import.meta.url),
  ));
  const nextVersion = packageJson.dependencies?.next;

  assert.equal(typeof nextVersion, "string");
  assert.equal(packageJson.overrides?.next, nextVersion);
  assert.equal(packageJson.devDependencies?.["eslint-config-next"], nextVersion);

  for (const taskName of ["dev", "build", "start"]) {
    assert.match(
      denoJson.tasks?.[taskName] ?? "",
      new RegExp(`npm:next@${nextVersion.replaceAll(".", "\\.")}(?:\\s|$)`),
      `deno task ${taskName} harus memakai Next.js ${nextVersion}`,
    );
  }
});
