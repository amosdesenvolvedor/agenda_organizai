import { app } from "./app.js";
import { env } from "./config/env.js";
import { startEmailWorker } from "./services/email.service.js";

startEmailWorker();

app.listen(env.PORT, () => {
  console.log(`Agenda OrganizaÍ API disponível em http://localhost:${env.PORT}`);
});
