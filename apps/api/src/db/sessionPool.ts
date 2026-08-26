import pg from 'pg';

import { env } from '../config/env.js';

const { Pool } = pg;

export const sessionPool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 5,
});
