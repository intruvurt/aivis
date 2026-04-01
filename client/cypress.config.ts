import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "https://aivis.biz",
    supportFile: "cypress/support/e2e.ts", // or false
    specPattern: "cypress/e2e/**/*.cy.ts",
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    env: {
      apiUrl: "https://api.aivis.biz"
    },
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    retries: {
      runMode: 2,
      openMode: 0
    }
  }
});
