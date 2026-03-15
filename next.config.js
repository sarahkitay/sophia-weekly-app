const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Use this app directory as workspace root so the build doesn't pick up parent lockfiles.
  outputFileTracingRoot: path.join(__dirname),
};

module.exports = nextConfig;
