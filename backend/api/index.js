// Vercel serverless entry: serves the whole Express API from one function.
// `npm run build` compiles src/ to dist/ first (see vercel.json).
import { createApp } from "../dist/app.js";

export default createApp();
