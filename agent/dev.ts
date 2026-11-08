// Talk to Beau from the terminal, no iMessage needed.
//   npm run agent -- "the elevator in the library is broken"
// Needs NVIDIA_API_KEY in your environment.

import { runBeau } from "./beau";

const text = process.argv.slice(2).join(" ");
if (!text) {
  console.error('usage: npm run agent -- "your message"');
  process.exit(1);
}

runBeau(text)
  .then(({ reply, steps }) => {
    console.log("\ntools called:");
    for (const s of steps) console.log("  " + s);
    console.log("\nBeau:", reply, "\n");
  })
  .catch((err) => {
    console.error("failed:", err.message);
    process.exit(1);
  });
