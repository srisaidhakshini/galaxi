module.exports = {
  appId: "studio.dhakshini.galaxi",
  productName: "Galaxi",
  asar: true,
  directories: { app: ".local/desktop-app", output: ".local/desktop-release" },
  files: ["main.cjs", "preload.cjs", "package.json", "!node_modules/**"],
  extraResources: [{ from: ".local/desktop-runtime", to: "companion" }],
  protocols: [{ name: "Galaxi companion connection", schemes: ["galaxi"] }],
  win: {
    target: [{ target: "nsis", arch: ["x64"] }],
    artifactName: "Galaxi-Setup.exe",
    signExecutable: false,
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    runAfterFinish: true,
    deleteAppDataOnUninstall: false,
  },
  npmRebuild: false,
};
