import fs from "node:fs";
import webpush from "web-push";

const configPath = process.argv[2];
if (!configPath) throw new Error("Informe o caminho do deploy.env.");

const original = fs.readFileSync(configPath, "utf8");
const existingPublicKey = original.match(/^VAPID_PUBLIC_KEY=(.*)$/m)?.[1]?.replace(/^['"]|['"]$/g, "");
const existingPrivateKey = original.match(/^VAPID_PRIVATE_KEY=(.*)$/m)?.[1]?.replace(/^['"]|['"]$/g, "");

if (existingPublicKey && existingPrivateKey) {
  process.stdout.write("As chaves VAPID já estavam configuradas.\n");
  process.exit(0);
}

const keys = webpush.generateVAPIDKeys();
const values = {
  VAPID_PUBLIC_KEY: keys.publicKey,
  VAPID_PRIVATE_KEY: keys.privateKey,
  VAPID_SUBJECT: "mailto:suporte@organizai.cloud"
};

let updated = original;
for (const [name, value] of Object.entries(values)) {
  const line = `${name}='${value}'`;
  updated = new RegExp(`^${name}=.*$`, "m").test(updated)
    ? updated.replace(new RegExp(`^${name}=.*$`, "m"), line)
    : `${updated.trimEnd()}\n${line}\n`;
}

const temporaryPath = `${configPath}.vapid-new`;
fs.writeFileSync(temporaryPath, updated, { mode: 0o600 });
fs.renameSync(temporaryPath, configPath);
fs.chmodSync(configPath, 0o600);
process.stdout.write("Chaves VAPID geradas e armazenadas sem exibição.\n");
