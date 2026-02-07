import { spawn } from "child_process";

function run(cmd, args, name) {
  const child = spawn(cmd, args, { stdio: "inherit", shell: true });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
      console.error(`[dev-with-whatsnew] ${name} exited with code ${code}`);
    }
  });
  return child;
}

const dev = run("npm", ["run", "dev"], "dev");
const watch = run("npm", ["run", "whats-new:watch"], "whats-new:watch");

const shutdown = () => {
  try {
    dev.kill("SIGINT");
  } catch {}
  try {
    watch.kill("SIGINT");
  } catch {}
};

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});
