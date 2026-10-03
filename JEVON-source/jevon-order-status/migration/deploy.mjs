import {createDatabase} from './create-database.mjs';
import {migrate} from './migrate.mjs';
await createDatabase();
await migrate();
