import { join } from "node:path";

import { createServer } from "./server";

createServer({ clientDirectory: join(import.meta.dir, "client") });
