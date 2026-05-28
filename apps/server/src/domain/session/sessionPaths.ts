import { existsSync } from 'fs';
import { join } from 'path';

/** Jest(CJS) 与 ESM 共用：推断 server 包根目录 */
const serverPackageRoot = existsSync(join(process.cwd(), 'apps/server', 'src'))
  ? join(process.cwd(), 'apps/server')
  : process.cwd();

export const SESSION_DATA_DIR = join(serverPackageRoot, 'data/sessions');
