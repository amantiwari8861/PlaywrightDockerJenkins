import dotenv from "dotenv";

// ESM hoists imports, so anything reading process.env at module scope must
// load dotenv first. Importing this module guarantees dotenv has run.
dotenv.config({ quiet: true });

export const PORT = process.env.PORT || 8080;
export const HOSTNAME = process.env.HOSTNAME || "localhost";
export const PUBLIC_HOSTNAME = process.env.PUBLIC_HOSTNAME || HOSTNAME;
export const BASE_URL = `http://${PUBLIC_HOSTNAME}:${PORT}`;

export default { PORT, HOSTNAME, PUBLIC_HOSTNAME, BASE_URL };
