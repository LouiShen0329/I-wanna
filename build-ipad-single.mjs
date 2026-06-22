import { readFile, writeFile } from "node:fs/promises";

const html = await readFile("index.html", "utf8");
const css = await readFile("styles.css", "utf8");
const js = await readFile("game.js", "utf8");

const bundled = html
  .replace(
    /<link rel="stylesheet" href="\.\/styles\.css" \/>/,
    `<style>\n${css}\n</style>`,
  )
  .replace(
    /<script src="\.\/game\.js"><\/script>/,
    `<script>\n${js}\n</script>`,
  );

await writeFile("i-wanna-ipad.html", bundled, "utf8");
console.log("Created i-wanna-ipad.html");
