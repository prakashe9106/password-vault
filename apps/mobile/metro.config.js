const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");
const fs = require("node:fs");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// pnpm workspaces are symlink-based; Metro needs to watch the whole monorepo and follow symlinks
// to see @vault/core's source (it isn't hoisted/copied into apps/mobile/node_modules). Note:
// deliberately NOT setting disableHierarchicalLookup or overriding nodeModulesPaths — pnpm's
// node_modules/.pnpm/<pkg>/node_modules/ layout depends on normal hierarchical resolution
// following each package's own private symlinked node_modules; disabling that (an option meant
// for Yarn PnP-style setups) broke resolution of expo's own dependencies (e.g. expo-modules-core)
// when tried here.
config.watchFolders = [workspaceRoot];
config.resolver.unstable_enableSymlinks = true;

// Same fix as apps/web and apps/extension's vite.config.ts / vitest.config.ts: this version of
// libsodium-wrappers-sumo's package.json "exports" map points the ESM build at a broken relative
// import, so bare-specifier resolution needs to be pointed at the working CJS build directly.
const libsodiumSumoCjsPath = require.resolve("libsodium-wrappers-sumo");

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "libsodium-wrappers-sumo") {
    return { type: "sourceFile", filePath: libsodiumSumoCjsPath };
  }

  // @vault/core is authored with NodeNext-style ".js" import specifiers that resolve to ".ts"
  // files on disk (a convention Vite/esbuild's resolver already follows automatically —
  // metro-resolver doesn't, so this reproduces the same fallback for that one package's imports).
  if (moduleName.startsWith(".") && moduleName.endsWith(".js") && context.originModulePath.includes(`${path.sep}vault-core${path.sep}src${path.sep}`)) {
    const candidate = path.resolve(path.dirname(context.originModulePath), moduleName.replace(/\.js$/, ".ts"));
    if (fs.existsSync(candidate)) {
      return { type: "sourceFile", filePath: candidate };
    }
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
