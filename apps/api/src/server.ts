import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.PORT, () => {
  console.info(`Make My Marriage API listening on port ${env.PORT}`);
});
