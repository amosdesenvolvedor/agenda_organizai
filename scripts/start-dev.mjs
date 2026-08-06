import { spawn, spawnSync } from "node:child_process";

const setupScripts = [
  { name: "gerar Prisma", args: ["run", "prisma:generate", "--workspace", "backend"] },
  { name: "aplicar migrations", args: ["run", "db:migrate"] },
  { name: "criar usuario de teste", args: ["run", "db:seed"] },
];

const scripts = [
  { name: "backend", args: ["run", "dev", "--workspace", "backend"] },
  { name: "frontend", args: ["run", "dev", "--workspace", "frontend"] },
];

const processes = [];
let shuttingDown = false;

for (const script of setupScripts) {
  console.log(`[executando] ${script.name}`);
  const result = spawnSync("npm", script.args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error || result.status !== 0) {
    console.error(`[erro] Falha ao ${script.name}.`);
    process.exit(result.status ?? 1);
  }
}

function stopAll(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of processes) {
    child.kill(signal);
  }
}

process.on("SIGINT", () => stopAll("SIGINT"));
process.on("SIGTERM", () => stopAll("SIGTERM"));

for (const script of scripts) {
  console.log(`[iniciando] ${script.name}`);

  const child = spawn("npm", script.args, {
    stdio: "inherit",
    env: process.env,
  });

  processes.push(child);

  child.on("error", (error) => {
    console.error(`[erro] ${script.name}: ${error.message}`);
    stopAll();
    process.exitCode = 1;
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;

    console.error(
      `[encerrado] ${script.name} (${signal ?? `codigo ${code ?? 1}`})`,
    );
    stopAll();
    process.exitCode = code || 1;
  });

  await new Promise((resolve) => setTimeout(resolve, 750));
}

console.log("[ok] backend e frontend iniciados.");
